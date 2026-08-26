#Requires -Version 7.0
<#
.SYNOPSIS
  Publish SystemScope and deploy it to Azure App Service next to WaterSolutions.

.EXAMPLE
  .\infra\Deploy-SystemScope.ps1
#>
[CmdletBinding()]
param(
    [string] $ResourceGroup = 'rg-rwf-dataplatform-dev',
    [string] $WebAppName = 'app-water-ws-api-dev',
    [string] $SiblingWebAppName = 'app-water-ws-web-dev',
    [string] $SqlServerFqdn = 'sql-water-ws-dev.database.windows.net',
    [string] $SqlDatabase = 'sqldb-water-ws-local',
    [string] $EntraTenantId = 'd16de530-94e7-4158-b7e2-6ee220af628d',
    [string] $EntraSpaClientId = 'e020e24c-ff88-4937-8860-0bedb9edfadf',
    [string] $EntraApiClientId = 'd40a5006-b97d-485d-b007-e2268d00f165',
    [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$publishDir = Join-Path $repoRoot 'artifacts/publish'
$zipPath = Join-Path $repoRoot 'artifacts/systemscope-webapp.zip'

function Assert-AzLogin {
    $account = az account show --output json 2>$null | ConvertFrom-Json
    if (-not $account) {
        throw 'Azure CLI is not logged in. Run az login and retry.'
    }
    Write-Host "Using subscription $($account.name) ($($account.id))"
}

function Get-SiblingApp {
    $json = az webapp show --name $SiblingWebAppName --resource-group $ResourceGroup --output json 2>$null
    if (-not $json) {
        throw "Could not find sibling app $SiblingWebAppName in $ResourceGroup. Pass a plan by creating the web app first."
    }
    return $json | ConvertFrom-Json
}

function Ensure-WebApp($sibling) {
    $existing = az webapp show --name $WebAppName --resource-group $ResourceGroup --output json 2>$null
    if ($existing) {
        Write-Host "Web app $WebAppName already exists."
        return $existing | ConvertFrom-Json
    }

    $planId = $sibling.appServicePlanId
    $planName = ($planId -split '/')[-1]
    $isLinux = $sibling.kind -match 'linux'
    Write-Host "Creating $WebAppName on plan $planName ($($sibling.kind))."

    if ($isLinux) {
        az webapp create --resource-group $ResourceGroup --plan $planName --name $WebAppName --runtime 'DOTNETCORE:10.0' --assign-identity '[system]' --output none
    }
    else {
        az webapp create --resource-group $ResourceGroup --plan $planName --name $WebAppName --runtime 'DOTNET:10' --assign-identity '[system]' --output none
    }

    az webapp update --resource-group $ResourceGroup --name $WebAppName --https-only true --output none
    return az webapp show --name $WebAppName --resource-group $ResourceGroup --output json | ConvertFrom-Json
}

function Set-AppSettings {
    $scope = "api://$EntraApiClientId/access_as_user"
    $authority = "https://login.microsoftonline.com/$EntraTenantId"
    Write-Host 'Configuring App Service settings.'
    az webapp config appsettings set --resource-group $ResourceGroup --name $WebAppName --settings `
        SCM_DO_BUILD_DURING_DEPLOYMENT=false `
        ENABLE_ORYX_BUILD=false `
        WEBSITE_RUN_FROM_PACKAGE=1 `
        ASPNETCORE_ENVIRONMENT=Production `
        "AzureAd__TenantId=$EntraTenantId" `
        "AzureAd__ClientId=$EntraApiClientId" `
        "EntraId__TenantId=$EntraTenantId" `
        "EntraId__Authority=$authority" `
        "EntraId__ClientId=$EntraSpaClientId" `
        "EntraId__ApiClientId=$EntraApiClientId" `
        "EntraId__Audience=api://$EntraApiClientId" `
        "EntraId__Scope=$scope" `
        "AzureSql__Server=$SqlServerFqdn" `
        "AzureSql__Database=$SqlDatabase" `
        'AzureSql__AuthenticationMode=EntraId' `
        'AzureSql__Encrypt=true' `
        'AzureSql__TrustServerCertificate=false' `
        'AzureSql__ConnectionTimeout=30' `
        'DatabaseMigrations__RunOnStartup=true' `
        'DatabaseMigrations__MigrationsPath=database/migrations' `
        'DatabaseMigrations__AppliedBy=SystemScope.AppService' `
        'DatabaseMigrations__FailStartupOnError=true' `
        --output none

    az webapp config set --resource-group $ResourceGroup --name $WebAppName --always-on true --ftps-state Disabled --min-tls-version '1.2' --output none
}

function Publish-App {
    if ($SkipBuild -and (Test-Path (Join-Path $publishDir 'SystemScope.Api.dll'))) {
        Write-Host 'Skipping build; using existing publish output.'
        return
    }

    New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
    if (Test-Path $publishDir) { Get-ChildItem $publishDir | Remove-Item -Recurse -Force }

    Write-Host 'Building frontend.'
    Push-Location (Join-Path $repoRoot 'src/systemscope-web')
    try {
        npm ci
        npm run build
    }
    finally { Pop-Location }

    Write-Host 'Publishing API.'
    dotnet publish (Join-Path $repoRoot 'src/SystemScope.Api/SystemScope.Api.csproj') -c Release -o $publishDir -p:SkipClientBuild=true

    $index = Join-Path $publishDir 'wwwroot/index.html'
    $dll = Join-Path $publishDir 'SystemScope.Api.dll'
    if (-not (Test-Path $index) -or -not (Test-Path $dll)) {
        throw 'Publish output is missing wwwroot/index.html or SystemScope.Api.dll.'
    }
}

function Deploy-Zip($webApp) {
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Write-Host "Zipping $publishDir (Linux-safe tar zip)"
    $zipFull = (Resolve-Path -LiteralPath (Split-Path $zipPath -Parent)).Path
    $zipName = Split-Path $zipPath -Leaf
    Push-Location $publishDir
    try {
        tar.exe -a -cf (Join-Path $zipFull $zipName) *
    }
    finally { Pop-Location }
    if ($webApp.kind -match 'linux') {
        Write-Host 'Setting Linux startup command.'
        az webapp config set --resource-group $ResourceGroup --name $WebAppName --startup-file 'dotnet SystemScope.Api.dll' --output none
    }
    Write-Host "Deploying $zipPath to $WebAppName"
    az webapp deploy --resource-group $ResourceGroup --name $WebAppName --src-path $zipPath --type zip --timeout 1800
}

function Add-SpaRedirect([string] $url) {
    Write-Host "Ensuring Entra SPA redirect URI $url"
    $app = az ad app show --id $EntraSpaClientId --output json | ConvertFrom-Json
    $uris = @($app.spa.redirectUris)
    if ($uris -contains $url) {
        Write-Host 'Redirect URI already registered.'
        return
    }
    $uris += $url
    $body = @{ spa = @{ redirectUris = $uris } } | ConvertTo-Json -Compress -Depth 5
    az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$($app.id)" --headers 'Content-Type=application/json' --body $body --output none
}

Assert-AzLogin
$sibling = Get-SiblingApp
$app = Ensure-WebApp $sibling
Set-AppSettings
Publish-App
Deploy-Zip $app

$url = "https://$($app.defaultHostName)"
try { Add-SpaRedirect $url } catch { Write-Warning "Could not add Entra redirect URI automatically: $_" }

Write-Host ''
Write-Host "Deployed SystemScope to $url"
Write-Host "Managed identity: $($app.identity.principalId)"
Write-Host ''
Write-Host 'If this is the first deploy, grant SQL access as an Entra SQL admin:'
Write-Host "  sqlcmd -S $SqlServerFqdn -d $SqlDatabase -G -I -i infra/Grant-AppService-SqlAccess.sql"
Write-Host 'Then confirm the SPA redirect URI includes the App Service origin.'
Write-Host "Health: $url/health"

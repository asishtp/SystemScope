param(
    [string]$ConnectionString = $env:AZURE_SQL_CONNECTION_STRING,
    [string]$MigrationsPath = (Join-Path $PSScriptRoot "migrations"),
    [string]$AppliedBy = $env:USERNAME,
    [string]$UserId = $env:AZURE_SQL_USER_ID,
    [string]$TenantId = $env:AZURE_TENANT_ID,
    [switch]$UseAzureCliToken,
    [switch]$Plan
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Data

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    $ConnectionString = "Server=tcp:sql-water-ws-dev.database.windows.net,1433;Initial Catalog=sqldb-water-ws-local;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Interactive;"
    Write-Host "Using default SystemScope Azure SQL connection: sql-water-ws-dev / sqldb-water-ws-local"
}

if (-not (Test-Path -LiteralPath $MigrationsPath)) {
    throw "MigrationsPath '$MigrationsPath' does not exist."
}

function New-DbConnectionStringBuilder {
    param([string]$Value)

    $builder = [System.Data.Common.DbConnectionStringBuilder]::new()
    try {
        $builder.set_ConnectionString($Value)
    }
    catch {
        throw "ConnectionString could not be parsed. $($_.Exception.Message)"
    }

    return $builder
}

function Get-ConnectionStringValue {
    param(
        [System.Data.Common.DbConnectionStringBuilder]$Builder,
        [string[]]$Keys
    )

    foreach ($requestedKey in $Keys) {
        foreach ($key in $Builder.Keys) {
            if ([string]::Equals([string]$key, $requestedKey, [System.StringComparison]::OrdinalIgnoreCase)) {
                return [string]$Builder[$key]
            }
        }
    }

    return $null
}

function Test-IsPlaceholderUserId {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    $candidate = $Value.Trim()
    $placeholderValues = @(
        "user@contoso.com",
        "user@example.com",
        "your.email@example.com",
        "your.email@organisation.gov.au"
    )

    foreach ($placeholder in $placeholderValues) {
        if ([string]::Equals($candidate, $placeholder, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $candidate.Contains("<") -or $candidate.Contains(">")
}

function Invoke-MigrationRunner {
    param([string[]]$AdditionalArguments = @())

    $runnerProject = Join-Path $PSScriptRoot "MigrationRunner\MigrationRunner.csproj"
    $runnerOutput = Join-Path $PSScriptRoot "MigrationRunner\bin\Release"

    if (-not (Test-Path -LiteralPath $runnerProject)) {
        throw "Migration runner project '$runnerProject' does not exist."
    }

    Write-Host "Building migration runner..."
    dotnet build $runnerProject -c Release -v quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to build migration runner."
    }

    $runnerExecutable = Get-ChildItem -LiteralPath $runnerOutput -Recurse -Filter "MigrationRunner.exe" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName

    $useExecutable = -not [string]::IsNullOrWhiteSpace($runnerExecutable) -and (Test-Path -LiteralPath $runnerExecutable)
    if (-not $useExecutable) {
        $runnerExecutable = Get-ChildItem -LiteralPath $runnerOutput -Recurse -Filter "MigrationRunner.dll" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName
    }

    if ([string]::IsNullOrWhiteSpace($runnerExecutable) -or -not (Test-Path -LiteralPath $runnerExecutable)) {
        throw "Migration runner build did not produce MigrationRunner.exe or MigrationRunner.dll under '$runnerOutput'."
    }

    $runnerArguments = @(
        "--connection-string", $ConnectionString,
        "--migrations-path", $MigrationsPath,
        "--applied-by", $AppliedBy
    )

    if ($Plan) {
        $runnerArguments += "--plan"
    }

    $runnerArguments += $AdditionalArguments

    if ($useExecutable) {
        & $runnerExecutable @runnerArguments
    }
    else {
        dotnet $runnerExecutable @runnerArguments
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Database migration runner failed with exit code $LASTEXITCODE."
    }
}

$connectionStringBuilder = New-DbConnectionStringBuilder -Value $ConnectionString
$authentication = Get-ConnectionStringValue -Builder $connectionStringBuilder -Keys @("Authentication")
$connectionStringUserId = Get-ConnectionStringValue -Builder $connectionStringBuilder -Keys @("User ID", "UID")
$isActiveDirectoryInteractive = [string]::Equals($authentication, "Active Directory Interactive", [System.StringComparison]::OrdinalIgnoreCase)

if ($isActiveDirectoryInteractive -and [string]::IsNullOrWhiteSpace($connectionStringUserId) -and -not [string]::IsNullOrWhiteSpace($UserId)) {
    if (Test-IsPlaceholderUserId -Value $UserId) {
        throw "AZURE_SQL_USER_ID/-UserId is still set to the sample value '$UserId'. Replace it with the real Entra UPN that has access to the target Azure SQL database."
    }

    $connectionStringBuilder["User ID"] = $UserId
    $ConnectionString = $connectionStringBuilder.ConnectionString
    $connectionStringUserId = $UserId
}

if ($isActiveDirectoryInteractive -and (Test-IsPlaceholderUserId -Value $connectionStringUserId)) {
    if (-not [string]::IsNullOrWhiteSpace($UserId) -and -not (Test-IsPlaceholderUserId -Value $UserId)) {
        $connectionStringBuilder["User ID"] = $UserId
        $ConnectionString = $connectionStringBuilder.ConnectionString
        $connectionStringUserId = $UserId
    }
    else {
        throw "ConnectionString uses 'Authentication=Active Directory Interactive' with the sample User ID '$connectionStringUserId'. Replace it with your real Entra UPN, or remove 'User ID' from the connection string and set AZURE_SQL_USER_ID."
    }
}

if ($UseAzureCliToken) {
    Write-Host "Getting Azure SQL access token from Azure CLI..."
    $accessToken = az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accessToken)) {
        throw "Failed to get Azure SQL access token from Azure CLI. Run 'az login' and try again."
    }

    try {
        Invoke-MigrationRunner -AdditionalArguments @("--access-token", $accessToken)
    }
    finally {
        $accessToken = $null
    }

    exit 0
}

if ($isActiveDirectoryInteractive) {
    if ([string]::IsNullOrWhiteSpace($connectionStringUserId)) {
        throw "ConnectionString uses 'Authentication=Active Directory Interactive' without 'User ID'. Add 'User ID=user@contoso.com' to the connection string, pass -UserId user@contoso.com, or run 'az login' and rerun with -UseAzureCliToken."
    }

    $interactiveArguments = @("--interactive-user-id", $connectionStringUserId)
    if (-not [string]::IsNullOrWhiteSpace($TenantId)) {
        $interactiveArguments += @("--tenant-id", $TenantId)
    }

    Invoke-MigrationRunner -AdditionalArguments $interactiveArguments
    exit 0
}

Invoke-MigrationRunner

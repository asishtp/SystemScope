targetScope = 'resourceGroup'

@description('Web App name, for example app-systemscope-web-dev')
param appName string

@description('Existing App Service plan name in this resource group, for example the WaterSolutions plan')
param existingPlanName string

@description('Azure SQL fully qualified server name')
param sqlServerFqdn string = 'sql-water-ws-dev.database.windows.net'

@description('Azure SQL database that already holds SystemScope schema')
param sqlDatabaseName string = 'sqldb-water-ws-local'

param location string = resourceGroup().location
param entraTenantId string = tenant().tenantId
param entraSpaClientId string
param entraApiClientId string
param entraScope string = 'api://${entraApiClientId}/access_as_user'
param runtimeStack string = 'DOTNETCORE|10.0'
param linuxApp bool = true

var authority = 'https://login.microsoftonline.com/${entraTenantId}'
var audience = 'api://${entraApiClientId}'

resource plan 'Microsoft.Web/serverfarms@2024-11-01' existing = {
  name: existingPlanName
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web' }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: linuxApp ? 'app,linux' : 'app'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxApp ? runtimeStack : ''
      netFrameworkVersion: linuxApp ? '' : 'v10.0'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'ENABLE_ORYX_BUILD', value: 'false' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
        { name: 'AzureAd__TenantId', value: entraTenantId }
        { name: 'AzureAd__ClientId', value: entraApiClientId }
        { name: 'EntraId__TenantId', value: entraTenantId }
        { name: 'EntraId__Authority', value: authority }
        { name: 'EntraId__ClientId', value: entraSpaClientId }
        { name: 'EntraId__ApiClientId', value: entraApiClientId }
        { name: 'EntraId__Audience', value: audience }
        { name: 'EntraId__Scope', value: entraScope }
        { name: 'AzureSql__Server', value: sqlServerFqdn }
        { name: 'AzureSql__Database', value: sqlDatabaseName }
        { name: 'AzureSql__AuthenticationMode', value: 'EntraId' }
        { name: 'AzureSql__Encrypt', value: 'true' }
        { name: 'AzureSql__TrustServerCertificate', value: 'false' }
        { name: 'AzureSql__ConnectionTimeout', value: '30' }
        { name: 'DatabaseMigrations__RunOnStartup', value: 'true' }
        { name: 'DatabaseMigrations__MigrationsPath', value: 'database/migrations' }
        { name: 'DatabaseMigrations__AppliedBy', value: 'SystemScope.AppService' }
        { name: 'DatabaseMigrations__FailStartupOnError', value: 'true' }
      ]
    }
  }
}

output webAppName string = app.name
output webAppUrl string = 'https://${app.properties.defaultHostName}'
output managedIdentityObjectId string = app.identity.principalId
output managedIdentityName string = app.name

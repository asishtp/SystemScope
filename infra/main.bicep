targetScope = 'resourceGroup'

@description('Globally unique web application name')
param appName string
param location string = resourceGroup().location
param sqlAdministratorObjectId string
param sqlAdministratorLogin string
param entraTenantId string = tenant().tenantId
param entraClientId string

var sqlName = '${appName}-sql'
var planName = '${appName}-plan'

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: planName
  location: location
  sku: { name: 'P0v3', tier: 'PremiumV3', capacity: 1 }
  kind: 'linux'
  properties: { reserved: true }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web' }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlName
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: sqlAdministratorLogin
      sid: sqlAdministratorObjectId
      tenantId: entraTenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlServer
  name: 'systemscope'
  location: location
  sku: { name: 'S0', tier: 'Standard' }
  properties: { zoneRedundant: false }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'AzureAd__TenantId', value: entraTenantId }
        { name: 'AzureAd__ClientId', value: entraClientId }
        { name: 'ConnectionStrings__SystemScope', value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${database.name};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;' }
      ]
    }
  }
}

output webAppName string = app.name
output webAppUrl string = 'https://${app.properties.defaultHostName}'
output managedIdentityObjectId string = app.identity.principalId
output sqlServerName string = sqlServer.name

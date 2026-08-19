# SystemScope

SystemScope is a standalone technical landscape assessment application. A React 19 SPA and .NET 10 API are published as one artifact and hosted together in a single Azure Web App.

## Included MVP

- Interactive landscape assessment workspace (status, scope, heat, as-is/to-be, export)
- Project and system registers
- Versioned Oracle/web assessment template
- Question-by-question Workshop Mode with confidence and status
- Dashboard coverage and gap metrics
- Findings, review, risk scoring, requirements traceability, actions and audit APIs
- Authorised CSV register export with an audit event
- Microsoft Entra bearer authentication in configured environments
- Azure SQL access through the App Service managed identity
- Local in-memory development data (no secrets or production data on disk)

## Run locally

```powershell
cd src/systemscope-web
npm install
npm run build
cd ../SystemScope.Api
dotnet run --urls http://localhost:5080
```

Open `http://localhost:5080`. When `AzureAd` is not configured, a local Assessment Lead identity is used. The development database is intentionally in-memory and resets at restart.

For frontend hot reload, run `npm run dev` in `src/systemscope-web` while the API runs on port 5080. Vite proxies `/api` to the API.

## One Azure Web App deployment

`npm run build` writes the React bundle into `src/SystemScope.Api/wwwroot`. `dotnet publish` also invokes the client build unless `SkipClientBuild=true`. ASP.NET serves the SPA and API on the same host:

```text
https://<app>.azurewebsites.net/       React SPA
https://<app>.azurewebsites.net/api/* .NET 10 API
```

Provision the supporting App Service plan, single Web App, Azure SQL database and Application Insights instance:

```powershell
az deployment group create --resource-group <resource-group> --template-file infra/main.bicep --parameters appName=<unique-name> entraClientId=<api-app-registration-client-id> sqlAdministratorObjectId=<object-id> sqlAdministratorLogin=<name>
```

After provisioning, connect as the configured Entra SQL administrator and grant the Web App managed identity the minimum database roles required by the approved migration process. Production should run reviewed EF migrations from the deployment pipeline; runtime schema creation is suitable only for the initial scaffold.

Configure the Entra app registration to issue access tokens for the API, define the departmental application roles, and assign users/groups. Before production, apply the department's private networking, access restrictions, classification, retention, backup, restore, security and records-management decisions.

The workflow in `.github/workflows/deploy.yml` produces and deploys the single combined artifact using workload identity federation. Configure the three Azure repository secrets and `AZURE_WEBAPP_NAME` repository variable before enabling it.

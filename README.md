# SystemScope

SystemScope is a standalone technical landscape assessment application. A React 19 SPA and .NET 10 API are published as one artifact and hosted together in a single Azure Web App.

## Included MVP

- Interactive landscape assessment workspace (status, scope, heat, as-is/to-be, export)
- Market-scan assessment workspace with six domains, systems register, integration catalogue, gaps, validation, Word generation, document approval and publication
- Seeded Water Monitoring Systems Market Scan 2026 including the AQUIS example (`#/assessments/aquis`, `#/documents/aquis`, `#/validate/aquis/request-1042`)
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

The intended development host sits beside WaterSolutions:

```text
Resource group  rg-rwf-dataplatform-dev
Web App         app-systemscope-web-dev
Plan            same App Service plan as app-water-ws-web-dev
SQL             sql-water-ws-dev / sqldb-water-ws-local
```

Publish and deploy (creates the Web App if needed, sets Entra/SQL app settings, zip-deploys):

```powershell
az login --tenant d16de530-94e7-4158-b7e2-6ee220af628d
.\infra\Deploy-SystemScope.ps1
```

After the first deploy, grant the Web App managed identity database access as an Entra SQL administrator:

```powershell
sqlcmd -S sql-water-ws-dev.database.windows.net -d sqldb-water-ws-local -G -I -i infra/Grant-AppService-SqlAccess.sql
```

Register `https://app-systemscope-web-dev.azurewebsites.net` as an Entra SPA redirect URI on client `e020e24c-ff88-4937-8860-0bedb9edfadf` if the deploy script could not add it.

To provision the Web App from Bicep onto an existing plan instead of the script:

```powershell
az deployment group create --resource-group rg-rwf-dataplatform-dev --template-file infra/main.bicep --parameters appName=app-systemscope-web-dev existingPlanName=<plan-name> entraSpaClientId=e020e24c-ff88-4937-8860-0bedb9edfadf entraApiClientId=d40a5006-b97d-485d-b007-e2268d00f165
```

The workflow in `.github/workflows/deploy.yml` produces and deploys the single combined artifact using workload identity federation. Configure the three Azure repository secrets and `AZURE_WEBAPP_NAME` repository variable before enabling it.

# SystemScope database migrations

Ordered SQL migrations for the SystemScope Azure SQL schema. This matches the WaterSolutions `database` migration process: forward-only `.sql` files, `dbo.App_Schema_Migrations` journal, checksum guards, and a CLI runner.

## Target

Local development uses:

```text
Server:   sql-water-ws-dev.database.windows.net
Database: sqldb-water-ws-local
Auth:     Active Directory Interactive
```

## Quick start

Preview:

```powershell
.\database\Run-Migrations.ps1 -Plan
```

Apply (browser sign-in):

```powershell
$env:AZURE_SQL_USER_ID = "your.account@organisation.gov.au"
$env:AZURE_TENANT_ID = "d16de530-94e7-4158-b7e2-6ee220af628d"
.\database\Run-Migrations.ps1
```

Or with Azure CLI:

```powershell
.\database\Run-Migrations.ps1 -UseAzureCliToken
```

`dotnet run` in Development also applies pending migrations on startup, then seeds AQUIS demo data.

## New change

```powershell
.\database\New-Migration.ps1 add_example_column
```

Replace the placeholder `THROW` with guarded SQL. Do not edit a migration after it has been applied; add a new file.

Journal:

```sql
SELECT MigrationId, Name, AppliedAt, AppliedBy
FROM dbo.App_Schema_Migrations
ORDER BY AppliedAt DESC;
```

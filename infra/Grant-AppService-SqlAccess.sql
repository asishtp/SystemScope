/*
    Grant the SystemScope App Service managed identity access to Azure SQL.

    Run in the target database (sqldb-water-ws-local) as an Entra SQL administrator:

        sqlcmd -S sql-water-ws-dev.database.windows.net -d sqldb-water-ws-local -G -I -i infra/Grant-AppService-SqlAccess.sql

    Replace the user name if the web app name is different.
*/

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'app-systemscope-web-dev')
    CREATE USER [app-systemscope-web-dev] FROM EXTERNAL PROVIDER;

ALTER ROLE db_datareader ADD MEMBER [app-systemscope-web-dev];
ALTER ROLE db_datawriter ADD MEMBER [app-systemscope-web-dev];
ALTER ROLE db_ddladmin ADD MEMBER [app-systemscope-web-dev];

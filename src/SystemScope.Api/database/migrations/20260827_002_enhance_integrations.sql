/*
    Migration: 20260827_002_enhance_integrations

    Purpose:
    - Add IntegrationCatalog for reusable logical integrations.
    - Add IntegrationType, Protocol, DataFormat and CatalogId on occurrence rows.
    - Backfill IntegrationType from existing Method (including 20260824_002 Unknown rows).

    Notes:
    - Forward-only migration.
    - ALTER and UPDATE are in this file so the column default (Api = 0) is not left on existing rows.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.IntegrationCatalogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntegrationCatalogs
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_IntegrationCatalogs PRIMARY KEY,
        [CreatedAt] DATETIMEOFFSET NOT NULL,
        [UpdatedAt] DATETIMEOFFSET NOT NULL,
        [RowVersion] ROWVERSION NOT NULL,
        [Archived] BIT NOT NULL CONSTRAINT DF_IntegrationCatalogs_Archived DEFAULT (0),
        [CatalogKey] NVARCHAR(64) NOT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [Purpose] NVARCHAR(MAX) NOT NULL,
        [SourceMasterSystemId] UNIQUEIDENTIFIER NULL,
        [TargetMasterSystemId] UNIQUEIDENTIFIER NULL,
        [SourceLabel] NVARCHAR(MAX) NOT NULL,
        [TargetLabel] NVARCHAR(MAX) NOT NULL,
        [IntegrationType] INT NOT NULL,
        [Protocol] NVARCHAR(100) NOT NULL,
        [DataFormat] NVARCHAR(100) NOT NULL,
        [Frequency] NVARCHAR(MAX) NOT NULL,
        [Criticality] NVARCHAR(MAX) NOT NULL,
        [SupportTeam] NVARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_IntegrationCatalogs_SourceMaster FOREIGN KEY ([SourceMasterSystemId]) REFERENCES dbo.MasterSystems ([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_IntegrationCatalogs_TargetMaster FOREIGN KEY ([TargetMasterSystemId]) REFERENCES dbo.MasterSystems ([Id]) ON DELETE NO ACTION
    );
    CREATE UNIQUE INDEX UX_IntegrationCatalogs_CatalogKey
        ON dbo.IntegrationCatalogs ([CatalogKey]) WHERE [Archived] = 0;
END;
GO

IF COL_LENGTH(N'dbo.Integrations', N'IntegrationType') IS NULL
BEGIN
    ALTER TABLE dbo.Integrations ADD
        [IntegrationType] INT NOT NULL CONSTRAINT DF_Integrations_IntegrationType DEFAULT (0),
        [Protocol] NVARCHAR(100) NOT NULL CONSTRAINT DF_Integrations_Protocol DEFAULT (N''),
        [DataFormat] NVARCHAR(100) NOT NULL CONSTRAINT DF_Integrations_DataFormat DEFAULT (N''),
        [CatalogId] UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH(N'dbo.Integrations', N'IntegrationType') IS NOT NULL
BEGIN
    UPDATE dbo.Integrations
    SET
        [IntegrationType] = CASE
            WHEN LOWER([Method]) IN (N'api', N'') THEN 0
            WHEN LOWER([Method]) LIKE N'%batch%' OR LOWER([Method]) LIKE N'%job%' THEN 1
            WHEN LOWER([Method]) LIKE N'%sftp%' OR LOWER([Method]) LIKE N'%ftp%' OR LOWER([Method]) LIKE N'%file%' THEN 2
            WHEN LOWER([Method]) LIKE N'%dblink%' OR LOWER([Method]) LIKE N'%database link%' THEN 3
            WHEN LOWER([Method]) LIKE N'%event%' OR LOWER([Method]) LIKE N'%queue%' OR LOWER([Method]) LIKE N'%service bus%' THEN 4
            ELSE 5
        END,
        [Protocol] = CASE
            WHEN LOWER([Method]) IN (N'api', N'') THEN N'HTTPS'
            WHEN LOWER([Method]) = N'application module' THEN N'Oracle Forms module'
            WHEN LOWER([Method]) LIKE N'%sftp%' THEN N'SFTP'
            WHEN LOWER([Method]) LIKE N'%ftp%' THEN N'FTP'
            WHEN LOWER([Method]) LIKE N'%dblink%' OR LOWER([Method]) LIKE N'%database link%' THEN N'Oracle DB link'
            WHEN LOWER([Method]) IN (N'unknown', N'application workflow') THEN N''
            WHEN LOWER([Method]) LIKE N'%batch%' OR LOWER([Method]) LIKE N'%job%' OR LOWER([Method]) LIKE N'%file%' OR LOWER([Method]) LIKE N'%event%' OR LOWER([Method]) LIKE N'%queue%' OR LOWER([Method]) LIKE N'%service bus%' THEN N''
            ELSE [Method]
        END,
        [DataFormat] = CASE
            WHEN LOWER([Method]) LIKE N'%dblink%' OR LOWER([Method]) LIKE N'%database link%' THEN N'Relational'
            ELSE N''
        END
    WHERE [Protocol] = N'' AND [DataFormat] = N'';
END;
GO

IF COL_LENGTH(N'dbo.Integrations', N'CatalogId') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Integrations_IntegrationCatalogs')
BEGIN
    ALTER TABLE dbo.Integrations
        ADD CONSTRAINT FK_Integrations_IntegrationCatalogs
        FOREIGN KEY ([CatalogId]) REFERENCES dbo.IntegrationCatalogs ([Id]) ON DELETE NO ACTION;
END;
GO

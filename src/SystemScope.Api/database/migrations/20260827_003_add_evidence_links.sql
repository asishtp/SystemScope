/*
    Migration: 20260827_003_add_evidence_links

    Purpose:
    - Add many-to-many EvidenceLink so one HTTPS evidence record can support
      systems, capabilities, information assets, integrations, findings and requirements.

    Notes:
    - Forward-only migration.
    - Evidence remains HTTPS links; this table does not store file bytes.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.EvidenceLinks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EvidenceLinks
    (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EvidenceLinks PRIMARY KEY,
        [CreatedAt] DATETIMEOFFSET NOT NULL,
        [UpdatedAt] DATETIMEOFFSET NOT NULL,
        [RowVersion] ROWVERSION NOT NULL,
        [Archived] BIT NOT NULL CONSTRAINT DF_EvidenceLinks_Archived DEFAULT (0),
        [EvidenceId] UNIQUEIDENTIFIER NOT NULL,
        [EntityType] INT NOT NULL,
        [EntityId] UNIQUEIDENTIFIER NOT NULL,
        [Excerpt] NVARCHAR(MAX) NOT NULL,
        [SourceLocation] NVARCHAR(MAX) NOT NULL,
        [ProjectId] UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT FK_EvidenceLinks_Evidence FOREIGN KEY ([EvidenceId]) REFERENCES dbo.Evidence ([Id]) ON DELETE NO ACTION
    );
    CREATE UNIQUE INDEX UX_EvidenceLinks_Evidence_Target
        ON dbo.EvidenceLinks ([EvidenceId], [EntityType], [EntityId]) WHERE [Archived] = 0;
    CREATE INDEX IX_EvidenceLinks_Target ON dbo.EvidenceLinks ([EntityType], [EntityId]);
    CREATE INDEX IX_EvidenceLinks_ProjectId ON dbo.EvidenceLinks ([ProjectId]);
END;
GO

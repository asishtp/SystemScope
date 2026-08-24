IF COL_LENGTH(N'dbo.GeneratedDocuments', N'DesignTemplateId') IS NULL
BEGIN
    ALTER TABLE dbo.GeneratedDocuments ADD DesignTemplateId UNIQUEIDENTIFIER NULL;
    ALTER TABLE dbo.GeneratedDocuments ADD CONSTRAINT FK_GeneratedDocuments_DocumentDesignTemplates_DesignTemplateId
        FOREIGN KEY (DesignTemplateId) REFERENCES dbo.DocumentDesignTemplates(Id);
    CREATE INDEX IX_GeneratedDocuments_DesignTemplateId ON dbo.GeneratedDocuments(DesignTemplateId);
END;
GO

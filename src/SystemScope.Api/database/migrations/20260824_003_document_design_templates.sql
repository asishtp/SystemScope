IF OBJECT_ID(N'dbo.DocumentDesignTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DocumentDesignTemplates
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        CreatedAt DATETIMEOFFSET NOT NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        Archived BIT NOT NULL DEFAULT 0,
        ProjectId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        ContentType NVARCHAR(200) NOT NULL,
        FileBytes VARBINARY(MAX) NOT NULL,
        UploadedBy NVARCHAR(200) NOT NULL,
        IsDefault BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_DocumentDesignTemplates_Projects_ProjectId FOREIGN KEY (ProjectId) REFERENCES dbo.Projects(Id)
    );
    CREATE INDEX IX_DocumentDesignTemplates_ProjectId ON dbo.DocumentDesignTemplates(ProjectId);
END;
GO

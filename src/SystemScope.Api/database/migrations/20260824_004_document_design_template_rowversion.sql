IF OBJECT_ID(N'dbo.DocumentDesignTemplates', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.DocumentDesignTemplates', N'RowVersion') IS NULL
BEGIN
    ALTER TABLE dbo.DocumentDesignTemplates ADD RowVersion ROWVERSION NOT NULL;
END;
GO

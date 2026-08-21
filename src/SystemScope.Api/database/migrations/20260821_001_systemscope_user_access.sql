/*
    Migration: 20260821_001_systemscope_user_access

    Purpose:
    - Store SystemScope application users, access requests and approvals.
    - Separate from WaterSolutions dbo.App_User_Access so each product has its own approvals.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.SystemScope_User_Access', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SystemScope_User_Access
    (
        [UserId] NVARCHAR(100) NOT NULL CONSTRAINT PK_SystemScope_User_Access PRIMARY KEY,
        [Email] NVARCHAR(255) NOT NULL,
        [DisplayName] NVARCHAR(255) NULL,
        [Roles] NVARCHAR(500) NOT NULL CONSTRAINT DF_SystemScope_User_Access_Roles DEFAULT ('user'),
        [Permissions] NVARCHAR(2000) NOT NULL CONSTRAINT DF_SystemScope_User_Access_Permissions DEFAULT (''),
        [IsActive] BIT NOT NULL CONSTRAINT DF_SystemScope_User_Access_IsActive DEFAULT (1),
        [AccessStatus] NVARCHAR(50) NOT NULL CONSTRAINT DF_SystemScope_User_Access_AccessStatus DEFAULT ('Pending'),
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT DF_SystemScope_User_Access_CreatedAt DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] DATETIME2 NULL,
        [LastLoginAt] DATETIME2 NULL,
        [AccessRequestedAt] DATETIME2 NULL,
        [AccessApprovedAt] DATETIME2 NULL,
        [ApprovedByUserId] NVARCHAR(100) NULL,
        [ApprovedByEmail] NVARCHAR(255) NULL,
        [AccessNotes] NVARCHAR(1000) NULL
    );

    CREATE UNIQUE INDEX IX_SystemScope_User_Access_Email ON dbo.SystemScope_User_Access([Email]);
    CREATE INDEX IX_SystemScope_User_Access_AccessStatus ON dbo.SystemScope_User_Access([AccessStatus]);
END;
GO

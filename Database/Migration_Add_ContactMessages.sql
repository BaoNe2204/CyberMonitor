-- ============================================================
-- Migration: Thêm bảng ContactMessages
-- Chạy trên database: CyberMonitor
-- ============================================================

USE CyberMonitor;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ContactMessages')
BEGIN
    CREATE TABLE ContactMessages (
        Id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        Name        NVARCHAR(200)    NOT NULL,
        Email       NVARCHAR(255)    NOT NULL,
        Subject     NVARCHAR(500)    NULL,
        Message     NVARCHAR(MAX)    NOT NULL,
        Status      NVARCHAR(20)     NOT NULL DEFAULT 'unread',  -- unread | read | replied
        Reply       NVARCHAR(MAX)    NULL,
        RepliedBy   UNIQUEIDENTIFIER NULL REFERENCES Users(Id) ON DELETE SET NULL,
        RepliedAt   DATETIME2        NULL,
        IpAddress   NVARCHAR(50)     NULL,
        CreatedAt   DATETIME2        NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_ContactMessages_Status    ON ContactMessages (Status);
    CREATE INDEX IX_ContactMessages_CreatedAt ON ContactMessages (CreatedAt DESC);
    CREATE INDEX IX_ContactMessages_Email     ON ContactMessages (Email);

    PRINT 'Created ContactMessages table';
END
ELSE
    PRINT 'ContactMessages table already exists';
GO

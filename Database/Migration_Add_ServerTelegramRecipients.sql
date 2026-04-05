-- ============================================
-- Migration: Add ServerTelegramRecipients table
-- Purpose: Store up to 5 Telegram chat IDs per server for alert notifications
-- Date: 2026-04-05
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServerTelegramRecipients')
BEGIN
    CREATE TABLE ServerTelegramRecipients (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ServerId UNIQUEIDENTIFIER NOT NULL,
        ChatId NVARCHAR(100) NOT NULL,
        DisplayName NVARCHAR(200) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ServerTelegramRecipients_Servers FOREIGN KEY (ServerId)
            REFERENCES Servers(Id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IX_ServerTelegramRecipients_ServerId_ChatId
        ON ServerTelegramRecipients(ServerId, ChatId);

    PRINT 'ServerTelegramRecipients table created successfully';
END
ELSE
BEGIN
    PRINT 'ServerTelegramRecipients table already exists';
END
GO

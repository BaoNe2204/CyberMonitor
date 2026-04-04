-- ============================================
-- Migration: Add ServerAlertEmails table
-- Purpose: Store up to 5 email addresses per server for alert notifications
-- Date: 2026-04-05
-- ============================================

-- Create ServerAlertEmails table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServerAlertEmails')
BEGIN
    CREATE TABLE ServerAlertEmails (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ServerId UNIQUEIDENTIFIER NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ServerAlertEmails_Servers FOREIGN KEY (ServerId) 
            REFERENCES Servers(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_ServerAlertEmails_ServerId ON ServerAlertEmails(ServerId);
    CREATE INDEX IX_ServerAlertEmails_Email ON ServerAlertEmails(Email);

    PRINT 'ServerAlertEmails table created successfully';
END
ELSE
BEGIN
    PRINT 'ServerAlertEmails table already exists';
END
GO

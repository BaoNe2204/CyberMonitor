-- Migration: Add missing columns to Whitelists table
-- (IsActive, ServerId) - present in EF entity but missing from DB

USE CyberMonitor;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Whitelists') AND name = 'IsActive'
)
BEGIN
    ALTER TABLE Whitelists ADD IsActive BIT NOT NULL DEFAULT 1;
    PRINT 'Column IsActive added to Whitelists.';
END
ELSE
    PRINT 'IsActive already exists, skipping.';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Whitelists') AND name = 'ServerId'
)
BEGIN
    ALTER TABLE Whitelists ADD ServerId UNIQUEIDENTIFIER NULL;
    ALTER TABLE Whitelists ADD CONSTRAINT FK_Whitelists_Servers
        FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE NO ACTION;
    CREATE INDEX IX_Whitelists_ServerId ON Whitelists(ServerId);
    PRINT 'Column ServerId added to Whitelists.';
END
ELSE
    PRINT 'ServerId already exists, skipping.';
GO

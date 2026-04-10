-- Migration: Add AvatarUrl column to Users table
-- Run this on existing databases that were created before this column was added

USE CyberMonitor;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'AvatarUrl'
)
BEGIN
    ALTER TABLE Users ADD AvatarUrl NVARCHAR(MAX) NULL;
    PRINT 'Column AvatarUrl added to Users table.';
END
ELSE
    PRINT 'Column AvatarUrl already exists, skipping.';
GO

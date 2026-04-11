-- ============================================================================
-- STEP 1: Create Database
-- Chạy file này TRƯỚC TIÊN
-- ============================================================================

SET NOCOUNT ON;

PRINT '================================================================';
PRINT ' Creating CyberMonitor Database';
PRINT '================================================================';

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'CyberMonitor')
BEGIN
    CREATE DATABASE [CyberMonitor];
    PRINT '[OK] Database CyberMonitor created successfully.';
END
ELSE
BEGIN
    PRINT '[INFO] Database CyberMonitor already exists. Skipping creation.';
END

PRINT '';
PRINT '================================================================';
PRINT ' Step 1 COMPLETE';
PRINT ' Now run: CyberMonitor_CreateTables.sql';
PRINT '================================================================';

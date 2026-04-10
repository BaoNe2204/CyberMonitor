-- ================================================================
-- CyberMonitor - Reset Database
-- XOA database cu va tao lai (nhanh, don gian)
-- Chi chay file nay khi muon xoa database
-- Sau do chay: FULL_SCHEMA.sql de tao lai
-- ================================================================

USE master;
GO

PRINT 'Bat dau xoa database CyberMonitor...';
GO

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'CyberMonitor')
BEGIN
    ALTER DATABASE CyberMonitor SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE CyberMonitor;
    PRINT 'Da xoa thanh cong database CyberMonitor!';
END
ELSE
BEGIN
    PRINT 'Database CyberMonitor khong ton tai, khong can xoa.';
END
GO

PRINT '';
PRINT '============================================================';
PRINT ' Xoa database thanh cong!';
PRINT ' Tiep theo chay: FULL_SCHEMA.sql de tao database moi';
PRINT '============================================================';
GO

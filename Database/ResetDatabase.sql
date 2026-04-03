-- ============================================
-- CyberMonitor - Reset Database
-- Chạy file này TRƯỚC TIÊN nếu muốn tạo lại DB từ đầu
-- ============================================
-- Cách dùng trong SSMS:
--   1. Mở file này trong SSMS
--   2. Execute (F5)
--   3. Sau đó chạy Schema.sql
--   4. Sau đó chạy SeedData.sql
-- ============================================

USE master;
GO

-- Drop database nếu tồn tại
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'CyberMonitor')
BEGIN
    ALTER DATABASE CyberMonitor SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE CyberMonitor;
    PRINT 'Database CyberMonitor đã được xóa thành công!';
END
ELSE
BEGIN
    PRINT 'Database CyberMonitor không tồn tại, không cần xóa.';
END
GO

-- Tạo lại database
CREATE DATABASE CyberMonitor;
GO

USE CyberMonitor;
GO

PRINT 'Database CyberMonitor đã được tạo mới!';
PRINT 'Tiếp theo chạy: Schema.sql, rồi SeedData.sql';
GO

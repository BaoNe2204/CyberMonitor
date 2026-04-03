-- ============================================
-- Migration: Add AnomalyScore column to BlockedIPs
-- ============================================
-- Chạy: kiểm tra xem cột đã tồn tại chưa trước khi ALTER

USE CyberMonitor;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('BlockedIPs') AND name = 'AnomalyScore')
BEGIN
    ALTER TABLE BlockedIPs ADD AnomalyScore DECIMAL(5,4) NULL;
    PRINT 'Added AnomalyScore column to BlockedIPs';
END
ELSE
BEGIN
    PRINT 'AnomalyScore column already exists in BlockedIPs';
END
GO

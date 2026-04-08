-- Xóa sạch dữ liệu Trung tâm Sự cố (Alerts & Tickets)
-- Chạy script này khi muốn reset dữ liệu sự cố

USE CyberMonitor;
GO

-- Xóa tất cả tickets
DELETE FROM Tickets;
GO

-- Xóa tất cả alerts
DELETE FROM Alerts;
GO

-- Xóa alert digest queue (nếu có)
IF OBJECT_ID('AlertDigestQueue', 'U') IS NOT NULL
BEGIN
    DELETE FROM AlertDigestQueue;
END
GO

-- Reset identity nếu muốn bắt đầu lại từ ID = 1
-- DBCC CHECKIDENT ('Tickets', RESEED, 0);
-- DBCC CHECKIDENT ('Alerts', RESEED, 0);
-- GO

-- Kiểm tra kết quả
SELECT COUNT(*) AS TotalTickets FROM Tickets;
SELECT COUNT(*) AS TotalAlerts FROM Alerts;
GO

PRINT 'Đã xóa sạch dữ liệu Trung tâm Sự cố (Alerts & Tickets)!';

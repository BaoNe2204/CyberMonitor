-- Xóa sạch dữ liệu Defense - IP Blocking
-- Chạy script này khi muốn reset danh sách IP bị chặn

USE CyberMonitor;
GO

-- Xóa tất cả blocked IPs
DELETE FROM BlockedIPs;
GO

-- Reset identity nếu muốn bắt đầu lại từ ID = 1
-- DBCC CHECKIDENT ('BlockedIPs', RESEED, 0);
-- GO

-- Kiểm tra kết quả
SELECT COUNT(*) AS TotalBlockedIPs FROM BlockedIPs;
GO

PRINT 'Đã xóa sạch danh sách IP bị chặn!';

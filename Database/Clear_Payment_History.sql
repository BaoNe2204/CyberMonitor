-- Xóa sạch lịch sử thanh toán và subscriptions
-- Chạy script này khi muốn reset dữ liệu thanh toán

USE CyberMonitor;
GO

-- Xóa tất cả payment orders
DELETE FROM PaymentOrders;
GO

-- Xóa tất cả subscriptions
DELETE FROM Subscriptions;
GO

-- Reset identity nếu muốn bắt đầu lại từ ID = 1
-- DBCC CHECKIDENT ('PaymentOrders', RESEED, 0);
-- DBCC CHECKIDENT ('Subscriptions', RESEED, 0);
-- GO

-- Kiểm tra kết quả
SELECT COUNT(*) AS TotalPaymentOrders FROM PaymentOrders;
SELECT COUNT(*) AS TotalSubscriptions FROM Subscriptions;
GO

PRINT 'Đã xóa sạch lịch sử thanh toán!';

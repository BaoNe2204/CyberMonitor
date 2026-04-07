-- ============================================================
-- Lịch sử giao dịch thanh toán - CyberMonitor SOC
-- Chạy trên database: CyberMonitor
-- ============================================================

USE CyberMonitor;
GO

-- ── 1. Xem toàn bộ lịch sử giao dịch ────────────────────────────────────────
SELECT
    po.OrderId          AS [Mã đơn hàng],
    t.CompanyName       AS [Công ty],
    po.PlanName         AS [Gói dịch vụ],
    FORMAT(po.Amount, 'N0') + ' VND'
                        AS [Số tiền],
    po.Currency         AS [Tiền tệ],
    po.Status           AS [Trạng thái],
    po.PaymentMethod    AS [Phương thức],
    po.VnpayTransactionNo AS [Mã GD VNPay],
    po.VnpayResponseCode  AS [Response Code],
    FORMAT(po.CreatedAt AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time', 'dd/MM/yyyy HH:mm:ss')
                        AS [Ngày tạo],
    FORMAT(po.PaidAt AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time', 'dd/MM/yyyy HH:mm:ss')
                        AS [Ngày thanh toán]
FROM PaymentOrders po
LEFT JOIN Tenants t ON t.Id = po.TenantId
ORDER BY po.CreatedAt DESC;
GO

-- ── 2. Thống kê theo trạng thái ──────────────────────────────────────────────
SELECT
    Status              AS [Trạng thái],
    COUNT(*)            AS [Số lượng],
    FORMAT(SUM(Amount), 'N0') + ' VND'
                        AS [Tổng tiền]
FROM PaymentOrders
GROUP BY Status
ORDER BY COUNT(*) DESC;
GO

-- ── 3. Thống kê doanh thu theo tháng ─────────────────────────────────────────
SELECT
    FORMAT(PaidAt, 'MM/yyyy')   AS [Tháng],
    COUNT(*)                    AS [Số giao dịch thành công],
    FORMAT(SUM(Amount), 'N0') + ' VND'
                                AS [Doanh thu]
FROM PaymentOrders
WHERE Status = 'Paid'
  AND PaidAt IS NOT NULL
GROUP BY FORMAT(PaidAt, 'MM/yyyy')
ORDER BY MIN(PaidAt) DESC;
GO

-- ── 4. Thống kê theo gói dịch vụ ─────────────────────────────────────────────
SELECT
    PlanName            AS [Gói dịch vụ],
    COUNT(*)            AS [Số lần mua],
    FORMAT(SUM(CASE WHEN Status = 'Paid' THEN Amount ELSE 0 END), 'N0') + ' VND'
                        AS [Doanh thu thực],
    COUNT(CASE WHEN Status = 'Paid'    THEN 1 END) AS [Thành công],
    COUNT(CASE WHEN Status = 'Failed'  THEN 1 END) AS [Thất bại],
    COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS [Đang chờ]
FROM PaymentOrders
GROUP BY PlanName
ORDER BY SUM(CASE WHEN Status = 'Paid' THEN Amount ELSE 0 END) DESC;
GO

-- ── 5. Giao dịch của một tenant cụ thể (thay TenantId) ───────────────────────
-- DECLARE @TenantId UNIQUEIDENTIFIER = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
-- SELECT * FROM PaymentOrders WHERE TenantId = @TenantId ORDER BY CreatedAt DESC;

-- ── 6. Insert demo data để test (chạy nếu bảng đang trống) ───────────────────
/*
DECLARE @TenantId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tenants ORDER BY CreatedAt);

IF NOT EXISTS (SELECT 1 FROM PaymentOrders)
BEGIN
    INSERT INTO PaymentOrders (Id, OrderId, TenantId, Amount, Currency, PlanName, Status, PaymentMethod, VnpayTransactionNo, VnpayResponseCode, CreatedAt, PaidAt)
    VALUES
    (NEWID(), 'ORD-20260401-DEMO01', @TenantId, 1290000, 'VND', 'Pro',          'Paid',    'VietQR',  NULL,         NULL, DATEADD(DAY,-30,GETUTCDATE()), DATEADD(DAY,-30,GETUTCDATE())),
    (NEWID(), 'ORD-20260402-DEMO02', @TenantId, 2990000, 'VND', 'Enterprise',   'Paid',    'VNPay',   '14123456789','00', DATEADD(DAY,-15,GETUTCDATE()), DATEADD(DAY,-15,GETUTCDATE())),
    (NEWID(), 'ORD-20260403-DEMO03', @TenantId,  490000, 'VND', 'Starter',      'Paid',    'VNPay',   '14123456790','00', DATEADD(DAY, -7,GETUTCDATE()), DATEADD(DAY, -7,GETUTCDATE())),
    (NEWID(), 'ORD-20260404-DEMO04', @TenantId, 1290000, 'VND', 'Pro',          'Failed',  'VNPay',   NULL,         '24', DATEADD(DAY, -3,GETUTCDATE()), NULL),
    (NEWID(), 'ORD-20260405-DEMO05', @TenantId, 2990000, 'VND', 'Enterprise',   'Pending', NULL,      NULL,         NULL, GETUTCDATE(),                  NULL);

    PRINT 'Inserted 5 demo payment records';
END
ELSE
BEGIN
    PRINT 'PaymentOrders already has data, skipping demo insert';
END
*/
GO

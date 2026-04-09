-- Add backend IP to whitelist (tenant-wide, all servers)
-- Thay 10.206.67.242 bằng IP backend thực tế của bạn

USE CyberMonitor;
GO

DECLARE @BackendIP NVARCHAR(50) = '10.206.67.242';

-- Kiểm tra xem đã có chưa
IF NOT EXISTS (
    SELECT 1 FROM Whitelists 
    WHERE IpAddress = @BackendIP 
    AND ServerId IS NULL  -- tenant-wide
)
BEGIN
    -- Lấy tenant đầu tiên (hoặc có thể chỉ định tenant cụ thể)
    DECLARE @TenantId UNIQUEIDENTIFIER;
    SELECT TOP 1 @TenantId = Id FROM Tenants;

    IF @TenantId IS NOT NULL
    BEGIN
        INSERT INTO Whitelists (Id, TenantId, ServerId, IpAddress, Description, IsActive, CreatedAt)
        VALUES (
            NEWID(),
            @TenantId,
            NULL,  -- NULL = áp dụng cho tất cả server trong tenant
            @BackendIP,
            'Backend Server - Auto-whitelisted to prevent self-blocking',
            1,
            GETUTCDATE()
        );
        PRINT 'Backend IP ' + @BackendIP + ' da duoc whitelist (tenant-wide)';
    END
    ELSE
    BEGIN
        PRINT 'Khong tim thay tenant nao. Vui long tao tenant truoc.';
    END
END
ELSE
BEGIN
    PRINT 'Backend IP ' + @BackendIP + ' da co trong whitelist roi.';
END
GO

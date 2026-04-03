-- ============================================
-- Seed AI Engine API Key vào CyberMonitor DB
-- ============================================
-- Hash SHA256 của: sk-ai-engine-secret-key-2026

USE CyberMonitor;
GO

-- Tìm tenant đầu tiên (hoặc SuperAdmin tenant)
DECLARE @TenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @TenantId = Id FROM Tenants;

IF @TenantId IS NULL
BEGIN
    PRINT 'ERROR: Không tìm thấy Tenant nào. Vui lòng chạy SeedData.sql trước.';
    RETURN;
END

-- Kiểm tra key đã tồn tại chưa
IF EXISTS (SELECT 1 FROM ApiKeys WHERE Name = 'AI Engine Service Key')
BEGIN
    PRINT 'AI Engine API Key đã tồn tại, bỏ qua.';
    RETURN;
END

INSERT INTO ApiKeys (Id, TenantId, ServerId, KeyHash, KeyPrefix, Name, Permissions, IsActive, ExpiresAt)
VALUES (
    NEWID(),
    @TenantId,
    NULL, -- AI Engine không gắn với server cụ thể
    '8d6b0bbd9b35a5555566baa5818c4249e0b8e39a458b816489ec48b307f74256', -- SHA256("sk-ai-engine-secret-key-2026")
    'sk_live_ai',
    'AI Engine Service Key',
    '{"ingest":false,"read":true,"write":true}', -- read logs + write alerts/block
    1,
    NULL -- Không hết hạn
);

PRINT 'AI Engine API Key đã được tạo thành công!';
PRINT 'Key: sk-ai-engine-secret-key-2026';
PRINT 'Hash: 8d6b0bbd9b35a5555566baa5818c4249e0b8e39a458b816489ec48b307f74256';
GO

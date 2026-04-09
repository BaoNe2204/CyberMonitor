-- Whitelist các IP quan trọng để tránh tự block
-- Chạy script này sau khi setup xong hệ thống

USE CyberMonitor;
GO

DECLARE @TenantId UNIQUEIDENTIFIER;
SELECT TOP 1 @TenantId = Id FROM Tenants;

IF @TenantId IS NULL
BEGIN
    PRINT 'ERROR: Khong tim thay tenant nao. Vui long tao tenant truoc.';
    RETURN;
END

-- Danh sách IP cần whitelist
DECLARE @WhitelistIPs TABLE (
    IpAddress NVARCHAR(50),
    Description NVARCHAR(255)
);

INSERT INTO @WhitelistIPs (IpAddress, Description) VALUES
    ('127.0.0.1', 'Localhost IPv4'),
    ('::1', 'Localhost IPv6'),
    ('10.206.67.242', 'Backend Server - CyberMonitor API'),
    ('10.206.67.0/24', 'Internal Network Range - Office/Lab'),
    ('localhost', 'Localhost hostname');

-- Thêm từng IP vào whitelist nếu chưa có
DECLARE @Ip NVARCHAR(50), @Desc NVARCHAR(255);
DECLARE ip_cursor CURSOR FOR SELECT IpAddress, Description FROM @WhitelistIPs;

OPEN ip_cursor;
FETCH NEXT FROM ip_cursor INTO @Ip, @Desc;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Whitelists WHERE IpAddress = @Ip AND TenantId = @TenantId)
    BEGIN
        INSERT INTO Whitelists (Id, TenantId, ServerId, IpAddress, Description, IsActive, CreatedAt)
        VALUES (NEWID(), @TenantId, NULL, @Ip, @Desc, 1, GETUTCDATE());
        
        PRINT 'Whitelist added: ' + @Ip + ' - ' + @Desc;
    END
    ELSE
    BEGIN
        PRINT 'Already whitelisted: ' + @Ip;
    END
    
    FETCH NEXT FROM ip_cursor INTO @Ip, @Desc;
END

CLOSE ip_cursor;
DEALLOCATE ip_cursor;

PRINT '';
PRINT 'Whitelist setup completed!';
PRINT 'Total whitelisted IPs: ' + CAST((SELECT COUNT(*) FROM Whitelists WHERE TenantId = @TenantId) AS NVARCHAR(10));
GO

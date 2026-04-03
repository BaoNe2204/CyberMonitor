-- ============================================
-- CyberMonitor - Seed Data
-- SQL Server 2022+
-- ============================================

USE CyberMonitor;
GO

-- ============================================
-- Cập nhật mật khẩu SuperAdmin
-- Password: CyberMonitor@2026 (BCrypt hash)
-- ============================================
IF EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@cybermonitor.vn')
BEGIN
    UPDATE Users
    SET PasswordHash = '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym'
    WHERE Email = 'admin@cybermonitor.vn' AND Role = 'SuperAdmin';
END
GO

-- ============================================
-- Seed: Tenant Demo - Công ty ABC
-- ============================================
DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @TenantUserId UNIQUEIDENTIFIER;
DECLARE @SubId UNIQUEIDENTIFIER;
DECLARE @ServerId UNIQUEIDENTIFIER;
DECLARE @ServerId2 UNIQUEIDENTIFIER;

-- Kiểm tra tenant đã tồn tại chưa
IF NOT EXISTS (SELECT 1 FROM Tenants WHERE Subdomain = 'abc-corp')
BEGIN
    SET @TenantId = NEWID();
    SET @TenantUserId = NEWID();
    SET @SubId = NEWID();
    SET @ServerId = NEWID();
    SET @ServerId2 = NEWID();

    -- Tạo Tenant
    INSERT INTO Tenants (Id, CompanyName, Subdomain, IsActive)
    VALUES (@TenantId, 'Công Ty TNHH ABC Việt Nam', 'abc-corp', 1);

    -- Tạo User Admin cho tenant
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, FullName, Role, IsActive)
    VALUES (
        @TenantUserId,
        @TenantId,
        'admin@abc-corp.vn',
        '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
        'Nguyễn Văn An',
        'Admin',
        1
    );

    -- Tạo User thường
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, FullName, Role, IsActive)
    VALUES (
        NEWID(),
        @TenantId,
        'user@abc-corp.vn',
        '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
        'Trần Thị Bình',
        'User',
        1
    );

    -- Tạo Subscription Pro (30 ngày)
    INSERT INTO Subscriptions (Id, TenantId, PlanName, PlanPrice, MaxServers, Status, StartDate, EndDate)
    VALUES (
        @SubId,
        @TenantId,
        'Pro',
        500000.00,
        10,
        'Active',
        GETUTCDATE(),
        DATEADD(DAY, 30, GETUTCDATE())
    );

    -- Tạo 2 Server demo
    INSERT INTO Servers (Id, TenantId, Name, IpAddress, ApiKeyHash, Status, OS, CpuUsage, RamUsage, DiskUsage, LastSeenAt)
    VALUES (
        @ServerId,
        @TenantId,
        'Web Kế Toán',
        '103.15.22.10',
        'sha256_hash_here_1',
        'Online',
        'Ubuntu 22.04 LTS',
        45.5,
        62.3,
        38.0,
        GETUTCDATE()
    );

    INSERT INTO Servers (Id, TenantId, Name, IpAddress, ApiKeyHash, Status, OS, CpuUsage, RamUsage, DiskUsage, LastSeenAt)
    VALUES (
        @ServerId2,
        @TenantId,
        'DB Master Server',
        '103.15.22.20',
        'sha256_hash_here_2',
        'Online',
        'CentOS 8',
        28.1,
        55.0,
        72.5,
        GETUTCDATE()
    );

    -- Tạo API Keys
    INSERT INTO ApiKeys (Id, TenantId, ServerId, KeyHash, KeyPrefix, Name, Permissions, IsActive)
    VALUES (
        NEWID(),
        @TenantId,
        @ServerId,
        'hashed_key_1',
        'sk_live_abcd',
        'API Key - Web Kế Toán',
        '{"ingest":true,"read":true,"write":false}',
        1
    );

    INSERT INTO ApiKeys (Id, TenantId, ServerId, KeyHash, KeyPrefix, Name, Permissions, IsActive)
    VALUES (
        NEWID(),
        @TenantId,
        @ServerId2,
        'hashed_key_2',
        'sk_live_efgh',
        'API Key - DB Master',
        '{"ingest":true,"read":true,"write":false}',
        1
    );

    -- Tạo Alerts mẫu
    INSERT INTO Alerts (Id, TenantId, ServerId, Severity, AlertType, Title, Description, SourceIp, TargetAsset, MitreTactic, MitreTechnique, Status, AnomalyScore, RecommendedAction)
    VALUES
        (NEWID(), @TenantId, @ServerId, 'High', 'DDoS', 'Phát hiện lưu lượng DDoS trên Web Kế Toán',
         'IP 1.1.1.1 đang gửi 10,000 request/giây vào server Web Kế Toán',
         '1.1.1.1', 'Web Kế Toán', 'Impact', 'T1498 - Network Denial of Service', 'Acknowledged', 0.95,
         'Cấu hình chặn IP 1.1.1.1 trên tường lửa, bật rate limiting'),

        (NEWID(), @TenantId, @ServerId2, 'Medium', 'BruteForce', 'Phát hiện đăng nhập thất bại nhiều lần',
         'IP 192.168.1.50 đã thử đăng nhập SSH thất bại 15 lần trong 5 phút',
         '192.168.1.50', 'DB Master Server', 'Credential Access', 'T1110 - Brute Force', 'Open', 0.72,
         'Cấu hình fail2ban, chặn IP nếu > 20 lần thất bại');

    -- Tạo Tickets mẫu
    DECLARE @AlertId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Alerts WHERE AlertType = 'DDoS');

    INSERT INTO Tickets (Id, TenantId, AlertId, TicketNumber, Title, Description, Priority, Status, Category, AssignedTo, CreatedBy)
    VALUES (
        NEWID(),
        @TenantId,
        @AlertId,
        'TK-20260403-0001',
        '[DDoS] Xử lý tấn công DDoS trên Web Kế Toán',
        'Server Web Kế Toán đang bị tấn công DDoS từ IP 1.1.1.1',
        'Critical',
        'IN_PROGRESS',
        'Security',
        @TenantUserId,
        @TenantUserId
    );

    -- Tạo Ticket Comments
    INSERT INTO TicketComments (Id, TicketId, UserId, Content, IsInternal)
    VALUES (
        NEWID(),
        (SELECT TOP 1 Id FROM Tickets),
        @TenantUserId,
        'Đã cấu hình chặn IP 1.1.1.1 trên tường lửa AWS Security Group',
        0
    );

    INSERT INTO TicketComments (Id, TicketId, UserId, Content, IsInternal)
    VALUES (
        NEWID(),
        (SELECT TOP 1 Id FROM Tickets),
        @TenantUserId,
        'Đã liên hệ ISP để upstream chặn traffic DDoS',
        1
    );

    -- Tạo Notifications
    INSERT INTO Notifications (Id, TenantId, UserId, Title, Message, Type, Link)
    VALUES
        (NEWID(), @TenantId, @TenantUserId, 'Cảnh báo DDoS mới!',
         'Phát hiện tấn công DDoS trên server Web Kế Toán',
         'Alert', '/dashboard/alerts'),

        (NEWID(), @TenantId, @TenantUserId, 'Cảnh báo Brute Force',
         'Phát hiện đăng nhập SSH thất bại nhiều lần trên DB Master',
         'Warning', '/dashboard/alerts');

    PRINT 'Seed data inserted successfully!';
END
ELSE
BEGIN
    PRINT 'Seed data already exists, skipping...';
END
GO

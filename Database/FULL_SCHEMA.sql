-- ================================================================
-- CyberMonitor - Complete Database Setup (FULL)
-- Ho tro: SQL Server 2019+, SQL Azure
-- Thu tu chay: 1) Tao DB  2) Chay file nay  3) Xong!
-- ================================================================

USE master;
GO

-- Tao database moi (xoa cu neu ton tai)
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'CyberMonitor')
BEGIN
    ALTER DATABASE CyberMonitor SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE CyberMonitor;
    PRINT 'Da xoa database cu: CyberMonitor';
END
GO

CREATE DATABASE CyberMonitor;
GO

USE CyberMonitor;
GO

-- ================================================================
-- PHAN 1: SCHEMA - TAO TAT CA CAC BANG
-- ================================================================

-- 1. TENANTS (Cong ty / Tenant)
CREATE TABLE Tenants (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CompanyName NVARCHAR(200) NOT NULL,
    Subdomain NVARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    IsActive BIT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IX_Tenants_Subdomain ON Tenants(Subdomain);

-- 2. USERS (Nguoi dung)
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NULL,
    Email NVARCHAR(255) NOT NULL,
    PasswordHash NVARCHAR(500) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Role NVARCHAR(50) NOT NULL DEFAULT N'User',
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastLoginAt DATETIME2 NULL,
    TwoFactorEnabled BIT NOT NULL DEFAULT 0,
    TwoFactorSecret NVARCHAR(MAX) NULL,
    SessionTimeoutEnabled BIT NOT NULL DEFAULT 0,
    SessionTimeoutMinutes INT NOT NULL DEFAULT 30,
    EmailAlertsEnabled BIT NOT NULL DEFAULT 1,
    TelegramAlertsEnabled BIT NOT NULL DEFAULT 0,
    PushNotificationsEnabled BIT NOT NULL DEFAULT 1,
    TelegramChatId NVARCHAR(100) NULL,
    AlertSeverityThreshold NVARCHAR(20) NOT NULL DEFAULT N'Medium',
    AlertDigestMode NVARCHAR(20) NOT NULL DEFAULT N'realtime',
    CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_TenantId ON Users(TenantId);

-- 3. SUBSCRIPTIONS (Goi cuoc)
CREATE TABLE Subscriptions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PlanName NVARCHAR(50) NOT NULL,
    PlanPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    MaxServers INT NOT NULL DEFAULT 1,
    Status NVARCHAR(50) NOT NULL DEFAULT N'Active',
    StartDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    EndDate DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Subscriptions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Subscriptions_TenantId ON Subscriptions(TenantId);

-- 4. PAYMENT_ORDERS (Don hang thanh toan)
CREATE TABLE PaymentOrders (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId NVARCHAR(100) NOT NULL,
    TenantId UNIQUEIDENTIFIER NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Currency NVARCHAR(10) NOT NULL DEFAULT N'VND',
    PlanName NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT N'Pending',
    VnpTxnRef NVARCHAR(100) NULL,
    VnpayTransactionNo NVARCHAR(100) NULL,
    VnpayResponseCode NVARCHAR(10) NULL,
    PaymentMethod NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    PaidAt DATETIME2 NULL,
    CONSTRAINT FK_PaymentOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IX_PaymentOrders_OrderId ON PaymentOrders(OrderId);
CREATE INDEX IX_PaymentOrders_TenantId ON PaymentOrders(TenantId);

-- 5. SERVERS (May chu)
CREATE TABLE Servers (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    IpAddress NVARCHAR(50) NOT NULL,
    ApiKeyHash NVARCHAR(500) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT N'Offline',
    OS NVARCHAR(100) NULL,
    CpuUsage DECIMAL(5,2) NOT NULL DEFAULT 0,
    RamUsage DECIMAL(5,2) NOT NULL DEFAULT 0,
    DiskUsage DECIMAL(5,2) NOT NULL DEFAULT 0,
    LastSeenAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Servers_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Servers_TenantId ON Servers(TenantId);

-- 6. API_KEYS (Khoa API)
CREATE TABLE ApiKeys (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ServerId UNIQUEIDENTIFIER NULL,
    KeyHash NVARCHAR(500) NOT NULL,
    KeyPrefix NVARCHAR(20) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Permissions NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
    LastUsedAt DATETIME2 NULL,
    ExpiresAt DATETIME2 NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ApiKeys_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL,
    CONSTRAINT FK_ApiKeys_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE SET NULL
);
CREATE INDEX IX_ApiKeys_ServerId ON ApiKeys(ServerId);
CREATE INDEX IX_ApiKeys_TenantId ON ApiKeys(TenantId);

-- 7. TRAFFIC_LOGS (Log mang)
CREATE TABLE TrafficLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ServerId UNIQUEIDENTIFIER NOT NULL,
    Timestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    SourceIp NVARCHAR(50) NOT NULL,
    DestinationIp NVARCHAR(50) NULL,
    SourcePort INT NULL,
    DestinationPort INT NULL,
    Protocol NVARCHAR(20) NULL,
    BytesIn BIGINT NOT NULL DEFAULT 0,
    BytesOut BIGINT NOT NULL DEFAULT 0,
    PacketsIn BIGINT NOT NULL DEFAULT 0,
    PacketsOut BIGINT NOT NULL DEFAULT 0,
    RequestCount INT NOT NULL DEFAULT 0,
    IsAnomaly BIT NOT NULL DEFAULT 0,
    AnomalyScore DECIMAL(5,4) NULL,
    RawPayload NVARCHAR(MAX) NULL,
    CONSTRAINT FK_TrafficLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TrafficLogs_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE CASCADE
);
CREATE INDEX IX_TrafficLogs_ServerId ON TrafficLogs(ServerId);
CREATE INDEX IX_TrafficLogs_TenantId_Time ON TrafficLogs(TenantId, Timestamp DESC);
CREATE INDEX IX_TrafficLogs_Anomaly ON TrafficLogs(TenantId, IsAnomaly, Timestamp DESC);

-- 8. ALERTS (Canh bao)
CREATE TABLE Alerts (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ServerId UNIQUEIDENTIFIER NULL,
    Severity NVARCHAR(20) NOT NULL DEFAULT N'Medium',
    AlertType NVARCHAR(100) NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    SourceIp NVARCHAR(50) NULL,
    TargetAsset NVARCHAR(200) NULL,
    MitreTactic NVARCHAR(100) NULL,
    MitreTechnique NVARCHAR(100) NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT N'Open',
    AnomalyScore DECIMAL(5,4) NULL,
    RecommendedAction NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    AcknowledgedAt DATETIME2 NULL,
    ResolvedAt DATETIME2 NULL,
    AcknowledgedBy UNIQUEIDENTIFIER NULL,
    ResolvedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_Alerts_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Alerts_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Alerts_AcknowledgedBy FOREIGN KEY (AcknowledgedBy) REFERENCES Users(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Alerts_ResolvedBy FOREIGN KEY (ResolvedBy) REFERENCES Users(Id) ON DELETE SET NULL
);
CREATE INDEX IX_Alerts_ServerId ON Alerts(ServerId);
CREATE INDEX IX_Alerts_TenantId_Created ON Alerts(TenantId, CreatedAt DESC);
CREATE INDEX IX_Alerts_TenantId_Status ON Alerts(TenantId, Status);
CREATE INDEX IX_Alerts_AcknowledgedBy ON Alerts(AcknowledgedBy);
CREATE INDEX IX_Alerts_ResolvedBy ON Alerts(ResolvedBy);

-- 9. AUDIT_LOGS (Nhat ky he thong)
CREATE TABLE AuditLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NULL,
    UserId UNIQUEIDENTIFIER NULL,
    Action NVARCHAR(200) NOT NULL,
    EntityType NVARCHAR(100) NULL,
    EntityId NVARCHAR(200) NULL,
    IpAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(500) NULL,
    Details NVARCHAR(MAX) NULL,
    Timestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
);
CREATE INDEX IX_AuditLogs_UserId ON AuditLogs(UserId);
CREATE INDEX IX_AuditLogs_TenantId_Time ON AuditLogs(TenantId, Timestamp DESC);

-- 10. NOTIFICATIONS (Thong bao)
CREATE TABLE Notifications (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Type NVARCHAR(50) NOT NULL DEFAULT N'Info',
    IsRead BIT NOT NULL DEFAULT 0,
    Link NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Notifications_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Notifications_TenantId ON Notifications(TenantId);
CREATE INDEX IX_Notifications_UserId_Unread ON Notifications(UserId, IsRead);

-- 11. TICKETS (Phieu su co)
CREATE TABLE Tickets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    AlertId UNIQUEIDENTIFIER NULL,
    TicketNumber NVARCHAR(50) NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Priority NVARCHAR(20) NOT NULL DEFAULT N'Medium',
    Status NVARCHAR(50) NOT NULL DEFAULT N'Open',
    Category NVARCHAR(100) NULL,
    AssignedTo UNIQUEIDENTIFIER NULL,
    AssignedBy UNIQUEIDENTIFIER NULL,
    CreatedBy UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    DueDate DATETIME2 NULL,
    ResolvedAt DATETIME2 NULL,
    ClosedAt DATETIME2 NULL,
    CONSTRAINT FK_Tickets_Alerts FOREIGN KEY (AlertId) REFERENCES Alerts(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Tickets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tickets_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Tickets_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES Users(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Tickets_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IX_Tickets_TicketNumber ON Tickets(TicketNumber);
CREATE INDEX IX_Tickets_AlertId ON Tickets(AlertId);
CREATE INDEX IX_Tickets_TenantId_Status ON Tickets(TenantId, Status);
CREATE INDEX IX_Tickets_AssignedBy ON Tickets(AssignedBy);
CREATE INDEX IX_Tickets_AssignedTo ON Tickets(AssignedTo);
CREATE INDEX IX_Tickets_CreatedBy ON Tickets(CreatedBy);

-- 12. TICKET_COMMENTS (Binh luan phieu)
CREATE TABLE TicketComments (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TicketId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    IsInternal BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_TicketComments_Tickets FOREIGN KEY (TicketId) REFERENCES Tickets(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TicketComments_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX IX_TicketComments_TicketId ON TicketComments(TicketId);
CREATE INDEX IX_TicketComments_UserId ON TicketComments(UserId);

-- 13. BLOCKED_IPS (IP bi chan)
CREATE TABLE BlockedIPs (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NULL,
    ServerId UNIQUEIDENTIFIER NULL,
    IpAddress NVARCHAR(45) NOT NULL,
    AttackType NVARCHAR(100) NOT NULL,
    Severity NVARCHAR(50) NOT NULL DEFAULT N'Medium',
    AnomalyScore DECIMAL(18,2) NULL,
    Reason NVARCHAR(500) NULL,
    BlockedBy NVARCHAR(100) NOT NULL DEFAULT N'AI-Engine',
    BlockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiresAt DATETIME2 NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    UnblockedAt DATETIME2 NULL,
    UnblockedBy NVARCHAR(100) NULL,
    Evidence NVARCHAR(500) NULL,
    CONSTRAINT FK_BlockedIPs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL,
    CONSTRAINT FK_BlockedIPs_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE NO ACTION
);
CREATE INDEX IX_BlockedIPs_IpAddress ON BlockedIPs(IpAddress);
CREATE INDEX IX_BlockedIPs_TenantId_Active ON BlockedIPs(TenantId, IsActive);
CREATE INDEX IX_BlockedIPs_ServerId ON BlockedIPs(ServerId);

-- 14. SERVER_ALERT_EMAILS (Email nhan canh bao theo server)
CREATE TABLE ServerAlertEmails (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ServerId UNIQUEIDENTIFIER NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ServerAlertEmails_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IX_ServerAlertEmails_ServerId_Email ON ServerAlertEmails(ServerId, Email);

-- 15. SERVER_TELEGRAM_RECIPIENTS (Telegram nhan canh bao)
CREATE TABLE ServerTelegramRecipients (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ServerId UNIQUEIDENTIFIER NOT NULL,
    ChatId NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(200) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ServerTelegramRecipients_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IX_ServerTelegramRecipients_ServerId_ChatId ON ServerTelegramRecipients(ServerId, ChatId);

-- 16. ALERT_DIGEST_QUEUE (Hang doi tong hop canh bao)
CREATE TABLE AlertDigestQueue (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    TelegramChatId NVARCHAR(100) NOT NULL,
    DigestMode NVARCHAR(20) NOT NULL DEFAULT N'hourly',
    AlertId UNIQUEIDENTIFIER NULL,
    Severity NVARCHAR(20) NULL,
    AlertTitle NVARCHAR(500) NULL,
    AlertMessage NVARCHAR(MAX) NULL,
    AlertCreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    IsSent BIT NOT NULL DEFAULT 0,
    SentAt DATETIME2 NULL,
    QueuedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_AlertDigestQueue_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_AlertDigestQueue_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_AlertDigestQueue_Alerts FOREIGN KEY (AlertId) REFERENCES Alerts(Id) ON DELETE SET NULL
);
CREATE INDEX IX_AlertDigestQueue_UserId_Mode_Sent ON AlertDigestQueue(UserId, DigestMode, IsSent);
CREATE INDEX IX_AlertDigestQueue_Mode_Sent_Queued ON AlertDigestQueue(DigestMode, IsSent, QueuedAt);
CREATE INDEX IX_AlertDigestQueue_TenantId ON AlertDigestQueue(TenantId);
CREATE INDEX IX_AlertDigestQueue_AlertId ON AlertDigestQueue(AlertId);

-- 17. PRICING_PLANS (Goi gia)
CREATE TABLE PricingPlans (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    Price DECIMAL(18,0) NOT NULL DEFAULT 0,
    OriginalPrice DECIMAL(18,0) NULL,
    BillingPeriod NVARCHAR(20) NOT NULL DEFAULT N'monthly',
    Servers INT NOT NULL DEFAULT 1,
    Users INT NOT NULL DEFAULT 1,
    Storage NVARCHAR(20) NOT NULL DEFAULT N'1 GB',
    Bandwidth NVARCHAR(20) NOT NULL DEFAULT N'100 GB',
    ApiCalls INT NOT NULL DEFAULT 1000,
    DailyAlerts INT NOT NULL DEFAULT 100,
    Retention NVARCHAR(20) NOT NULL DEFAULT N'7 days',
    ConcurrentConnections INT NOT NULL DEFAULT 10,
    RealTimeMonitoring BIT NOT NULL DEFAULT 1,
    ThreatIntelligence BIT NOT NULL DEFAULT 0,
    AutoResponse BIT NOT NULL DEFAULT 0,
    CustomRules BIT NOT NULL DEFAULT 0,
    WhiteLabel BIT NOT NULL DEFAULT 0,
    PrioritySupport BIT NOT NULL DEFAULT 0,
    Sla NVARCHAR(10) NOT NULL DEFAULT N'99%',
    BackupFrequency NVARCHAR(20) NOT NULL DEFAULT N'Daily',
    TeamManagement BIT NOT NULL DEFAULT 0,
    AuditLogs BIT NOT NULL DEFAULT 1,
    ApiAccess BIT NOT NULL DEFAULT 1,
    Sso BIT NOT NULL DEFAULT 0,
    CustomIntegrations BIT NOT NULL DEFAULT 0,
    DedicatedSupport BIT NOT NULL DEFAULT 0,
    SlaCredits BIT NOT NULL DEFAULT 0,
    Features NVARCHAR(2000) NULL DEFAULT N'[]',
    IsActive BIT NOT NULL DEFAULT 1,
    IsPopular BIT NOT NULL DEFAULT 0,
    IsEnterprise BIT NOT NULL DEFAULT 0,
    IsTrial BIT NOT NULL DEFAULT 0,
    SortOrder INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- 18. WHITELISTS (IP duoc phep)
CREATE TABLE Whitelists (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NULL,
    IpAddress NVARCHAR(50) NOT NULL,
    Description NVARCHAR(255) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Whitelists_TenantId ON Whitelists(TenantId);
CREATE INDEX IX_Whitelists_IpAddress ON Whitelists(IpAddress);

-- 19. EF MIGRATIONS HISTORY
CREATE TABLE __EFMigrationsHistory (
    MigrationId NVARCHAR(150) NOT NULL PRIMARY KEY,
    ProductVersion NVARCHAR(32) NOT NULL
);
INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
VALUES ('20260403141504_AddBlockedIPs', '8.0.4'),
       ('20260407184440_AddWhitelists', '8.0.11');

-- ================================================================
-- PHAN 2: PERFORMANCE INDEXES (Toi uu hieu nang)
-- ================================================================

-- Alerts: loc theo tenant + status + created (report/dashboard)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Alerts_TenantId_Status_CreatedAt' AND object_id = OBJECT_ID('dbo.Alerts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Alerts_TenantId_Status_CreatedAt
    ON dbo.Alerts (TenantId, Status, CreatedAt DESC)
    INCLUDE (Severity, AlertType, SourceIp, MitreTechnique, ServerId);
    PRINT 'Index IX_Alerts_TenantId_Status_CreatedAt da tao';
END

-- Alerts: MITRE technique grouping
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Alerts_TenantId_MitreTechnique' AND object_id = OBJECT_ID('dbo.Alerts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Alerts_TenantId_MitreTechnique
    ON dbo.Alerts (TenantId, MitreTechnique)
    INCLUDE (Severity, CreatedAt, AlertType)
    WHERE MitreTechnique IS NOT NULL;
    PRINT 'Index IX_Alerts_TenantId_MitreTechnique da tao';
END

-- Tickets: dong hom nay + report
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_ClosedAt' AND object_id = OBJECT_ID('dbo.Tickets'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Tickets_ClosedAt
    ON dbo.Tickets (ClosedAt DESC)
    INCLUDE (TenantId, Status, Priority, CreatedAt)
    WHERE ClosedAt IS NOT NULL;
    PRINT 'Index IX_Tickets_ClosedAt da tao';
END

-- Servers: loc + hien thi
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Servers_TenantId_Status' AND object_id = OBJECT_ID('dbo.Servers'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Servers_TenantId_Status
    ON dbo.Servers (TenantId, Status)
    INCLUDE (Name, IpAddress, CpuUsage, RamUsage, DiskUsage, LastSeenAt, CreatedAt);
    PRINT 'Index IX_Servers_TenantId_Status da tao';
END

-- Notifications: loc nguoi dung + thoi gian
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_UserId_CreatedAt' AND object_id = OBJECT_ID('dbo.Notifications'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_UserId_CreatedAt
    ON dbo.Notifications (UserId, CreatedAt DESC)
    INCLUDE (IsRead, Type, Title, Link);
    PRINT 'Index IX_Notifications_UserId_CreatedAt da tao';
END

UPDATE STATISTICS dbo.Alerts WITH FULLSCAN;
UPDATE STATISTICS dbo.Tickets WITH FULLSCAN;
UPDATE STATISTICS dbo.TrafficLogs WITH FULLSCAN;
UPDATE STATISTICS dbo.Servers WITH FULLSCAN;
UPDATE STATISTICS dbo.Notifications WITH FULLSCAN;

-- ================================================================
-- PHAN 3: SEED DATA
-- ================================================================

-- 3.1 SUPER ADMIN
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@cybermonitor.vn' AND Role = 'SuperAdmin')
BEGIN
    INSERT INTO Users (
        Id, Email, PasswordHash, FullName, Role, IsActive, TwoFactorEnabled, CreatedAt,
        AlertDigestMode, AlertSeverityThreshold, EmailAlertsEnabled, PushNotificationsEnabled,
        TelegramAlertsEnabled, SessionTimeoutEnabled, SessionTimeoutMinutes
    )
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'admin@cybermonitor.vn',
        '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
        'Super Administrator',
        'SuperAdmin',
        1, 0,
        '2026-01-01T00:00:00.000Z',
        'realtime',
        'Medium',
        1, 1, 0, 0, 30
    );
    PRINT 'SuperAdmin da tao: admin@cybermonitor.vn / CyberMonitor@2026';
END
ELSE
    PRINT 'SuperAdmin da ton tai, bo qua.';

-- 3.2 PRICING PLANS
IF NOT EXISTS (SELECT 1 FROM PricingPlans)
BEGIN
    INSERT INTO PricingPlans (Id, Name, Description, Price, BillingPeriod, Servers, Users, Storage, Bandwidth,
        ApiCalls, DailyAlerts, Retention, ConcurrentConnections, RealTimeMonitoring, ThreatIntelligence,
        AutoResponse, CustomRules, TeamManagement, AuditLogs, ApiAccess, Sla, BackupFrequency,
        Features, IsActive, IsPopular, IsEnterprise, IsTrial, SortOrder, CreatedAt, UpdatedAt)
    VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        N'Miễn Phí', N'Dành cho người dùng mới, không cần thanh toán', 0, N'monthly',
        1, 1, N'1 GB', N'10 GB', 100, 10, N'7 days', 5,
        1, 0, 0, 0, 0, 1, 1, N'90%', N'None',
        N'["Real-time monitoring","Basic alerts","1 Server","Email support","API Access"]',
        1, 0, 0, 1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        N'Starter', N'Cho cá nhân hoặc nhóm nhỏ', 299000, N'monthly',
        3, 5, N'10 GB', N'100 GB', 5000, 100, N'14 days', 20,
        1, 0, 0, 0, 0, 1, 1, N'99%', N'Daily',
        N'["Everything in Free","3 Servers","5 Users","Daily reports","Email support","Priority alerts"]',
        1, 1, 0, 0, 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        N'Professional', N'Cho doanh nghiệp vừa và nhỏ', 799000, N'monthly',
        10, 20, N'50 GB', N'500 GB', 50000, 500, N'30 days', 50,
        1, 1, 1, 1, 1, 1, 1, N'99.9%', N'Hourly',
        N'["Everything in Starter","10 Servers","20 Users","Auto-response","Custom rules","Threat intelligence","Team management","24/7 support"]',
        1, 0, 0, 0, 3, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        N'Enterprise', N'Cho tổ chức lớn', 1999000, N'monthly',
        50, 100, N'200 GB', N'2 TB', 200000, 2000, N'90 days', 200,
        1, 1, 1, 1, 1, 1, 1, N'99.99%', N'Realtime',
        N'["Everything in Professional","50 Servers","100 Users","SSO","Custom integrations","Dedicated support","SLA credits","White-label"]',
        1, 0, 1, 0, 4, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    );
    PRINT '4 PricingPlans da tao';
END
ELSE
    PRINT 'PricingPlans da co du lieu, bo qua.';

-- 3.3 DEMO TENANT (ABC Corp)
DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @AdminUserId UNIQUEIDENTIFIER;
DECLARE @SubId UNIQUEIDENTIFIER;
DECLARE @Server1Id UNIQUEIDENTIFIER;
DECLARE @Server2Id UNIQUEIDENTIFIER;

IF NOT EXISTS (SELECT 1 FROM Tenants WHERE Subdomain = 'abc-corp')
BEGIN
    SET @TenantId = NEWID();
    SET @AdminUserId = NEWID();
    SET @SubId = NEWID();
    SET @Server1Id = NEWID();
    SET @Server2Id = NEWID();

    -- Tenant
    INSERT INTO Tenants (Id, CompanyName, Subdomain, IsActive)
    VALUES (@TenantId, N'Công Ty TNHH ABC Việt Nam', 'abc-corp', 1);

    -- Users
    INSERT INTO Users (Id, TenantId, Email, PasswordHash, FullName, Role, IsActive,
        AlertDigestMode, AlertSeverityThreshold, EmailAlertsEnabled, PushNotificationsEnabled)
    VALUES
        (@AdminUserId, @TenantId, 'admin@abc-corp.vn',
         '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
         N'Nguyễn Văn An', 'Admin', 1, 'realtime', 'Medium', 1, 1),
        (NEWID(), @TenantId, 'user@abc-corp.vn',
         '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
         N'Trần Thị Bình', 'User', 1, 'realtime', 'High', 1, 1);

    -- Subscription
    INSERT INTO Subscriptions (Id, TenantId, PlanName, PlanPrice, MaxServers, Status, StartDate, EndDate)
    VALUES (@SubId, @TenantId, 'Professional', 799000.00, 10, 'Active', GETUTCDATE(), DATEADD(DAY, 30, GETUTCDATE()));

    -- Servers
    INSERT INTO Servers (Id, TenantId, Name, IpAddress, ApiKeyHash, Status, OS, CpuUsage, RamUsage, DiskUsage, LastSeenAt)
    VALUES
        (@Server1Id, @TenantId, 'Web Kế Toán', '103.15.22.10', 'sha256_hash_1', 'Online', 'Ubuntu 22.04 LTS', 45.5, 62.3, 38.0, GETUTCDATE()),
        (@Server2Id, @TenantId, 'DB Master Server', '103.15.22.20', 'sha256_hash_2', 'Online', 'CentOS 8', 28.1, 55.0, 72.5, GETUTCDATE());

    -- API Keys
    INSERT INTO ApiKeys (Id, TenantId, ServerId, KeyHash, KeyPrefix, Name, Permissions, IsActive)
    VALUES
        (NEWID(), @TenantId, @Server1Id, 'hashed_key_1', 'sk_live_abcd', 'API Key - Web Kế Toán', '{"ingest":true,"read":true,"write":false}', 1),
        (NEWID(), @TenantId, @Server2Id, 'hashed_key_2', 'sk_live_efgh', 'API Key - DB Master', '{"ingest":true,"read":true,"write":false}', 1);

    -- Demo Alerts
    INSERT INTO Alerts (Id, TenantId, ServerId, Severity, AlertType, Title, Description, SourceIp, TargetAsset,
        MitreTactic, MitreTechnique, Status, AnomalyScore, RecommendedAction)
    VALUES
        (NEWID(), @TenantId, @Server1Id, 'High', 'DDoS',
         N'Phát hiện lưu lượng DDoS trên Web Kế Toán',
         N'IP 1.1.1.1 đang gửi 10,000 request/giây vào server Web Kế Toán',
         '1.1.1.1', 'Web Kế Toán', 'Impact', 'T1498 - Network Denial of Service',
         'Acknowledged', 0.95,
         N'Cấu hình chặn IP 1.1.1.1 trên tường lửa, bật rate limiting'),
        (NEWID(), @TenantId, @Server2Id, 'Medium', 'BruteForce',
         N'Phát hiện đăng nhập SSH thất bại nhiều lần',
         N'IP 192.168.1.50 đã thử đăng nhập SSH thất bại 15 lần trong 5 phút',
         '192.168.1.50', 'DB Master Server', 'Credential Access', 'T1110 - Brute Force',
         'Open', 0.72,
         N'Cấu hình fail2ban, chặn IP nếu > 20 lần thất bại');

    -- Demo Tickets
    DECLARE @AlertId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Alerts WHERE AlertType = 'DDoS');

    INSERT INTO Tickets (Id, TenantId, AlertId, TicketNumber, Title, Description, Priority, Status, Category, AssignedTo, CreatedBy)
    VALUES (NEWID(), @TenantId, @AlertId, 'TK-20260403-0001',
            N'[DDoS] Xử lý tấn công DDoS trên Web Kế Toán',
            N'Server Web Kế Toán đang bị tấn công DDoS từ IP 1.1.1.1',
            'Critical', 'IN_PROGRESS', 'Security', @AdminUserId, @AdminUserId);

    -- Ticket Comments
    DECLARE @TicketId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Tickets);
    INSERT INTO TicketComments (Id, TicketId, UserId, Content, IsInternal)
    VALUES
        (NEWID(), @TicketId, @AdminUserId, N'Đã cấu hình chặn IP 1.1.1.1 trên tường lửa AWS Security Group', 0),
        (NEWID(), @TicketId, @AdminUserId, N'Đã liên hệ ISP để upstream chặn traffic DDoS', 1);

    -- Notifications
    INSERT INTO Notifications (Id, TenantId, UserId, Title, Message, Type, Link)
    VALUES
        (NEWID(), @TenantId, @AdminUserId, N'Cảnh báo DDoS mới!',
         N'Phát hiện tấn công DDoS trên server Web Kế Toán', 'Alert', '/dashboard/alerts'),
        (NEWID(), @TenantId, @AdminUserId, N'Cảnh báo Brute Force',
         N'Phát hiện đăng nhập SSH thất bại nhiều lần trên DB Master', 'Warning', '/dashboard/alerts');

    PRINT 'Demo tenant (ABC Corp) da tao';
END
ELSE
    PRINT 'Demo tenant da ton tai, bo qua.';

-- 3.4 AI ENGINE API KEY
IF NOT EXISTS (SELECT 1 FROM ApiKeys WHERE Name = 'AI Engine Service Key')
BEGIN
    DECLARE @AiTenantId UNIQUEIDENTIFIER;
    SELECT TOP 1 @AiTenantId = Id FROM Tenants;
    IF @AiTenantId IS NOT NULL
    BEGIN
        INSERT INTO ApiKeys (Id, TenantId, ServerId, KeyHash, KeyPrefix, Name, Permissions, IsActive, ExpiresAt)
        VALUES (
            NEWID(), @AiTenantId, NULL,
            '8d6b0bbd9b35a5555566baa5818c4249e0b8e39a458b816489ec48b307f74256',
            'sk_live_ai',
            'AI Engine Service Key',
            '{"ingest":false,"read":true,"write":true}',
            1, NULL
        );
        PRINT 'AI Engine API Key da tao: sk-ai-engine-secret-key-2026';
    END
END
ELSE
    PRINT 'AI Engine API Key da ton tai, bo qua.';

-- 3.5 DEMO PAYMENT ORDERS (neu chua co)
IF NOT EXISTS (SELECT 1 FROM PaymentOrders)
BEGIN
    DECLARE @PayTenantId UNIQUEIDENTIFIER;
    SELECT TOP 1 @PayTenantId = Id FROM Tenants;
    IF @PayTenantId IS NOT NULL
    BEGIN
        INSERT INTO PaymentOrders (Id, OrderId, TenantId, Amount, Currency, PlanName, Status, PaymentMethod, VnpayTransactionNo, VnpayResponseCode, CreatedAt, PaidAt)
        VALUES
            (NEWID(), 'ORD-20260401-DEMO01', @PayTenantId, 1290000, 'VND', 'Pro',        'Paid',    'VietQR', NULL,         NULL, DATEADD(DAY,-30,GETUTCDATE()), DATEADD(DAY,-30,GETUTCDATE())),
            (NEWID(), 'ORD-20260402-DEMO02', @PayTenantId, 2990000, 'VND', 'Enterprise', 'Paid',    'VNPay',  '14123456789','00', DATEADD(DAY,-15,GETUTCDATE()), DATEADD(DAY,-15,GETUTCDATE())),
            (NEWID(), 'ORD-20260403-DEMO03', @PayTenantId,  490000, 'VND', 'Starter',    'Paid',    'VNPay',  '14123456790','00', DATEADD(DAY, -7,GETUTCDATE()), DATEADD(DAY, -7,GETUTCDATE())),
            (NEWID(), 'ORD-20260404-DEMO04', @PayTenantId, 1290000, 'VND', 'Pro',        'Failed',  'VNPay',  NULL,         '24', DATEADD(DAY, -3,GETUTCDATE()), NULL),
            (NEWID(), 'ORD-20260405-DEMO05', @PayTenantId, 2990000, 'VND', 'Enterprise', 'Pending', NULL,     NULL,         NULL, GETUTCDATE(),                  NULL);
        PRINT '5 demo PaymentOrders da tao';
    END
END
ELSE
    PRINT 'PaymentOrders da co du lieu, bo qua.';

-- ================================================================
-- KET THUC
-- ================================================================
PRINT '';
PRINT '============================================================';
PRINT ' Database CyberMonitor da duoc khoi tao HOAN CHINH!';
PRINT '============================================================';
PRINT '';
PRINT ' Tai khoan SuperAdmin:';
PRINT '   Email:    admin@cybermonitor.vn';
PRINT '   Password: CyberMonitor@2026';
PRINT '';
PRINT ' Demo tenant (ABC Corp):';
PRINT '   Email:    admin@abc-corp.vn';
PRINT '   Password: CyberMonitor@2026';
PRINT '';
PRINT ' AI Engine Key:';
PRINT '   sk-ai-engine-secret-key-2026';
PRINT '';
PRINT '============================================================';
GO

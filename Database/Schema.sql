-- ============================================
-- CyberMonitor - Database Schema
-- SQL Server 2022+
-- ============================================

-- ============================================
-- 1. TENANTS (Workspace / Công ty)
-- ============================================
CREATE TABLE Tenants (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CompanyName NVARCHAR(200) NOT NULL,
    Subdomain NVARCHAR(100) UNIQUE NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    IsActive BIT DEFAULT 1
);

-- ============================================
-- 2. USERS (Người dùng - 3 vai trò)
-- ============================================
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NULL,  -- NULL = super admin hệ thống
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Role NVARCHAR(50) NOT NULL CHECK (Role IN ('SuperAdmin', 'Admin', 'User')),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    LastLoginAt DATETIME2 NULL,
    TwoFactorEnabled BIT DEFAULT 0,
    TwoFactorSecret NVARCHAR(500) NULL,
    CONSTRAINT FK_Users_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL
);

CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_TenantId ON Users(TenantId);

-- ============================================
-- 3. SUBSCRIPTIONS (Gói cước)
-- ============================================
CREATE TABLE Subscriptions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PlanName NVARCHAR(50) NOT NULL,  -- Starter, Pro, Enterprise
    PlanPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    MaxServers INT NOT NULL DEFAULT 1,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Trial',  -- Trial, Active, Expired, Cancelled
    StartDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    EndDate DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Subscriptions_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
);

CREATE INDEX IX_Subscriptions_TenantId ON Subscriptions(TenantId);

-- ============================================
-- 4. PAYMENT_ORDERS (Đơn hàng & thanh toán)
-- ============================================
CREATE TABLE PaymentOrders (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId VARCHAR(100) UNIQUE NOT NULL,  -- Mã đơn hàng
    TenantId UNIQUEIDENTIFIER NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Currency NVARCHAR(10) DEFAULT 'VND',
    PlanName NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',  -- Pending, Paid, Failed, Refunded
    VnpTxnRef VARCHAR(100) NULL,  -- VNPay transaction reference
    VnpayTransactionNo VARCHAR(100) NULL,
    VnpayResponseCode VARCHAR(10) NULL,
    PaymentMethod NVARCHAR(50) NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    PaidAt DATETIME2 NULL,
    CONSTRAINT FK_PaymentOrders_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE SET NULL
);

CREATE INDEX IX_PaymentOrders_OrderId ON PaymentOrders(OrderId);

-- ============================================
-- 5. SERVERS (Máy chủ cần bảo vệ)
-- ============================================
CREATE TABLE Servers (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    IpAddress NVARCHAR(50) NOT NULL,
    ApiKeyHash NVARCHAR(500) NOT NULL,  -- Hash của API Key
    Status NVARCHAR(50) NOT NULL DEFAULT 'Offline',  -- Online, Offline, Warning
    OS NVARCHAR(100) NULL,
    CpuUsage DECIMAL(5,2) DEFAULT 0,
    RamUsage DECIMAL(5,2) DEFAULT 0,
    DiskUsage DECIMAL(5,2) DEFAULT 0,
    LastSeenAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Servers_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE
);

CREATE INDEX IX_Servers_TenantId ON Servers(TenantId);
CREATE INDEX IX_Servers_ApiKeyHash ON Servers(ApiKeyHash);

-- ============================================
-- 6. API_KEYS (Khóa API cho Agent)
-- ============================================
CREATE TABLE ApiKeys (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ServerId UNIQUEIDENTIFIER NULL,
    KeyHash NVARCHAR(500) NOT NULL,
    KeyPrefix NVARCHAR(20) NOT NULL,  -- sk_live_xxxx
    Name NVARCHAR(200) NOT NULL,
    Permissions NVARCHAR(MAX) DEFAULT '{"ingest":true,"read":false,"write":false}',
    LastUsedAt DATETIME2 NULL,
    ExpiresAt DATETIME2 NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ApiKeys_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ApiKeys_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE SET NULL
);

CREATE INDEX IX_ApiKeys_TenantId ON ApiKeys(TenantId);

-- ============================================
-- 7. TRAFFIC_LOGS (Log mạng từ Agent)
-- ============================================
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
    BytesIn BIGINT DEFAULT 0,
    BytesOut BIGINT DEFAULT 0,
    PacketsIn BIGINT DEFAULT 0,
    PacketsOut BIGINT DEFAULT 0,
    RequestCount INT DEFAULT 1,
    IsAnomaly BIT DEFAULT 0,
    AnomalyScore DECIMAL(5,4) NULL,  -- 0.0000 - 1.0000
    RawPayload NVARCHAR(MAX) NULL,
    CONSTRAINT FK_TrafficLogs_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TrafficLogs_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE CASCADE
);

CREATE INDEX IX_TrafficLogs_TenantId_Time ON TrafficLogs(TenantId, Timestamp DESC);
CREATE INDEX IX_TrafficLogs_ServerId_Time ON TrafficLogs(ServerId, Timestamp DESC);
CREATE INDEX IX_TrafficLogs_Anomaly ON TrafficLogs(TenantId, IsAnomaly, Timestamp DESC);

-- ============================================
-- 8. ALERTS (Cảnh báo bảo mật)
-- ============================================
CREATE TABLE Alerts (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ServerId UNIQUEIDENTIFIER NULL,
    Severity NVARCHAR(20) NOT NULL CHECK (Severity IN ('Low', 'Medium', 'High', 'Critical')),
    AlertType NVARCHAR(100) NOT NULL,  -- DDoS, BruteForce, PortScan, Malware, Anomaly, etc.
    Title NVARCHAR(500) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    SourceIp NVARCHAR(50) NULL,
    TargetAsset NVARCHAR(200) NULL,
    MitreTactic NVARCHAR(100) NULL,
    MitreTechnique NVARCHAR(100) NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Open',  -- Open, Acknowledged, Investigating, Resolved, FalsePositive
    AnomalyScore DECIMAL(5,4) NULL,
    RecommendedAction NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    AcknowledgedAt DATETIME2 NULL,
    ResolvedAt DATETIME2 NULL,
    AcknowledgedBy UNIQUEIDENTIFIER NULL,
    ResolvedBy UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_Alerts_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Alerts_Servers FOREIGN KEY (ServerId) REFERENCES Servers(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Alerts_AcknowledgedBy FOREIGN KEY (AcknowledgedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Alerts_ResolvedBy FOREIGN KEY (ResolvedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Alerts_TenantId_Status ON Alerts(TenantId, Status);
CREATE INDEX IX_Alerts_TenantId_Created ON Alerts(TenantId, CreatedAt DESC);
CREATE INDEX IX_Alerts_Severity ON Alerts(Severity, CreatedAt DESC);

-- ============================================
-- 9. TICKETS (Phiếu sự cố)
-- ============================================
CREATE TABLE Tickets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    AlertId UNIQUEIDENTIFIER NULL,
    TicketNumber VARCHAR(50) NOT NULL UNIQUE,  -- TK-20260403-0001
    Title NVARCHAR(500) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Priority NVARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (Priority IN ('Low', 'Medium', 'High', 'Critical')),
    Status NVARCHAR(50) NOT NULL DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED
    Category NVARCHAR(100) NULL,  -- Security, Network, System, Application
    AssignedTo UNIQUEIDENTIFIER NULL,
    AssignedBy UNIQUEIDENTIFIER NULL,
    CreatedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    DueDate DATETIME2 NULL,
    ResolvedAt DATETIME2 NULL,
    ClosedAt DATETIME2 NULL,
    CONSTRAINT FK_Tickets_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tickets_AlertId FOREIGN KEY (AlertId) REFERENCES Alerts(Id) ON DELETE SET NULL,
    CONSTRAINT FK_Tickets_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES Users(Id),
    CONSTRAINT FK_Tickets_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Tickets_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Tickets_TenantId_Status ON Tickets(TenantId, Status);
CREATE INDEX IX_Tickets_TenantId_Created ON Tickets(TenantId, CreatedAt DESC);
CREATE INDEX IX_Tickets_AssignedTo ON Tickets(AssignedTo);

-- ============================================
-- 10. TICKET_COMMENTS (Bình luận phiếu sự cố)
-- ============================================
CREATE TABLE TicketComments (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TicketId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    IsInternal BIT DEFAULT 0,  -- Internal notes not visible to customers
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_TicketComments_Tickets FOREIGN KEY (TicketId) REFERENCES Tickets(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TicketComments_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_TicketComments_TicketId ON TicketComments(TicketId);

-- ============================================
-- 11. AUDIT_LOGS (Nhật ký hệ thống)
-- ============================================
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
    Timestamp DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
);

CREATE INDEX IX_AuditLogs_TenantId_Time ON AuditLogs(TenantId, Timestamp DESC);
CREATE INDEX IX_AuditLogs_UserId ON AuditLogs(UserId);

-- ============================================
-- 12. NOTIFICATIONS (Thông báo)
-- ============================================
CREATE TABLE Notifications (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Type NVARCHAR(50) NOT NULL DEFAULT 'Info',  -- Info, Warning, Alert, Success
    IsRead BIT DEFAULT 0,
    Link NVARCHAR(500) NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Notifications_Tenants FOREIGN KEY (TenantId) REFERENCES Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_Notifications_UserId_Unread ON Notifications(UserId, IsRead);

-- ============================================
-- SEED DATA: SuperAdmin mặc định
-- Password: CyberMonitor@2026 (BCrypt hash)
-- ============================================
DECLARE @saPasswordHash NVARCHAR(500);
SET @saPasswordHash = '$2a$11$rBNr5KQv5Qv5Qv5Qv5Qv5eO5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J';

INSERT INTO Users (Id, Email, PasswordHash, FullName, Role, IsActive)
VALUES (
    NEWID(),
    'admin@cybermonitor.vn',
    @saPasswordHash,
    'Super Administrator',
    'SuperAdmin',
    1
);

PRINT 'Database schema created successfully!';

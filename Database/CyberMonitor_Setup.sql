-- ============================================================================
-- CyberMonitor - Complete Database Setup Script
-- Run this script to create the entire database from scratch
-- Compatible with SQL Server 2016+
-- ============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ErrorMessage NVARCHAR(4000);
DECLARE @ErrorSeverity INT;
DECLARE @ErrorState INT;

BEGIN TRY
    BEGIN TRANSACTION;

    PRINT '================================================================';
    PRINT ' CyberMonitor Database Setup';
    PRINT ' Started at: ' + CONVERT(VARCHAR(30), GETDATE(), 121);
    PRINT '================================================================';
    PRINT '';

    -- ========================================================================
    -- PART 1: CREATE DATABASE
    -- ========================================================================
    PRINT '>>> [1/6] Creating database if not exists...';

    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'CyberMonitor')
    BEGIN
        CREATE DATABASE [CyberMonitor];
        PRINT '    [OK] Database CyberMonitor created.';
    END
    ELSE
    BEGIN
        PRINT '    [SKIP] Database CyberMonitor already exists.';
    END

    USE [CyberMonitor];
    PRINT '    [OK] Switched to CyberMonitor database.';
    PRINT '';

    -- ========================================================================
    -- PART 2: DROP EXISTING OBJECTS (Clean slate)
    -- ========================================================================
    PRINT '>>> [2/6] Dropping existing objects for clean install...';

    -- Drop stored procedures first
    IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_TestAIEngineLogs')
    BEGIN
        DROP PROCEDURE [dbo].[sp_TestAIEngineLogs];
        PRINT '    [OK] Dropped sp_TestAIEngineLogs';
    END

    -- Drop foreign keys
    DECLARE @SQL NVARCHAR(MAX) = N'';
    SELECT @SQL += N'ALTER TABLE ' + QUOTENAME(PARSENAME(fk referenced_object_id, 1)) + 
                   N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
    FROM sys.foreign_keys fk
    WHERE referenced_object_id = OBJECT_ID('Users');
    IF LEN(@SQL) > 0 EXEC sp_executesql @SQL;

    SELECT @SQL = N'';
    SELECT @SQL += N'ALTER TABLE ' + QUOTENAME(PARSENAME(fk referenced_object_id, 1)) + 
                   N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
    FROM sys.foreign_keys fk
    WHERE referenced_object_id = OBJECT_ID('Tenants');
    IF LEN(@SQL) > 0 EXEC sp_executesql @SQL;

    SELECT @SQL = N'';
    SELECT @SQL += N'ALTER TABLE ' + QUOTENAME(PARSENAME(fk referenced_object_id, 1)) + 
                   N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
    FROM sys.foreign_keys fk
    WHERE referenced_object_id = OBJECT_ID('Servers');
    IF LEN(@SQL) > 0 EXEC sp_executesql @SQL;

    SELECT @SQL = N'';
    SELECT @SQL += N'ALTER TABLE ' + QUOTENAME(PARSENAME(fk referenced_object_id, 1)) + 
                   N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
    FROM sys.foreign_keys fk
    WHERE referenced_object_id = OBJECT_ID('Alerts');
    IF LEN(@SQL) > 0 EXEC sp_executesql @SQL;

    SELECT @SQL = N'';
    SELECT @SQL += N'ALTER TABLE ' + QUOTENAME(PARSENAME(fk referenced_object_id, 1)) + 
                   N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';'
    FROM sys.foreign_keys fk
    WHERE referenced_object_id = OBJECT_ID('Tickets');
    IF LEN(@SQL) > 0 EXEC sp_executesql @SQL;

    -- Drop tables in correct order (child tables first)
    DECLARE @Tables TABLE (name NVARCHAR(128));
    INSERT @Tables VALUES 
        ('AlertDigestQueue'), ('Alerts'), ('ApiKeys'), ('AuditLogs'), ('BlockedIPs'),
        ('ContactMessages'), ('EmailLogs'), ('Notifications'), ('PaymentOrders'),
        ('PricingPlans'), ('ServerAlertEmails'), ('Servers'), ('ServerTelegramRecipients'),
        ('Subscriptions'), ('Tenants'), ('TicketComments'), ('Tickets'), 
        ('TrafficLogs'), ('Users'), ('Whitelists'), ('__EFMigrationsHistory');

    DECLARE @Tbl NVARCHAR(128);
    WHILE EXISTS (SELECT 1 FROM @Tables)
    BEGIN
        SELECT TOP 1 @Tbl = name FROM @Tables;
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = @Tbl)
        BEGIN
            EXEC('DROP TABLE [dbo].[' + @Tbl + ']');
            PRINT '    [OK] Dropped table: ' + @Tbl;
        END
        DELETE FROM @Tables WHERE name = @Tbl;
    END

    PRINT '    [OK] All existing tables dropped.';
    PRINT '';

    -- ========================================================================
    -- PART 3: CREATE TABLES
    -- ========================================================================
    PRINT '>>> [3/6] Creating tables...';

    -- __EFMigrationsHistory
    CREATE TABLE [dbo].[__EFMigrationsHistory](
        [MigrationId] [nvarchar](150) NOT NULL,
        [ProductVersion] [nvarchar](32) NOT NULL,
        PRIMARY KEY CLUSTERED ([MigrationId] ASC)
    );
    PRINT '    [OK] Created: __EFMigrationsHistory';

    -- Tenants
    CREATE TABLE [dbo].[Tenants](
        [Id] [uniqueidentifier] NOT NULL,
        [CompanyName] [nvarchar](200) NOT NULL,
        [Subdomain] [nvarchar](100) NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [UpdatedAt] [datetime2](7) NOT NULL,
        [IsActive] [bit] NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Tenants';

    -- Users
    CREATE TABLE [dbo].[Users](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [Email] [nvarchar](255) NOT NULL,
        [PasswordHash] [nvarchar](500) NOT NULL,
        [FullName] [nvarchar](200) NOT NULL,
        [Role] [nvarchar](50) NOT NULL,
        [IsActive] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [LastLoginAt] [datetime2](7) NULL,
        [TwoFactorEnabled] [bit] NOT NULL,
        [TwoFactorSecret] [nvarchar](max) NULL,
        [SessionTimeoutEnabled] [bit] NOT NULL,
        [SessionTimeoutMinutes] [int] NOT NULL,
        [EmailAlertsEnabled] [bit] NOT NULL,
        [TelegramAlertsEnabled] [bit] NOT NULL,
        [PushNotificationsEnabled] [bit] NOT NULL,
        [TelegramChatId] [nvarchar](100) NULL,
        [AlertSeverityThreshold] [nvarchar](20) NOT NULL,
        [AlertDigestMode] [nvarchar](20) NOT NULL,
        [AvatarUrl] [nvarchar](max) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Users';

    -- Servers
    CREATE TABLE [dbo].[Servers](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [Name] [nvarchar](200) NOT NULL,
        [IpAddress] [nvarchar](50) NOT NULL,
        [ApiKeyHash] [nvarchar](500) NOT NULL,
        [Status] [nvarchar](50) NOT NULL,
        [OS] [nvarchar](100) NULL,
        [CpuUsage] [decimal](5, 2) NOT NULL,
        [RamUsage] [decimal](5, 2) NOT NULL,
        [DiskUsage] [decimal](5, 2) NOT NULL,
        [LastSeenAt] [datetime2](7) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [HealthUrl] [nvarchar](500) NULL,
        [LastHealthCheckAt] [datetime2](7) NULL,
        [IsHealthy] [bit] NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Servers';

    -- Alerts
    CREATE TABLE [dbo].[Alerts](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [ServerId] [uniqueidentifier] NULL,
        [Severity] [nvarchar](20) NOT NULL,
        [AlertType] [nvarchar](100) NOT NULL,
        [Title] [nvarchar](500) NOT NULL,
        [Description] [nvarchar](max) NULL,
        [SourceIp] [nvarchar](50) NULL,
        [TargetAsset] [nvarchar](200) NULL,
        [MitreTactic] [nvarchar](100) NULL,
        [MitreTechnique] [nvarchar](100) NULL,
        [Status] [nvarchar](50) NOT NULL,
        [AnomalyScore] [decimal](5, 4) NULL,
        [RecommendedAction] [nvarchar](max) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [AcknowledgedAt] [datetime2](7) NULL,
        [ResolvedAt] [datetime2](7) NULL,
        [AcknowledgedBy] [uniqueidentifier] NULL,
        [ResolvedBy] [uniqueidentifier] NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Alerts';

    -- ApiKeys
    CREATE TABLE [dbo].[ApiKeys](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [ServerId] [uniqueidentifier] NULL,
        [KeyHash] [nvarchar](500) NOT NULL,
        [KeyPrefix] [nvarchar](20) NOT NULL,
        [Name] [nvarchar](200) NOT NULL,
        [Permissions] [nvarchar](max) NOT NULL,
        [LastUsedAt] [datetime2](7) NULL,
        [ExpiresAt] [datetime2](7) NULL,
        [IsActive] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [IsSuperAdmin] [bit] NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: ApiKeys';

    -- AuditLogs
    CREATE TABLE [dbo].[AuditLogs](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [UserId] [uniqueidentifier] NULL,
        [Action] [nvarchar](200) NOT NULL,
        [EntityType] [nvarchar](100) NULL,
        [EntityId] [nvarchar](200) NULL,
        [IpAddress] [nvarchar](50) NULL,
        [UserAgent] [nvarchar](500) NULL,
        [Details] [nvarchar](max) NULL,
        [Timestamp] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: AuditLogs';

    -- BlockedIPs
    CREATE TABLE [dbo].[BlockedIPs](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [ServerId] [uniqueidentifier] NULL,
        [IpAddress] [nvarchar](45) NOT NULL,
        [AttackType] [nvarchar](100) NOT NULL,
        [Severity] [nvarchar](50) NOT NULL,
        [AnomalyScore] [decimal](18, 2) NULL,
        [Reason] [nvarchar](500) NULL,
        [BlockedBy] [nvarchar](100) NOT NULL,
        [BlockedAt] [datetime2](7) NOT NULL,
        [ExpiresAt] [datetime2](7) NULL,
        [IsActive] [bit] NOT NULL,
        [UnblockedAt] [datetime2](7) NULL,
        [UnblockedBy] [nvarchar](100) NULL,
        [Evidence] [nvarchar](500) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: BlockedIPs';

    -- ContactMessages
    CREATE TABLE [dbo].[ContactMessages](
        [Id] [uniqueidentifier] NOT NULL,
        [Name] [nvarchar](200) NOT NULL,
        [Email] [nvarchar](255) NOT NULL,
        [Subject] [nvarchar](500) NULL,
        [Message] [nvarchar](max) NOT NULL,
        [Status] [nvarchar](20) NOT NULL,
        [Reply] [nvarchar](max) NULL,
        [RepliedBy] [uniqueidentifier] NULL,
        [RepliedAt] [datetime2](7) NULL,
        [IpAddress] [nvarchar](50) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: ContactMessages';

    -- EmailLogs
    CREATE TABLE [dbo].[EmailLogs](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [ToEmail] [nvarchar](255) NOT NULL,
        [Subject] [nvarchar](500) NOT NULL,
        [EmailType] [nvarchar](50) NOT NULL,
        [Status] [nvarchar](20) NOT NULL,
        [ErrorMessage] [nvarchar](2000) NULL,
        [RelatedEntityId] [uniqueidentifier] NULL,
        [RelatedEntityType] [nvarchar](50) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [SentAt] [datetime2](7) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: EmailLogs';

    -- Notifications
    CREATE TABLE [dbo].[Notifications](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [UserId] [uniqueidentifier] NOT NULL,
        [Title] [nvarchar](500) NOT NULL,
        [Message] [nvarchar](max) NOT NULL,
        [Type] [nvarchar](50) NOT NULL,
        [IsRead] [bit] NOT NULL,
        [Link] [nvarchar](max) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Notifications';

    -- PaymentOrders
    CREATE TABLE [dbo].[PaymentOrders](
        [Id] [uniqueidentifier] NOT NULL,
        [OrderId] [nvarchar](100) NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [Amount] [decimal](18, 2) NOT NULL,
        [Currency] [nvarchar](10) NOT NULL,
        [PlanName] [nvarchar](50) NOT NULL,
        [Status] [nvarchar](50) NOT NULL,
        [VnpTxnRef] [nvarchar](100) NULL,
        [VnpayTransactionNo] [nvarchar](100) NULL,
        [VnpayResponseCode] [nvarchar](10) NULL,
        [PaymentMethod] [nvarchar](50) NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [PaidAt] [datetime2](7) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: PaymentOrders';

    -- PricingPlans
    CREATE TABLE [dbo].[PricingPlans](
        [Id] [uniqueidentifier] NOT NULL,
        [Name] [nvarchar](100) NOT NULL,
        [Description] [nvarchar](500) NULL,
        [Price] [decimal](18, 0) NOT NULL,
        [OriginalPrice] [decimal](18, 0) NULL,
        [BillingPeriod] [nvarchar](20) NOT NULL,
        [Servers] [int] NOT NULL,
        [Users] [int] NOT NULL,
        [Storage] [nvarchar](20) NOT NULL,
        [Bandwidth] [nvarchar](20) NOT NULL,
        [ApiCalls] [int] NOT NULL,
        [DailyAlerts] [int] NOT NULL,
        [Retention] [nvarchar](20) NOT NULL,
        [ConcurrentConnections] [int] NOT NULL,
        [RealTimeMonitoring] [bit] NOT NULL,
        [ThreatIntelligence] [bit] NOT NULL,
        [AutoResponse] [bit] NOT NULL,
        [CustomRules] [bit] NOT NULL,
        [WhiteLabel] [bit] NOT NULL,
        [PrioritySupport] [bit] NOT NULL,
        [Sla] [nvarchar](10) NOT NULL,
        [BackupFrequency] [nvarchar](20) NOT NULL,
        [TeamManagement] [bit] NOT NULL,
        [AuditLogs] [bit] NOT NULL,
        [ApiAccess] [bit] NOT NULL,
        [Sso] [bit] NOT NULL,
        [CustomIntegrations] [bit] NOT NULL,
        [DedicatedSupport] [bit] NOT NULL,
        [SlaCredits] [bit] NOT NULL,
        [Features] [nvarchar](2000) NULL,
        [IsActive] [bit] NOT NULL,
        [IsPopular] [bit] NOT NULL,
        [IsEnterprise] [bit] NOT NULL,
        [IsTrial] [bit] NOT NULL,
        [SortOrder] [int] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [UpdatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: PricingPlans';

    -- ServerAlertEmails
    CREATE TABLE [dbo].[ServerAlertEmails](
        [Id] [uniqueidentifier] NOT NULL,
        [ServerId] [uniqueidentifier] NOT NULL,
        [Email] [nvarchar](255) NOT NULL,
        [IsActive] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: ServerAlertEmails';

    -- ServerTelegramRecipients
    CREATE TABLE [dbo].[ServerTelegramRecipients](
        [Id] [uniqueidentifier] NOT NULL,
        [ServerId] [uniqueidentifier] NOT NULL,
        [ChatId] [nvarchar](100) NOT NULL,
        [DisplayName] [nvarchar](200) NULL,
        [IsActive] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: ServerTelegramRecipients';

    -- Subscriptions
    CREATE TABLE [dbo].[Subscriptions](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [PlanName] [nvarchar](50) NOT NULL,
        [PlanPrice] [decimal](18, 2) NOT NULL,
        [MaxServers] [int] NOT NULL,
        [Status] [nvarchar](50) NOT NULL,
        [StartDate] [datetime2](7) NOT NULL,
        [EndDate] [datetime2](7) NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Subscriptions';

    -- Tickets
    CREATE TABLE [dbo].[Tickets](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [AlertId] [uniqueidentifier] NULL,
        [TicketNumber] [nvarchar](50) NOT NULL,
        [Title] [nvarchar](500) NOT NULL,
        [Description] [nvarchar](max) NULL,
        [Priority] [nvarchar](20) NOT NULL,
        [Status] [nvarchar](50) NOT NULL,
        [Category] [nvarchar](100) NULL,
        [AssignedTo] [uniqueidentifier] NULL,
        [AssignedBy] [uniqueidentifier] NULL,
        [CreatedBy] [uniqueidentifier] NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        [UpdatedAt] [datetime2](7) NOT NULL,
        [DueDate] [datetime2](7) NULL,
        [ResolvedAt] [datetime2](7) NULL,
        [ClosedAt] [datetime2](7) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Tickets';

    -- TicketComments
    CREATE TABLE [dbo].[TicketComments](
        [Id] [uniqueidentifier] NOT NULL,
        [TicketId] [uniqueidentifier] NOT NULL,
        [UserId] [uniqueidentifier] NOT NULL,
        [Content] [nvarchar](max) NOT NULL,
        [IsInternal] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: TicketComments';

    -- TrafficLogs
    CREATE TABLE [dbo].[TrafficLogs](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [ServerId] [uniqueidentifier] NOT NULL,
        [Timestamp] [datetime2](7) NOT NULL,
        [SourceIp] [nvarchar](50) NOT NULL,
        [DestinationIp] [nvarchar](50) NULL,
        [SourcePort] [int] NULL,
        [DestinationPort] [int] NULL,
        [Protocol] [nvarchar](20) NULL,
        [BytesIn] [bigint] NOT NULL,
        [BytesOut] [bigint] NOT NULL,
        [PacketsIn] [bigint] NOT NULL,
        [PacketsOut] [bigint] NOT NULL,
        [RequestCount] [int] NOT NULL,
        [IsAnomaly] [bit] NOT NULL,
        [AnomalyScore] [decimal](5, 4) NULL,
        [RawPayload] [nvarchar](max) NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: TrafficLogs';

    -- Whitelists
    CREATE TABLE [dbo].[Whitelists](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NULL,
        [ServerId] [uniqueidentifier] NULL,
        [IpAddress] [nvarchar](50) NOT NULL,
        [Description] [nvarchar](255) NULL,
        [IsActive] [bit] NOT NULL,
        [CreatedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: Whitelists';

    -- AlertDigestQueue
    CREATE TABLE [dbo].[AlertDigestQueue](
        [Id] [uniqueidentifier] NOT NULL,
        [TenantId] [uniqueidentifier] NOT NULL,
        [UserId] [uniqueidentifier] NOT NULL,
        [TelegramChatId] [nvarchar](100) NOT NULL,
        [DigestMode] [nvarchar](20) NOT NULL,
        [AlertId] [uniqueidentifier] NULL,
        [Severity] [nvarchar](20) NULL,
        [AlertTitle] [nvarchar](500) NULL,
        [AlertMessage] [nvarchar](max) NULL,
        [AlertCreatedAt] [datetime2](7) NOT NULL,
        [IsSent] [bit] NOT NULL,
        [SentAt] [datetime2](7) NULL,
        [QueuedAt] [datetime2](7) NOT NULL,
        PRIMARY KEY CLUSTERED ([Id] ASC)
    );
    PRINT '    [OK] Created: AlertDigestQueue';

    PRINT '';

    -- ========================================================================
    -- PART 4: ADD DEFAULTS
    -- ========================================================================
    PRINT '>>> [4/6] Adding default constraints...';

    ALTER TABLE [dbo].[AlertDigestQueue] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[AlertDigestQueue] ADD DEFAULT (N'hourly') FOR [DigestMode];
    ALTER TABLE [dbo].[AlertDigestQueue] ADD DEFAULT (getutcdate()) FOR [AlertCreatedAt];
    ALTER TABLE [dbo].[AlertDigestQueue] ADD DEFAULT ((0)) FOR [IsSent];
    ALTER TABLE [dbo].[AlertDigestQueue] ADD DEFAULT (getutcdate()) FOR [QueuedAt];

    ALTER TABLE [dbo].[Alerts] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Alerts] ADD DEFAULT (N'Medium') FOR [Severity];
    ALTER TABLE [dbo].[Alerts] ADD DEFAULT (N'Open') FOR [Status];
    ALTER TABLE [dbo].[Alerts] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[ApiKeys] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[ApiKeys] ADD DEFAULT (N'[]') FOR [Permissions];
    ALTER TABLE [dbo].[ApiKeys] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[ApiKeys] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[ApiKeys] ADD DEFAULT ((0)) FOR [IsSuperAdmin];

    ALTER TABLE [dbo].[AuditLogs] ADD DEFAULT (getutcdate()) FOR [Timestamp];

    ALTER TABLE [dbo].[BlockedIPs] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[BlockedIPs] ADD DEFAULT (N'Medium') FOR [Severity];
    ALTER TABLE [dbo].[BlockedIPs] ADD DEFAULT (N'AI-Engine') FOR [BlockedBy];
    ALTER TABLE [dbo].[BlockedIPs] ADD DEFAULT (getutcdate()) FOR [BlockedAt];
    ALTER TABLE [dbo].[BlockedIPs] ADD DEFAULT ((1)) FOR [IsActive];

    ALTER TABLE [dbo].[ContactMessages] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[ContactMessages] ADD DEFAULT ('unread') FOR [Status];
    ALTER TABLE [dbo].[ContactMessages] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[EmailLogs] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[EmailLogs] ADD DEFAULT ('Pending') FOR [Status];
    ALTER TABLE [dbo].[EmailLogs] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[Notifications] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Notifications] ADD DEFAULT (N'Info') FOR [Type];
    ALTER TABLE [dbo].[Notifications] ADD DEFAULT ((0)) FOR [IsRead];
    ALTER TABLE [dbo].[Notifications] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[PaymentOrders] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[PaymentOrders] ADD DEFAULT (N'VND') FOR [Currency];
    ALTER TABLE [dbo].[PaymentOrders] ADD DEFAULT (N'Pending') FOR [Status];
    ALTER TABLE [dbo].[PaymentOrders] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [Price];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'monthly') FOR [BillingPeriod];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [Servers];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [Users];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'1 GB') FOR [Storage];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'100 GB') FOR [Bandwidth];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1000)) FOR [ApiCalls];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((100)) FOR [DailyAlerts];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'7 days') FOR [Retention];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((10)) FOR [ConcurrentConnections];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [RealTimeMonitoring];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [ThreatIntelligence];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [AutoResponse];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [CustomRules];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [WhiteLabel];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [PrioritySupport];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'99%') FOR [Sla];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'Daily') FOR [BackupFrequency];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [TeamManagement];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [AuditLogs];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [ApiAccess];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [Sso];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [CustomIntegrations];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [DedicatedSupport];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [SlaCredits];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (N'[]') FOR [Features];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [IsPopular];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [IsEnterprise];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [IsTrial];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT ((0)) FOR [SortOrder];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[PricingPlans] ADD DEFAULT (getutcdate()) FOR [UpdatedAt];

    ALTER TABLE [dbo].[ServerAlertEmails] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[ServerAlertEmails] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[ServerAlertEmails] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[Servers] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT (N'Offline') FOR [Status];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT ((0)) FOR [CpuUsage];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT ((0)) FOR [RamUsage];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT ((0)) FOR [DiskUsage];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[Servers] ADD DEFAULT ((0)) FOR [IsHealthy];

    ALTER TABLE [dbo].[ServerTelegramRecipients] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[ServerTelegramRecipients] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[ServerTelegramRecipients] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT ((0)) FOR [PlanPrice];
    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT ((1)) FOR [MaxServers];
    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT (N'Active') FOR [Status];
    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT (getutcdate()) FOR [StartDate];
    ALTER TABLE [dbo].[Subscriptions] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[Tenants] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Tenants] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[Tenants] ADD DEFAULT (getutcdate()) FOR [UpdatedAt];
    ALTER TABLE [dbo].[Tenants] ADD DEFAULT ((1)) FOR [IsActive];

    ALTER TABLE [dbo].[TicketComments] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[TicketComments] ADD DEFAULT ((0)) FOR [IsInternal];
    ALTER TABLE [dbo].[TicketComments] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    ALTER TABLE [dbo].[Tickets] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Tickets] ADD DEFAULT (N'Medium') FOR [Priority];
    ALTER TABLE [dbo].[Tickets] ADD DEFAULT (N'Open') FOR [Status];
    ALTER TABLE [dbo].[Tickets] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[Tickets] ADD DEFAULT (getutcdate()) FOR [UpdatedAt];

    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT (getutcdate()) FOR [Timestamp];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [BytesIn];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [BytesOut];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [PacketsIn];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [PacketsOut];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [RequestCount];
    ALTER TABLE [dbo].[TrafficLogs] ADD DEFAULT ((0)) FOR [IsAnomaly];

    ALTER TABLE [dbo].[Users] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Users] ADD DEFAULT (N'User') FOR [Role];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[Users] ADD DEFAULT (getutcdate()) FOR [CreatedAt];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((0)) FOR [TwoFactorEnabled];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((0)) FOR [SessionTimeoutEnabled];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((30)) FOR [SessionTimeoutMinutes];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((1)) FOR [EmailAlertsEnabled];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((0)) FOR [TelegramAlertsEnabled];
    ALTER TABLE [dbo].[Users] ADD DEFAULT ((1)) FOR [PushNotificationsEnabled];
    ALTER TABLE [dbo].[Users] ADD DEFAULT (N'Medium') FOR [AlertSeverityThreshold];
    ALTER TABLE [dbo].[Users] ADD DEFAULT (N'realtime') FOR [AlertDigestMode];

    ALTER TABLE [dbo].[Whitelists] ADD DEFAULT (newid()) FOR [Id];
    ALTER TABLE [dbo].[Whitelists] ADD DEFAULT ((1)) FOR [IsActive];
    ALTER TABLE [dbo].[Whitelists] ADD DEFAULT (getutcdate()) FOR [CreatedAt];

    PRINT '    [OK] All default constraints added.';

    -- ========================================================================
    -- PART 5: ADD FOREIGN KEYS
    -- ========================================================================
    PRINT '';
    PRINT '>>> [5/6] Adding foreign key constraints...';

    -- AlertDigestQueue
    ALTER TABLE [dbo].[AlertDigestQueue] WITH CHECK ADD CONSTRAINT [FK_AlertDigestQueue_Alerts] FOREIGN KEY([AlertId]) REFERENCES [dbo].[Alerts] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[AlertDigestQueue] CHECK CONSTRAINT [FK_AlertDigestQueue_Alerts];
    ALTER TABLE [dbo].[AlertDigestQueue] WITH CHECK ADD CONSTRAINT [FK_AlertDigestQueue_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[AlertDigestQueue] CHECK CONSTRAINT [FK_AlertDigestQueue_Tenants];
    ALTER TABLE [dbo].[AlertDigestQueue] WITH CHECK ADD CONSTRAINT [FK_AlertDigestQueue_Users] FOREIGN KEY([UserId]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[AlertDigestQueue] CHECK CONSTRAINT [FK_AlertDigestQueue_Users];
    PRINT '    [OK] FK: AlertDigestQueue';

    -- Alerts
    ALTER TABLE [dbo].[Alerts] WITH CHECK ADD CONSTRAINT [FK_Alerts_AcknowledgedBy] FOREIGN KEY([AcknowledgedBy]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[Alerts] CHECK CONSTRAINT [FK_Alerts_AcknowledgedBy];
    ALTER TABLE [dbo].[Alerts] WITH CHECK ADD CONSTRAINT [FK_Alerts_ResolvedBy] FOREIGN KEY([ResolvedBy]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[Alerts] CHECK CONSTRAINT [FK_Alerts_ResolvedBy];
    ALTER TABLE [dbo].[Alerts] WITH CHECK ADD CONSTRAINT [FK_Alerts_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[Alerts] CHECK CONSTRAINT [FK_Alerts_Servers];
    ALTER TABLE [dbo].[Alerts] WITH CHECK ADD CONSTRAINT [FK_Alerts_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[Alerts] CHECK CONSTRAINT [FK_Alerts_Tenants];
    PRINT '    [OK] FK: Alerts';

    -- ApiKeys
    ALTER TABLE [dbo].[ApiKeys] WITH CHECK ADD CONSTRAINT [FK_ApiKeys_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[ApiKeys] CHECK CONSTRAINT [FK_ApiKeys_Servers];
    ALTER TABLE [dbo].[ApiKeys] WITH CHECK ADD CONSTRAINT [FK_ApiKeys_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[ApiKeys] CHECK CONSTRAINT [FK_ApiKeys_Tenants];
    PRINT '    [OK] FK: ApiKeys';

    -- AuditLogs
    ALTER TABLE [dbo].[AuditLogs] WITH CHECK ADD CONSTRAINT [FK_AuditLogs_Users] FOREIGN KEY([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [FK_AuditLogs_Users];
    PRINT '    [OK] FK: AuditLogs';

    -- BlockedIPs
    ALTER TABLE [dbo].[BlockedIPs] WITH CHECK ADD CONSTRAINT [FK_BlockedIPs_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[BlockedIPs] CHECK CONSTRAINT [FK_BlockedIPs_Servers];
    ALTER TABLE [dbo].[BlockedIPs] WITH CHECK ADD CONSTRAINT [FK_BlockedIPs_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[BlockedIPs] CHECK CONSTRAINT [FK_BlockedIPs_Tenants];
    PRINT '    [OK] FK: BlockedIPs';

    -- ContactMessages
    ALTER TABLE [dbo].[ContactMessages] WITH CHECK ADD CONSTRAINT [FK_ContactMessages_RepliedBy] FOREIGN KEY([RepliedBy]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[ContactMessages] CHECK CONSTRAINT [FK_ContactMessages_RepliedBy];
    PRINT '    [OK] FK: ContactMessages';

    -- EmailLogs
    ALTER TABLE [dbo].[EmailLogs] WITH CHECK ADD CONSTRAINT [FK_EmailLogs_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[EmailLogs] CHECK CONSTRAINT [FK_EmailLogs_Tenants];
    PRINT '    [OK] FK: EmailLogs';

    -- Notifications
    ALTER TABLE [dbo].[Notifications] WITH CHECK ADD CONSTRAINT [FK_Notifications_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[Notifications] CHECK CONSTRAINT [FK_Notifications_Tenants];
    ALTER TABLE [dbo].[Notifications] WITH CHECK ADD CONSTRAINT [FK_Notifications_Users] FOREIGN KEY([UserId]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[Notifications] CHECK CONSTRAINT [FK_Notifications_Users];
    PRINT '    [OK] FK: Notifications';

    -- PaymentOrders
    ALTER TABLE [dbo].[PaymentOrders] WITH CHECK ADD CONSTRAINT [FK_PaymentOrders_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[PaymentOrders] CHECK CONSTRAINT [FK_PaymentOrders_Tenants];
    PRINT '    [OK] FK: PaymentOrders';

    -- ServerAlertEmails
    ALTER TABLE [dbo].[ServerAlertEmails] WITH CHECK ADD CONSTRAINT [FK_ServerAlertEmails_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[ServerAlertEmails] CHECK CONSTRAINT [FK_ServerAlertEmails_Servers];
    PRINT '    [OK] FK: ServerAlertEmails';

    -- Servers
    ALTER TABLE [dbo].[Servers] WITH CHECK ADD CONSTRAINT [FK_Servers_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[Servers] CHECK CONSTRAINT [FK_Servers_Tenants];
    PRINT '    [OK] FK: Servers';

    -- ServerTelegramRecipients
    ALTER TABLE [dbo].[ServerTelegramRecipients] WITH CHECK ADD CONSTRAINT [FK_ServerTelegramRecipients_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[ServerTelegramRecipients] CHECK CONSTRAINT [FK_ServerTelegramRecipients_Servers];
    PRINT '    [OK] FK: ServerTelegramRecipients';

    -- Subscriptions
    ALTER TABLE [dbo].[Subscriptions] WITH CHECK ADD CONSTRAINT [FK_Subscriptions_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[Subscriptions] CHECK CONSTRAINT [FK_Subscriptions_Tenants];
    PRINT '    [OK] FK: Subscriptions';

    -- TicketComments
    ALTER TABLE [dbo].[TicketComments] WITH CHECK ADD CONSTRAINT [FK_TicketComments_Tickets] FOREIGN KEY([TicketId]) REFERENCES [dbo].[Tickets] ([Id]);
    ALTER TABLE [dbo].[TicketComments] CHECK CONSTRAINT [FK_TicketComments_Tickets];
    ALTER TABLE [dbo].[TicketComments] WITH CHECK ADD CONSTRAINT [FK_TicketComments_Users] FOREIGN KEY([UserId]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[TicketComments] CHECK CONSTRAINT [FK_TicketComments_Users];
    PRINT '    [OK] FK: TicketComments';

    -- Tickets
    ALTER TABLE [dbo].[Tickets] WITH CHECK ADD CONSTRAINT [FK_Tickets_Alerts] FOREIGN KEY([AlertId]) REFERENCES [dbo].[Alerts] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[Tickets] CHECK CONSTRAINT [FK_Tickets_Alerts];
    ALTER TABLE [dbo].[Tickets] WITH CHECK ADD CONSTRAINT [FK_Tickets_AssignedBy] FOREIGN KEY([AssignedBy]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[Tickets] CHECK CONSTRAINT [FK_Tickets_AssignedBy];
    ALTER TABLE [dbo].[Tickets] WITH CHECK ADD CONSTRAINT [FK_Tickets_AssignedTo] FOREIGN KEY([AssignedTo]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[Tickets] CHECK CONSTRAINT [FK_Tickets_AssignedTo];
    ALTER TABLE [dbo].[Tickets] WITH CHECK ADD CONSTRAINT [FK_Tickets_CreatedBy] FOREIGN KEY([CreatedBy]) REFERENCES [dbo].[Users] ([Id]);
    ALTER TABLE [dbo].[Tickets] CHECK CONSTRAINT [FK_Tickets_CreatedBy];
    ALTER TABLE [dbo].[Tickets] WITH CHECK ADD CONSTRAINT [FK_Tickets_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[Tickets] CHECK CONSTRAINT [FK_Tickets_Tenants];
    PRINT '    [OK] FK: Tickets';

    -- TrafficLogs
    ALTER TABLE [dbo].[TrafficLogs] WITH CHECK ADD CONSTRAINT [FK_TrafficLogs_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[TrafficLogs] CHECK CONSTRAINT [FK_TrafficLogs_Servers];
    ALTER TABLE [dbo].[TrafficLogs] WITH CHECK ADD CONSTRAINT [FK_TrafficLogs_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]);
    ALTER TABLE [dbo].[TrafficLogs] CHECK CONSTRAINT [FK_TrafficLogs_Tenants];
    PRINT '    [OK] FK: TrafficLogs';

    -- Users
    ALTER TABLE [dbo].[Users] WITH CHECK ADD CONSTRAINT [FK_Users_Tenants] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants] ([Id]) ON DELETE SET NULL;
    ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Tenants];
    PRINT '    [OK] FK: Users';

    -- Whitelists
    ALTER TABLE [dbo].[Whitelists] WITH CHECK ADD CONSTRAINT [FK_Whitelists_Servers] FOREIGN KEY([ServerId]) REFERENCES [dbo].[Servers] ([Id]);
    ALTER TABLE [dbo].[Whitelists] CHECK CONSTRAINT [FK_Whitelists_Servers];
    PRINT '    [OK] FK: Whitelists';

    -- Check Constraints
    ALTER TABLE [dbo].[Users] WITH CHECK ADD CONSTRAINT [CK_Users_Role] CHECK (([Role]='User' OR [Role]='Staff' OR [Role]='Admin' OR [Role]='SuperAdmin'));
    ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [CK_Users_Role];
    PRINT '    [OK] Check Constraint: CK_Users_Role';

    -- ========================================================================
    -- PART 6: INSERT SEED DATA
    -- ========================================================================
    PRINT '';
    PRINT '>>> [6/6] Inserting seed data...';

    -- EF Migrations History
    INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260403141504_AddBlockedIPs', N'8.0.4');
    INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260407184440_AddWhitelists', N'8.0.11');
    INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260410100001_AddContactMessages', N'8.0.11');
    INSERT [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260410100002_AddEmailLogs', N'8.0.11');
    PRINT '    [OK] Seed: __EFMigrationsHistory';

    -- Tenants
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'a368919b-8e47-46e2-a1d6-112ed6be80ea', N'123', N'123-97fff7', CAST(N'2026-04-10T20:51:55.1130171' AS DateTime2), CAST(N'2026-04-10T20:51:55.1130172' AS DateTime2), 1);
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'b0608bc9-f132-44cc-9ec6-466867b9f618', N'Demo', N'demo-dc354b', CAST(N'2026-04-11T13:35:01.3113968' AS DateTime2), CAST(N'2026-04-11T13:35:01.3113969' AS DateTime2), 1);
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'b4b49993-6508-4fe5-afb0-61aafff7c37e', N'Công Ty TNHH ABC Việt Nam', N'abc-corp', CAST(N'2026-04-10T18:26:24.4566667' AS DateTime2), CAST(N'2026-04-10T18:26:24.4566667' AS DateTime2), 1);
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'977de5b3-b62e-421d-b76b-9b686b702319', N'Demo', N'demo-4373da', CAST(N'2026-04-11T13:51:12.2702280' AS DateTime2), CAST(N'2026-04-11T13:51:12.2702281' AS DateTime2), 1);
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'0b88e2fc-0595-4f02-8844-baf53c0545b3', N'Demo1', N'demo1-a22930', CAST(N'2026-04-11T14:20:40.7251419' AS DateTime2), CAST(N'2026-04-11T14:20:40.7251420' AS DateTime2), 1);
    INSERT [dbo].[Tenants] ([Id], [CompanyName], [Subdomain], [CreatedAt], [UpdatedAt], [IsActive]) VALUES (N'075d8237-066f-4b10-8a78-cddf6444fc9b', N'gg', N'gg-6d6c5b', CAST(N'2026-04-10T18:28:50.3448739' AS DateTime2), CAST(N'2026-04-10T18:28:50.3448740' AS DateTime2), 1);
    PRINT '    [OK] Seed: Tenants (6 rows)';

    -- Users
    INSERT [dbo].[Users] ([Id], [TenantId], [Email], [PasswordHash], [FullName], [Role], [IsActive], [CreatedAt], [LastLoginAt], [TwoFactorEnabled], [TwoFactorSecret], [SessionTimeoutEnabled], [SessionTimeoutMinutes], [EmailAlertsEnabled], [TelegramAlertsEnabled], [PushNotificationsEnabled], [TelegramChatId], [AlertSeverityThreshold], [AlertDigestMode], [AvatarUrl]) 
    VALUES (N'00000000-0000-0000-0000-000000000001', NULL, N'admin@cybermonitor.vn', N'$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym', N'Super Administrator', N'SuperAdmin', 1, CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2), CAST(N'2026-04-11T14:35:15.9431937' AS DateTime2), 0, NULL, 0, 30, 1, 0, 1, NULL, N'Medium', N'realtime', NULL);

    INSERT [dbo].[Users] ([Id], [TenantId], [Email], [PasswordHash], [FullName], [Role], [IsActive], [CreatedAt], [LastLoginAt], [TwoFactorEnabled], [TwoFactorSecret], [SessionTimeoutEnabled], [SessionTimeoutMinutes], [EmailAlertsEnabled], [TelegramAlertsEnabled], [PushNotificationsEnabled], [TelegramChatId], [AlertSeverityThreshold], [AlertDigestMode], [AvatarUrl]) 
    VALUES (N'b6a4c311-a27a-4b85-8d6c-05f5804e4491', N'0b88e2fc-0595-4f02-8844-baf53c0545b3', N'Minhtenbao24@gmail.com', N'$2a$11$RJiurCOIOaUHH82LGtIjsuMEOhJxVbwhWivrLWyKa0.TBKyRpUAYy', N'Demo1 Admin', N'Admin', 0, CAST(N'2026-04-11T14:20:40.9695559' AS DateTime2), NULL, 0, N'GKPS6YANLLR4T4XNOHB5CBKKGBCZS2ER', 0, 30, 1, 0, 1, NULL, N'Medium', N'realtime', NULL);

    INSERT [dbo].[Users] ([Id], [TenantId], [Email], [PasswordHash], [FullName], [Role], [IsActive], [CreatedAt], [LastLoginAt], [TwoFactorEnabled], [TwoFactorSecret], [SessionTimeoutEnabled], [SessionTimeoutMinutes], [EmailAlertsEnabled], [TelegramAlertsEnabled], [PushNotificationsEnabled], [TelegramChatId], [AlertSeverityThreshold], [AlertDigestMode], [AvatarUrl]) 
    VALUES (N'31b928ca-839a-4b6f-9ae2-94fc072e9c66', N'0b88e2fc-0595-4f02-8844-baf53c0545b3', N'123@gmail.com', N'$2a$11$bCJm3IEVn4BFUZipM1FQC.LbhP2esjt31z/jyEkR3HO6JzPYT3tae', N'123', N'Staff', 0, CAST(N'2026-04-11T14:28:00.6401974' AS DateTime2), NULL, 0, NULL, 0, 30, 1, 0, 1, NULL, N'Medium', N'realtime', NULL);
    PRINT '    [OK] Seed: Users (3 rows)';

    -- PricingPlans
    INSERT [dbo].[PricingPlans] ([Id], [Name], [Description], [Price], [OriginalPrice], [BillingPeriod], [Servers], [Users], [Storage], [Bandwidth], [ApiCalls], [DailyAlerts], [Retention], [ConcurrentConnections], [RealTimeMonitoring], [ThreatIntelligence], [AutoResponse], [CustomRules], [WhiteLabel], [PrioritySupport], [Sla], [BackupFrequency], [TeamManagement], [AuditLogs], [ApiAccess], [Sso], [CustomIntegrations], [DedicatedSupport], [SlaCredits], [Features], [IsActive], [IsPopular], [IsEnterprise], [IsTrial], [SortOrder], [CreatedAt], [UpdatedAt]) 
    VALUES (N'11111111-1111-1111-1111-111111111111', N'Miễn Phí', N'Dành cho người dùng mới, không cần thanh toán', CAST(0 AS Decimal(18, 0)), NULL, N'monthly', 1, 1, N'1 GB', N'10 GB', 100, 10, N'7 days', 5, 1, 0, 0, 0, 0, 0, N'90%', N'None', 0, 1, 1, 0, 0, 0, 0, N'["Real-time monitoring","Basic alerts","1 Server","Email support","API Access"]', 1, 0, 0, 1, 1, CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2), CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2));

    INSERT [dbo].[PricingPlans] ([Id], [Name], [Description], [Price], [OriginalPrice], [BillingPeriod], [Servers], [Users], [Storage], [Bandwidth], [ApiCalls], [DailyAlerts], [Retention], [ConcurrentConnections], [RealTimeMonitoring], [ThreatIntelligence], [AutoResponse], [CustomRules], [WhiteLabel], [PrioritySupport], [Sla], [BackupFrequency], [TeamManagement], [AuditLogs], [ApiAccess], [Sso], [CustomIntegrations], [DedicatedSupport], [SlaCredits], [Features], [IsActive], [IsPopular], [IsEnterprise], [IsTrial], [SortOrder], [CreatedAt], [UpdatedAt]) 
    VALUES (N'22222222-2222-2222-2222-222222222222', N'Starter', N'Cho cá nhân hoặc nhóm nhỏ', CAST(299000 AS Decimal(18, 0)), NULL, N'monthly', 3, 5, N'10 GB', N'100 GB', 5000, 100, N'14 days', 20, 1, 0, 0, 0, 0, 0, N'99%', N'Daily', 0, 1, 1, 0, 0, 0, 0, N'["Everything in Free","3 Servers","5 Users","Daily reports","Email support","Priority alerts"]', 1, 0, 0, 0, 2, CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2), CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2));

    INSERT [dbo].[PricingPlans] ([Id], [Name], [Description], [Price], [OriginalPrice], [BillingPeriod], [Servers], [Users], [Storage], [Bandwidth], [ApiCalls], [DailyAlerts], [Retention], [ConcurrentConnections], [RealTimeMonitoring], [ThreatIntelligence], [AutoResponse], [CustomRules], [WhiteLabel], [PrioritySupport], [Sla], [BackupFrequency], [TeamManagement], [AuditLogs], [ApiAccess], [Sso], [CustomIntegrations], [DedicatedSupport], [SlaCredits], [Features], [IsActive], [IsPopular], [IsEnterprise], [IsTrial], [SortOrder], [CreatedAt], [UpdatedAt]) 
    VALUES (N'33333333-3333-3333-3333-333333333333', N'Professional', N'Cho doanh nghiệp vừa và nhỏ', CAST(799000 AS Decimal(18, 0)), NULL, N'monthly', 10, 20, N'50 GB', N'500 GB', 50000, 500, N'30 days', 50, 1, 1, 1, 1, 0, 0, N'99.9%', N'Hourly', 1, 1, 1, 0, 0, 0, 0, N'["Everything in Starter","10 Servers","20 Users","Auto-response","Custom rules","Threat intelligence","Team management","24/7 support"]', 1, 0, 0, 0, 3, CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2), CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2));

    INSERT [dbo].[PricingPlans] ([Id], [Name], [Description], [Price], [OriginalPrice], [BillingPeriod], [Servers], [Users], [Storage], [Bandwidth], [ApiCalls], [DailyAlerts], [Retention], [ConcurrentConnections], [RealTimeMonitoring], [ThreatIntelligence], [AutoResponse], [CustomRules], [WhiteLabel], [PrioritySupport], [Sla], [BackupFrequency], [TeamManagement], [AuditLogs], [ApiAccess], [Sso], [CustomIntegrations], [DedicatedSupport], [SlaCredits], [Features], [IsActive], [IsPopular], [IsEnterprise], [IsTrial], [SortOrder], [CreatedAt], [UpdatedAt]) 
    VALUES (N'44444444-4444-4444-4444-444444444444', N'Enterprise', N'Cho tổ chức lớn', CAST(1999000 AS Decimal(18, 0)), NULL, N'monthly', 50, 100, N'200 GB', N'2 TB', 200000, 2000, N'90 days', 200, 1, 1, 1, 1, 0, 0, N'99.99%', N'Realtime', 1, 1, 1, 0, 0, 0, 0, N'["Everything in Professional","50 Servers","100 Users","SSO","Custom integrations","Dedicated support","SLA credits","White-label"]', 1, 0, 1, 0, 4, CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2), CAST(N'2026-01-01T00:00:00.0000000' AS DateTime2));

    INSERT [dbo].[PricingPlans] ([Id], [Name], [Description], [Price], [OriginalPrice], [BillingPeriod], [Servers], [Users], [Storage], [Bandwidth], [ApiCalls], [DailyAlerts], [Retention], [ConcurrentConnections], [RealTimeMonitoring], [ThreatIntelligence], [AutoResponse], [CustomRules], [WhiteLabel], [PrioritySupport], [Sla], [BackupFrequency], [TeamManagement], [AuditLogs], [ApiAccess], [Sso], [CustomIntegrations], [DedicatedSupport], [SlaCredits], [Features], [IsActive], [IsPopular], [IsEnterprise], [IsTrial], [SortOrder], [CreatedAt], [UpdatedAt]) 
    VALUES (N'964a7d43-3185-403c-a772-6ffd00f8477b', N'demo', N'demo', CAST(10000 AS Decimal(18, 0)), CAST(9000 AS Decimal(18, 0)), N'monthly', 5, 4, N'1 GB', N'100 GB', 1000, 100, N'7 days', 10, 1, 0, 0, 0, 0, 0, N'99%', N'Daily', 0, 1, 1, 0, 0, 0, 0, N'[]', 1, 1, 0, 0, 4, CAST(N'2026-04-11T14:31:46.6749219' AS DateTime2), CAST(N'2026-04-11T14:31:46.6749219' AS DateTime2));
    PRINT '    [OK] Seed: PricingPlans (5 rows)';

    -- PaymentOrders
    INSERT [dbo].[PaymentOrders] ([Id], [OrderId], [TenantId], [Amount], [Currency], [PlanName], [Status], [VnpTxnRef], [VnpayTransactionNo], [VnpayResponseCode], [PaymentMethod], [CreatedAt], [PaidAt]) 
    VALUES (N'a5f358dd-21df-4c54-8bed-192d2f7a8580', N'CMUELNN7', N'977de5b3-b62e-421d-b76b-9b686b702319', CAST(299000.00 AS Decimal(18, 2)), N'VND', N'Starter', N'Paid', NULL, N'DEMO20260411140203', NULL, N'VietQR', CAST(N'2026-04-11T14:02:03.3095408' AS DateTime2), CAST(N'2026-04-11T14:02:03.3097470' AS DateTime2));

    INSERT [dbo].[PaymentOrders] ([Id], [OrderId], [TenantId], [Amount], [Currency], [PlanName], [Status], [VnpTxnRef], [VnpayTransactionNo], [VnpayResponseCode], [PaymentMethod], [CreatedAt], [PaidAt]) 
    VALUES (N'820cb01b-afe7-49d2-bb6f-32b65e82d8be', N'CMUFAIHU', N'0b88e2fc-0595-4f02-8844-baf53c0545b3', CAST(299000.00 AS Decimal(18, 2)), N'VND', N'Starter', N'Paid', NULL, N'DEMO20260411142117', NULL, N'VietQR', CAST(N'2026-04-11T14:21:17.3684065' AS DateTime2), CAST(N'2026-04-11T14:21:17.3685402' AS DateTime2));

    INSERT [dbo].[PaymentOrders] ([Id], [OrderId], [TenantId], [Amount], [Currency], [PlanName], [Status], [VnpTxnRef], [VnpayTransactionNo], [VnpayResponseCode], [PaymentMethod], [CreatedAt], [PaidAt]) 
    VALUES (N'ff1b90bf-e24a-43d0-bd6a-41bad9f55ddd', N'CMTBPGEW', N'075d8237-066f-4b10-8a78-cddf6444fc9b', CAST(799000.00 AS Decimal(18, 2)), N'VND', N'Professional', N'Paid', NULL, N'DEMO20260410195308', NULL, N'VietQR', CAST(N'2026-04-10T19:53:08.1383681' AS DateTime2), CAST(N'2026-04-10T19:53:08.1384698' AS DateTime2));

    INSERT [dbo].[PaymentOrders] ([Id], [OrderId], [TenantId], [Amount], [Currency], [PlanName], [Status], [VnpTxnRef], [VnpayTransactionNo], [VnpayResponseCode], [PaymentMethod], [CreatedAt], [PaidAt]) 
    VALUES (N'1bfa2cb6-430a-4c6a-bd4e-85349da8fb28', N'CMTDIPI3', N'075d8237-066f-4b10-8a78-cddf6444fc9b', CAST(299000.00 AS Decimal(18, 2)), N'VND', N'Starter', N'Paid', NULL, N'DEMO20260410204353', NULL, N'VietQR', CAST(N'2026-04-10T20:43:53.1331923' AS DateTime2), CAST(N'2026-04-10T20:43:53.1342158' AS DateTime2));
    PRINT '    [OK] Seed: PaymentOrders (4 rows)';

    -- ContactMessages
    INSERT [dbo].[ContactMessages] ([Id], [Name], [Email], [Subject], [Message], [Status], [Reply], [RepliedBy], [RepliedAt], [IpAddress], [CreatedAt]) 
    VALUES (N'6e636dd0-a84d-43f1-9c7c-45040b726812', N'Nguyễn Trần Gia Bảo', N'minhtenbao24@gmail.com', N'Demo1', N'demo1', N'read', NULL, NULL, NULL, N'192.168.1.6', CAST(N'2026-04-11T13:59:28.7634143' AS DateTime2));

    INSERT [dbo].[ContactMessages] ([Id], [Name], [Email], [Subject], [Message], [Status], [Reply], [RepliedBy], [RepliedAt], [IpAddress], [CreatedAt]) 
    VALUES (N'0bbfde7a-c1a6-45ef-964a-db15869a44c8', N'Nguyễn Trần Gia Bảo', N'minhtenbao24@gmail.com', N'demo', N'123', N'replied', N'demo1', N'00000000-0000-0000-0000-000000000001', CAST(N'2026-04-11T14:35:41.1564966' AS DateTime2), N'192.168.1.6', CAST(N'2026-04-11T14:27:24.5682990' AS DateTime2));
    PRINT '    [OK] Seed: ContactMessages (2 rows)';

    -- EmailLogs
    INSERT [dbo].[EmailLogs] ([Id], [TenantId], [ToEmail], [Subject], [EmailType], [Status], [ErrorMessage], [RelatedEntityId], [RelatedEntityType], [CreatedAt], [SentAt]) 
    VALUES (N'841185b0-036e-412c-8f3e-19795b828ce4', NULL, N'minhtenbao24@gmail.com', N'🎉 Chào mừng đến với CyberMonitor SOC!', N'Welcome', N'Pending', NULL, NULL, NULL, CAST(N'2026-04-10T18:28:50.5740323' AS DateTime2), NULL);
    PRINT '    [OK] Seed: EmailLogs (1 row)';

    -- ========================================================================
    -- CREATE STORED PROCEDURES
    -- ========================================================================
    PRINT '';
    PRINT '>>> Creating stored procedures...';

    -- sp_TestAIEngineLogs
    EXEC('
    CREATE PROCEDURE [dbo].[sp_TestAIEngineLogs]
        @TenantId UNIQUEIDENTIFIER = NULL,
        @MinutesBack INT = 10
    AS
    BEGIN
        SET NOCOUNT ON;

        DECLARE @FromDate DATETIME2 = DATEADD(MINUTE, -@MinutesBack, GETUTCDATE());

        PRINT ''Testing AI Engine query...'';
        PRINT ''  FromDate: '' + CAST(@FromDate AS NVARCHAR(30));
        PRINT ''  TenantId: '' + ISNULL(CAST(@TenantId AS NVARCHAR(50)), ''ALL'');

        IF @TenantId IS NOT NULL
        BEGIN
            SELECT TOP 10
                l.Id,
                l.TenantId,
                l.ServerId,
                l.SourceIp,
                l.DestinationIp,
                l.Protocol,
                l.BytesIn,
                l.BytesOut,
                l.Timestamp,
                l.IsAnomaly,
                s.Name AS ServerName
            FROM TrafficLogs l
            LEFT JOIN Servers s ON l.ServerId = s.Id
            WHERE l.TenantId = @TenantId
            AND l.Timestamp >= @FromDate
            ORDER BY l.Timestamp DESC;

            SELECT COUNT(*) AS TotalLogsFound
            FROM TrafficLogs
            WHERE TenantId = @TenantId
            AND Timestamp >= @FromDate;
        END
        ELSE
        BEGIN
            SELECT TOP 10
                l.Id,
                l.TenantId,
                l.SourceIp,
                l.DestinationIp,
                l.Protocol,
                l.BytesIn,
                l.BytesOut,
                l.Timestamp,
                l.IsAnomaly
            FROM TrafficLogs l
            WHERE l.Timestamp >= @FromDate
            ORDER BY l.Timestamp DESC;

            SELECT COUNT(*) AS TotalLogsFound
            FROM TrafficLogs
            WHERE Timestamp >= @FromDate;
        END
    END
    ');
    PRINT '    [OK] Created: sp_TestAIEngineLogs';

    -- ========================================================================
    -- COMMIT TRANSACTION
    -- ========================================================================
    COMMIT TRANSACTION;

    PRINT '';
    PRINT '================================================================';
    PRINT ' SUCCESS! CyberMonitor database setup completed.';
    PRINT ' Finished at: ' + CONVERT(VARCHAR(30), GETDATE(), 121);
    PRINT '================================================================';
    PRINT '';
    PRINT 'Tables created: 20';
    PRINT 'Seed data inserted: Tenants, Users, PricingPlans, PaymentOrders, ContactMessages, EmailLogs';
    PRINT 'Stored procedures created: 1';
    PRINT '';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    SELECT 
        @ErrorMessage = ERROR_MESSAGE(),
        @ErrorSeverity = ERROR_SEVERITY(),
        @ErrorState = ERROR_STATE();

    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH
GO

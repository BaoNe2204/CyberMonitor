-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Chỉ giữ các index còn hữu ích với query hiện tại của Dashboard / Reports.
-- Tránh tạo lại các index đã có sẵn trong Schema.sql / Migrations.
-- ============================================================================

USE CyberMonitor;
GO

-- ============================================================================
-- ALERTS
-- Query thực tế:
-- - lọc theo TenantId + Status
-- - sort CreatedAt DESC
-- - lấy recent alerts / dashboard counts / report export
-- ============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Alerts_TenantId_Status_CreatedAt'
      AND object_id = OBJECT_ID('dbo.Alerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Alerts_TenantId_Status_CreatedAt
    ON dbo.Alerts (TenantId, Status, CreatedAt DESC)
    INCLUDE (Severity, AlertType, SourceIp, MitreTechnique, ServerId);
    PRINT 'Created index: IX_Alerts_TenantId_Status_CreatedAt';
END
GO

-- Hỗ trợ report MITRE: alertQuery.Where(TenantId).Where(MitreTechnique != null).GroupBy(MitreTechnique)
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Alerts_TenantId_MitreTechnique'
      AND object_id = OBJECT_ID('dbo.Alerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Alerts_TenantId_MitreTechnique
    ON dbo.Alerts (TenantId, MitreTechnique)
    INCLUDE (Severity, CreatedAt, AlertType)
    WHERE MitreTechnique IS NOT NULL;
    PRINT 'Created index: IX_Alerts_TenantId_MitreTechnique';
END
GO

-- ============================================================================
-- TICKETS
-- IX_Tickets_TenantId_Status đã có sẵn trong schema/migrations.
-- Giữ thêm index theo ClosedAt cho dashboard "đóng hôm nay" + report export.
-- ============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Tickets_ClosedAt'
      AND object_id = OBJECT_ID('dbo.Tickets')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Tickets_ClosedAt
    ON dbo.Tickets (ClosedAt DESC)
    INCLUDE (TenantId, Status, Priority, CreatedAt)
    WHERE ClosedAt IS NOT NULL;
    PRINT 'Created index: IX_Tickets_ClosedAt';
END
GO

-- ============================================================================
-- TRAFFIC LOGS
-- Đã có sẵn:
-- - IX_TrafficLogs_TenantId_Time
-- - IX_TrafficLogs_ServerId_Time
-- - IX_TrafficLogs_Anomaly
-- Nên không tạo thêm để tránh index trùng nghĩa và làm nặng INSERT.
-- ============================================================================

-- ============================================================================
-- SERVERS
-- Query thực tế: lọc TenantId + Status, hiển thị Name/Ip/health metrics/LastSeenAt
-- ============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Servers_TenantId_Status'
      AND object_id = OBJECT_ID('dbo.Servers')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Servers_TenantId_Status
    ON dbo.Servers (TenantId, Status)
    INCLUDE (Name, IpAddress, CpuUsage, RamUsage, DiskUsage, LastSeenAt, CreatedAt);
    PRINT 'Created index: IX_Servers_TenantId_Status';
END
GO

-- ============================================================================
-- NOTIFICATIONS
-- Query thực tế: lọc UserId, sort CreatedAt DESC, trả IsRead/Type/Title/Link
-- ============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Notifications_UserId_CreatedAt'
      AND object_id = OBJECT_ID('dbo.Notifications')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_UserId_CreatedAt
    ON dbo.Notifications (UserId, CreatedAt DESC)
    INCLUDE (IsRead, Type, Title, Link);
    PRINT 'Created index: IX_Notifications_UserId_CreatedAt';
END
GO

-- ============================================================================
-- UPDATE STATISTICS
-- ============================================================================
UPDATE STATISTICS dbo.Alerts WITH FULLSCAN;
UPDATE STATISTICS dbo.Tickets WITH FULLSCAN;
UPDATE STATISTICS dbo.TrafficLogs WITH FULLSCAN;
UPDATE STATISTICS dbo.Servers WITH FULLSCAN;
UPDATE STATISTICS dbo.Notifications WITH FULLSCAN;
GO

PRINT 'Selected performance indexes created/verified successfully.';
PRINT 'Only indexes that still match the current project queries were kept.';
GO

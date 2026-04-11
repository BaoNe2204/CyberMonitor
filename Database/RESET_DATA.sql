-- ============================================================================
-- CyberMonitor - Reset Database Tables
-- Xoa toan bo du lieu nhung chi giu nguyen cau truc (khong xoa bang)
-- Chay tu SQL Server Management Studio hoac dotnet ef script
-- ============================================================================

PRINT '=== [RESET] Bat dau reset du lieu...';

-- 1. TrafficLogs
DELETE FROM dbo.TrafficLogs;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.TrafficLogs'))
    DBCC CHECKIDENT ('dbo.TrafficLogs', RESEED, 0);
PRINT '[RESET] TrafficLogs — da xoa';

-- 2. ApiKeys (FK -> Servers)
DELETE FROM dbo.ApiKeys;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.ApiKeys'))
    DBCC CHECKIDENT ('dbo.ApiKeys', RESEED, 0);
PRINT '[RESET] ApiKeys — da xoa';

-- 3. BlockedIPs (FK -> Servers) — XOA TRUOC Servers
DELETE FROM dbo.BlockedIPs;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.BlockedIPs'))
    DBCC CHECKIDENT ('dbo.BlockedIPs', RESEED, 0);
PRINT '[RESET] BlockedIPs — da xoa';

-- 4. Servers — Xoa sau khi BlockedIPs, ApiKeys, Alerts, TrafficLogs da xong
DELETE FROM dbo.Servers;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Servers'))
    DBCC CHECKIDENT ('dbo.Servers', RESEED, 0);
PRINT '[RESET] Servers — da xoa';

-- 5. Notifications
DELETE FROM dbo.Notifications;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Notifications'))
    DBCC CHECKIDENT ('dbo.Notifications', RESEED, 0);
PRINT '[RESET] Notifications — da xoa';

-- 6. AuditLogs
DELETE FROM dbo.AuditLogs;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.AuditLogs'))
    DBCC CHECKIDENT ('dbo.AuditLogs', RESEED, 0);
PRINT '[RESET] AuditLogs — da xoa';

-- 7. Tickets
DELETE FROM dbo.Tickets;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Tickets'))
    DBCC CHECKIDENT ('dbo.Tickets', RESEED, 0);
PRINT '[RESET] Tickets — da xoa';

-- 8. Alerts (FK -> Servers)
DELETE FROM dbo.Alerts;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Alerts'))
    DBCC CHECKIDENT ('dbo.Alerts', RESEED, 0);
PRINT '[RESET] Alerts — da xoa';

-- 9. Whitelists
DELETE FROM dbo.Whitelists;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Whitelists'))
    DBCC CHECKIDENT ('dbo.Whitelists', RESEED, 0);
PRINT '[RESET] Whitelists — da xoa';

-- 10. ServerAlertEmails
DELETE FROM dbo.ServerAlertEmails;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.ServerAlertEmails'))
    DBCC CHECKIDENT ('dbo.ServerAlertEmails', RESEED, 0);
PRINT '[RESET] ServerAlertEmails — da xoa';

-- 11. ServerTelegramRecipients
DELETE FROM dbo.ServerTelegramRecipients;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.ServerTelegramRecipients'))
    DBCC CHECKIDENT ('dbo.ServerTelegramRecipients', RESEED, 0);
PRINT '[RESET] ServerTelegramRecipients — da xoa';

-- 12. AlertDigestQueue
DELETE FROM dbo.AlertDigestQueue;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.AlertDigestQueue'))
    DBCC CHECKIDENT ('dbo.AlertDigestQueue', RESEED, 0);
PRINT '[RESET] AlertDigestQueue — da xoa';

-- 13. TicketComments
DELETE FROM dbo.TicketComments;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.TicketComments'))
    DBCC CHECKIDENT ('dbo.TicketComments', RESEED, 0);
PRINT '[RESET] TicketComments — da xoa';

-- 14. Subscriptions
DELETE FROM dbo.Subscriptions;
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('dbo.Subscriptions'))
    DBCC CHECKIDENT ('dbo.Subscriptions', RESEED, 0);
PRINT '[RESET] Subscriptions — da xoa';

PRINT '';
PRINT '=== [RESET] HOAN TAT — Tat ca du lieu da bi xoa, chi so ID da reset ve 0';
PRINT '=== [RESET] Cac bang Users, Tenants, Roles, Permissions KHONG BI AN HUONG';

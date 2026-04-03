-- ============================================================
-- CyberMonitor - Add BlockedIPs Table
-- Chạy script này trên SQL Server để thêm bảng BlockedIPs
-- ============================================================

-- Tạo bảng BlockedIPs
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BlockedIPs')
BEGIN
    CREATE TABLE BlockedIPs (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        TenantId UNIQUEIDENTIFIER NULL,
        IpAddress NVARCHAR(45) NOT NULL,
        AttackType NVARCHAR(100) NOT NULL,
        Severity NVARCHAR(50) NOT NULL DEFAULT 'Medium',
        Reason NVARCHAR(500) NULL,
        BlockedBy NVARCHAR(100) NOT NULL DEFAULT 'AI-Engine',
        BlockedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        UnblockedAt DATETIME2 NULL,
        UnblockedBy NVARCHAR(100) NULL,
        Evidence NVARCHAR(500) NULL,
        CONSTRAINT PK_BlockedIPs PRIMARY KEY (Id),
        CONSTRAINT FK_BlockedIPs_Tenants FOREIGN KEY (TenantId)
            REFERENCES Tenants(Id) ON DELETE SET NULL
    );

    -- Indexes
    CREATE INDEX IX_BlockedIPs_IpAddress ON BlockedIPs(IpAddress);
    CREATE INDEX IX_BlockedIPs_TenantId_Active ON BlockedIPs(TenantId, IsActive);

    PRINT 'BlockedIPs table created successfully.';
END
ELSE
BEGIN
    PRINT 'BlockedIPs table already exists.';
END

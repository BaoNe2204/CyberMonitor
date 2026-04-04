-- ============================================================================
-- Migration: Add ServerId to BlockedIPs table
-- Purpose: Support per-server IP blocking instead of tenant-wide
-- Date: 2026-04-04
-- ============================================================================

-- Step 1: Check if ServerId column already exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('BlockedIPs') 
    AND name = 'ServerId'
)
BEGIN
    ALTER TABLE BlockedIPs
    ADD ServerId uniqueidentifier NULL;
    PRINT 'ServerId column added successfully';
END
ELSE
BEGIN
    PRINT 'ServerId column already exists, skipping...';
END
GO

-- Step 2: Add foreign key constraint if not exists
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_BlockedIPs_Servers_ServerId'
)
BEGIN
    ALTER TABLE BlockedIPs
    ADD CONSTRAINT FK_BlockedIPs_Servers_ServerId
    FOREIGN KEY (ServerId) REFERENCES Servers(Id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
    PRINT 'Foreign key constraint added successfully';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists, skipping...';
END
GO

-- Step 3: Add index for performance (filtering by ServerId) if not exists
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_BlockedIPs_ServerId' 
    AND object_id = OBJECT_ID('BlockedIPs')
)
BEGIN
    CREATE INDEX IX_BlockedIPs_ServerId ON BlockedIPs(ServerId);
    PRINT 'Index IX_BlockedIPs_ServerId created successfully';
END
ELSE
BEGIN
    PRINT 'Index IX_BlockedIPs_ServerId already exists, skipping...';
END
GO

-- Step 4: Add composite index for common queries if not exists
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_BlockedIPs_TenantId_ServerId_IsActive' 
    AND object_id = OBJECT_ID('BlockedIPs')
)
BEGIN
    CREATE INDEX IX_BlockedIPs_TenantId_ServerId_IsActive 
    ON BlockedIPs(TenantId, ServerId, IsActive)
    INCLUDE (IpAddress, BlockedAt, ExpiresAt);
    PRINT 'Composite index created successfully';
END
ELSE
BEGIN
    PRINT 'Composite index already exists, skipping...';
END
GO

-- ============================================================================
-- Notes:
-- - ServerId is nullable to support both per-server and tenant-wide blocks
-- - NULL ServerId = tenant-wide block (applies to all servers)
-- - Non-NULL ServerId = per-server block (applies only to that server)
-- - Existing records will have ServerId = NULL (tenant-wide)
-- - ON DELETE NO ACTION to avoid multiple cascade paths error
-- ============================================================================

PRINT 'Migration completed: ServerId added to BlockedIPs table';
GO

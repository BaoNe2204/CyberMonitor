-- Tạo bảng AlertDigestQueue để lưu hàng đợi tổng hợp cảnh báo

USE CyberMonitor;
GO

-- Kiểm tra và tạo bảng nếu chưa tồn tại
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AlertDigestQueue]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AlertDigestQueue] (
        [Id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [AlertId] UNIQUEIDENTIFIER NOT NULL,
        [DigestMode] NVARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly'
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [SentAt] DATETIME2 NULL,
        [IsSent] BIT NOT NULL DEFAULT 0,
        
        CONSTRAINT [FK_AlertDigestQueue_Users] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AlertDigestQueue_Alerts] FOREIGN KEY ([AlertId]) REFERENCES [Alerts]([Id]) ON DELETE CASCADE
    );
    
    -- Tạo indexes
    CREATE INDEX [IX_AlertDigestQueue_UserId] ON [AlertDigestQueue]([UserId]);
    CREATE INDEX [IX_AlertDigestQueue_AlertId] ON [AlertDigestQueue]([AlertId]);
    CREATE INDEX [IX_AlertDigestQueue_DigestMode] ON [AlertDigestQueue]([DigestMode]);
    CREATE INDEX [IX_AlertDigestQueue_IsSent] ON [AlertDigestQueue]([IsSent]);
    CREATE INDEX [IX_AlertDigestQueue_CreatedAt] ON [AlertDigestQueue]([CreatedAt]);
    
    PRINT 'Đã tạo bảng AlertDigestQueue thành công!';
END
ELSE
BEGIN
    PRINT 'Bảng AlertDigestQueue đã tồn tại.';
END
GO

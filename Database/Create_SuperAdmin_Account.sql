-- ============================================
-- Tạo tài khoản Super Admin mới
-- CyberMonitor System
-- ============================================

USE CyberMonitor;
GO

-- ============================================
-- Thông tin tài khoản:
-- Email: 1
-- Password: 1
-- Role: SuperAdmin
-- ============================================

DECLARE @Email NVARCHAR(255) = '1';
DECLARE @PasswordHash NVARCHAR(500) = '$2a$11$sQkHQzRXhGJQGp7YQYqJEOxVQhQqQhQqQhQqQhQqQhQqQhQqQhQqQ';
DECLARE @FullName NVARCHAR(200) = 'Super Administrator';

-- Kiểm tra email đã tồn tại chưa
IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
BEGIN
    PRINT 'Email đã tồn tại trong hệ thống!';
    PRINT 'Nếu muốn reset mật khẩu, chạy lệnh UPDATE bên dưới:';
    PRINT '';
    PRINT 'UPDATE Users SET PasswordHash = ''' + @PasswordHash + ''' WHERE Email = ''' + @Email + ''';';
END
ELSE
BEGIN
    -- Tạo tài khoản Super Admin mới
    INSERT INTO Users (
        Id,
        TenantId,
        Email,
        PasswordHash,
        FullName,
        Role,
        IsActive,
        CreatedAt,
        LastLoginAt,
        TwoFactorEnabled,
        TwoFactorSecret
    )
    VALUES (
        NEWID(),                    -- Id tự động
        NULL,                       -- TenantId = NULL cho SuperAdmin
        @Email,                     -- Email
        @PasswordHash,              -- Password hash (BCrypt)
        @FullName,                  -- Họ tên
        'SuperAdmin',               -- Role
        1,                          -- IsActive
        GETUTCDATE(),               -- CreatedAt
        NULL,                       -- LastLoginAt
        0,                          -- TwoFactorEnabled
        NULL                        -- TwoFactorSecret
    );

    PRINT '✓ Tạo tài khoản Super Admin thành công!';
    PRINT '';
    PRINT '===========================================';
    PRINT 'THÔNG TIN ĐĂNG NHẬP:';
    PRINT '===========================================';
    PRINT 'Email: ' + @Email;
    PRINT 'Password: 1';
    PRINT 'Role: SuperAdmin';
    PRINT '===========================================';
    PRINT '';
    PRINT 'LƯU Ý: Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên!';
END
GO

-- ============================================
-- Kiểm tra kết quả
-- ============================================
SELECT 
    Id,
    Email,
    FullName,
    Role,
    IsActive,
    CreatedAt,
    LastLoginAt
FROM Users
WHERE Role = 'SuperAdmin'
ORDER BY CreatedAt DESC;
GO

-- ============================================
-- TÀI KHOẢN SUPER ADMIN - SẴN SÀNG ĐĂNG NHẬP
-- ============================================

USE CyberMonitor;
GO

-- Xóa tài khoản cũ nếu có
DELETE FROM Users WHERE Email = 'admin@cybermonitor.vn' AND Role = 'SuperAdmin';
GO

-- Tạo tài khoản Super Admin
INSERT INTO Users (
    Id,
    TenantId,
    Email,
    PasswordHash,
    FullName,
    Role,
    IsActive,
    CreatedAt,
    TwoFactorEnabled
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'admin@cybermonitor.vn',
    '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
    'Super Administrator',
    'SuperAdmin',
    1,
    GETUTCDATE(),
    0
);
GO

PRINT '';
PRINT '╔════════════════════════════════════════════════════════╗';
PRINT '║         TÀI KHOẢN SUPER ADMIN ĐÃ SẴN SÀNG!            ║';
PRINT '╚════════════════════════════════════════════════════════╝';
PRINT '';
PRINT '📧 Email:    admin@cybermonitor.vn';
PRINT '🔑 Password: CyberMonitor@2026';
PRINT '👤 Role:     SuperAdmin';
PRINT '';
PRINT '✅ Đăng nhập ngay tại: http://localhost:5173';
PRINT '';
GO

-- Kiểm tra tài khoản
SELECT 
    Id,
    Email,
    FullName,
    Role,
    IsActive,
    CreatedAt
FROM Users
WHERE Role = 'SuperAdmin'
ORDER BY CreatedAt DESC;
GO

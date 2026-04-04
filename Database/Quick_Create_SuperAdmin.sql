-- ============================================
-- Tạo Super Admin nhanh - Email: 1, Password: 1
-- ============================================

USE CyberMonitor;
GO

-- Xóa user cũ nếu có
DELETE FROM Users WHERE Email = '1';
GO

-- Tạo user mới với password tạm (sẽ cần đổi sau)
-- LƯU Ý: Hash này là cho password "CyberMonitor@2026"
-- Bạn cần chạy Backend API để generate hash cho password "1"
INSERT INTO Users (
    Id,
    TenantId,
    Email,
    PasswordHash,
    FullName,
    Role,
    IsActive,
    CreatedAt
)
VALUES (
    NEWID(),
    NULL,
    '1',
    '$2a$11$W6ghY.hmG5QQ6ciwQZO7Me3UB5oAmynLDf6OzYVv39c6xjTKwl4ym',
    'Super Admin',
    'SuperAdmin',
    1,
    GETUTCDATE()
);
GO

PRINT '✓ Tạo tài khoản thành công!';
PRINT '';
PRINT '===========================================';
PRINT 'THÔNG TIN ĐĂNG NHẬP TẠM THỜI:';
PRINT '===========================================';
PRINT 'Email: 1';
PRINT 'Password: CyberMonitor@2026';
PRINT '===========================================';
PRINT '';
PRINT 'ĐỂ ĐỔI PASSWORD THÀNH "1":';
PRINT '1. Chạy Backend API: cd Backend/CyberMonitor.API && dotnet run';
PRINT '2. Gọi API: POST http://localhost:5000/api/test/hash-password';
PRINT '   Body: {"password":"1"}';
PRINT '3. Copy hash từ response';
PRINT '4. Chạy: UPDATE Users SET PasswordHash = ''HASH_MỚI'' WHERE Email = ''1'';';
PRINT '';
GO

-- Kiểm tra
SELECT Id, Email, FullName, Role, IsActive, CreatedAt
FROM Users
WHERE Email = '1';
GO

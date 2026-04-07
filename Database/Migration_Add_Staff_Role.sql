-- ================================================================
-- Migration: Add 'Staff' to Role CHECK constraint
-- Chạy script này để cho phép tạo tài khoản Staff
-- ================================================================

USE CyberMonitor;
GO

PRINT 'Bat dau migration...';
PRINT '';

-- Xem constraint hien tai tren cot Role
SELECT dc.name AS ConstraintName, dc.type_desc AS ConstraintType
FROM sys.check_constraints dc
JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
WHERE dc.parent_object_id = OBJECT_ID('Users') AND c.name = 'Role';
GO

-- Xoa constraint EF migration cu (neu ton tai)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK__Users__Role__2D27B809')
BEGIN
    ALTER TABLE Users DROP CONSTRAINT CK__Users__Role__2D27B809;
    PRINT 'Da xoa: CK__Users__Role__2D27B809';
END
GO

-- Tao constraint moi cho phep Staff
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role_Staff')
BEGIN
    ALTER TABLE Users ADD CONSTRAINT CK_Users_Role_Staff CHECK (Role IN ('SuperAdmin', 'Admin', 'Staff', 'User'));
    PRINT 'Da tao: CK_Users_Role_Staff (cho phep Staff)';
END
ELSE
BEGIN
    PRINT 'Constraint CK_Users_Role_Staff da ton tai, khong can tao lai.';
END
GO

-- Kiem tra
SELECT name, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('Users');
GO

PRINT '';
PRINT 'Migration hoan tat! Thu tao tai khoan Staff ngay bay gio.';
GO

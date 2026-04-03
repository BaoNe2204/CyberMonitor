-- ============================================
-- Migration: Make Ticket.CreatedBy nullable
-- (Ticket tự động từ AI Engine không có userId)
-- ============================================

USE CyberMonitor;
GO

-- Kiểm tra xem cột đã nullable chưa
DECLARE @isNullable BIT = 0;
SELECT @isNullable = 1 
FROM sys.columns 
WHERE object_id = OBJECT_ID('Tickets') 
  AND name = 'CreatedBy' 
  AND is_nullable = 1;

IF @isNullable = 0
BEGIN
    -- Cập nhật row có CreatedBy = Guid.Empty thành NULL trước khi đổi
    UPDATE Tickets SET CreatedBy = NULL WHERE CreatedBy = '00000000-0000-0000-0000-000000000000';
    
    ALTER TABLE Tickets ALTER COLUMN CreatedBy UNIQUEIDENTIFIER NULL;
    PRINT 'Ticket.CreatedBy is now nullable.';
END
ELSE
BEGIN
    PRINT 'Ticket.CreatedBy is already nullable.';
END
GO

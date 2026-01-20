-- ============================================================================
-- FIX PASSWORD RESET NOTIFICATIONS SCHEMA
-- ============================================================================

-- Make file_id nullable to support non-file notifications
ALTER TABLE notifications 
  MODIFY COLUMN file_id INT NULL;

-- Add password_reset_request to the type ENUM
ALTER TABLE notifications 
  MODIFY COLUMN type ENUM(
    'comment', 
    'approval', 
    'rejection', 
    'final_approval', 
    'final_rejection', 
    'password_reset_request',
    'password_reset_complete',
    'assignment'
  ) NOT NULL;

SELECT 'Notifications table schema updated for password reset support' as Message;

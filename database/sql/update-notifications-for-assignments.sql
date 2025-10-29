-- ============================================================================
-- UPDATE NOTIFICATIONS TABLE - Add support for assignment notifications
-- ============================================================================

-- First, modify the type enum to include 'assignment'
ALTER TABLE notifications 
MODIFY COLUMN type ENUM('comment', 'approval', 'rejection', 'final_approval', 'final_rejection', 'assignment') NOT NULL;

-- Make file_id nullable since assignments don't require a file_id
ALTER TABLE notifications 
MODIFY COLUMN file_id INT NULL;

-- Add assignment_id column
ALTER TABLE notifications 
ADD COLUMN assignment_id INT NULL AFTER file_id;

-- Add foreign key for assignment_id
ALTER TABLE notifications 
ADD FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;

-- Add index for assignment_id
CREATE INDEX idx_notifications_assignment_id ON notifications(assignment_id);

SELECT 'Notifications table updated successfully for assignments' as Message;

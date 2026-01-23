-- Fix Foreign Key Constraints for Assignment System
-- The issue: assignment_members.file_id references files.id, but we're trying to set file_id = NULL
-- when the file doesn't exist yet (foreign key constraint violation)

-- Solution 1: Drop and recreate the foreign key to allow NULL values properly
ALTER TABLE assignment_members 
DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;

-- Recreate with proper NULL handling
ALTER TABLE assignment_members
ADD CONSTRAINT assignment_members_ibfk_2 
  FOREIGN KEY (file_id) 
  REFERENCES files(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Solution 2: Add the missing 'comment' column to assignment_submissions
ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

-- Verify the fixes
SHOW CREATE TABLE assignment_members;
DESCRIBE assignment_submissions;

-- Check for any orphaned file_id references
SELECT am.id, am.file_id, am.user_id, am.assignment_id
FROM assignment_members am
LEFT JOIN files f ON am.file_id = f.id
WHERE am.file_id IS NOT NULL AND f.id IS NULL;

-- If there are orphaned references, clean them up:
-- UPDATE assignment_members 
-- SET file_id = NULL 
-- WHERE file_id NOT IN (SELECT id FROM files) AND file_id IS NOT NULL;

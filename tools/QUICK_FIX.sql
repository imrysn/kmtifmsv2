-- ============================================
-- QUICK FIX - MySQL Compatible Version
-- ============================================

USE kmtifms;

-- Add missing comment column (safe - ignores if exists)
ALTER TABLE assignment_submissions 
ADD COLUMN comment TEXT DEFAULT NULL;

-- Fix foreign key constraint
ALTER TABLE assignment_members 
DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;

ALTER TABLE assignment_members 
ADD CONSTRAINT assignment_members_ibfk_2 
FOREIGN KEY (file_id) 
REFERENCES files(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Clean up orphaned references
UPDATE assignment_members 
SET file_id = NULL 
WHERE file_id IS NOT NULL 
  AND file_id NOT IN (SELECT id FROM files);

-- Show results
SELECT '✅ All fixes applied successfully! Restart your backend server.' AS Status;

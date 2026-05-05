-- ============================================
-- QUICK FIX - Safe Version (Checks Before Adding)
-- ============================================

USE kmtifms;

-- Step 1: Check if comment column exists, add only if it doesn't
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'kmtifms' 
  AND TABLE_NAME = 'assignment_submissions' 
  AND COLUMN_NAME = 'comment';

SET @query = IF(@col_exists = 0,
    'ALTER TABLE assignment_submissions ADD COLUMN comment TEXT DEFAULT NULL',
    'SELECT "Column already exists" AS Info');
    
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ Step 1 Complete: Comment column ready' AS Status;

-- Step 2: Fix foreign key constraint
ALTER TABLE assignment_members 
DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;

ALTER TABLE assignment_members 
ADD CONSTRAINT assignment_members_ibfk_2 
FOREIGN KEY (file_id) 
REFERENCES files(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

SELECT '✅ Step 2 Complete: Foreign key fixed' AS Status;

-- Step 3: Clean up orphaned references
UPDATE assignment_members 
SET file_id = NULL 
WHERE file_id IS NOT NULL 
  AND file_id NOT IN (SELECT id FROM files);

SELECT '✅ Step 3 Complete: Orphaned references cleaned' AS Status;

-- Final verification
SELECT '🎉 ALL FIXES APPLIED! Restart your backend server now.' AS FinalStatus;

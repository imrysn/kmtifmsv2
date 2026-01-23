-- ============================================
-- QUICK FIX - Simple Version (Run line by line if needed)
-- ============================================

USE kmtifms;

-- Fix 1: Add comment column (ignore error if it already exists)
ALTER TABLE assignment_submissions ADD COLUMN comment TEXT DEFAULT NULL;

-- Fix 2: Drop old foreign key
ALTER TABLE assignment_members DROP FOREIGN KEY assignment_members_ibfk_2;

-- Fix 3: Add new foreign key with SET NULL
ALTER TABLE assignment_members ADD CONSTRAINT assignment_members_ibfk_2 FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix 4: Clean orphaned references  
UPDATE assignment_members SET file_id = NULL WHERE file_id IS NOT NULL AND file_id NOT IN (SELECT id FROM files);

-- Done
SELECT 'Success! Restart your backend server.' AS Message;

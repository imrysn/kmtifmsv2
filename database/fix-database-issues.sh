#!/bin/bash
# Run these SQL commands in your MySQL database to fix the issues

echo "🔧 Fixing KMTI File Management System Database Issues..."

# Fix 1: Add missing 'comment' column
mysql -u root -p kmtifms <<EOF
ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL AFTER submitted_at;

SELECT 'Comment column added' AS status;
EOF

# Fix 2: Fix foreign key constraints to prevent deletion issues
mysql -u root -p kmtifms <<EOF
-- Drop existing foreign key
ALTER TABLE assignment_members 
DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;

-- Recreate with proper NULL handling
ALTER TABLE assignment_members
ADD CONSTRAINT assignment_members_ibfk_2 
  FOREIGN KEY (file_id) 
  REFERENCES files(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

SELECT 'Foreign key constraint fixed' AS status;
EOF

# Fix 3: Clean up orphaned file references
mysql -u root -p kmtifms <<EOF
-- Find orphaned references
SELECT 'Checking for orphaned file references...' AS status;

SELECT COUNT(*) as orphaned_count
FROM assignment_members am
LEFT JOIN files f ON am.file_id = f.id
WHERE am.file_id IS NOT NULL AND f.id IS NULL;

-- Clean them up
UPDATE assignment_members 
SET file_id = NULL 
WHERE file_id NOT IN (SELECT id FROM files) AND file_id IS NOT NULL;

SELECT 'Orphaned references cleaned' AS status;
EOF

# Fix 4: Verify the fixes
mysql -u root -p kmtifms <<EOF
SHOW CREATE TABLE assignment_members\G
DESCRIBE assignment_submissions;
SELECT 'Database schema verified' AS status;
EOF

echo "✅ Database fixes applied successfully!"
echo "ℹ️ Please restart your backend server for changes to take effect."

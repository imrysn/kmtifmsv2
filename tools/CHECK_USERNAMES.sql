-- Run this in your MySQL/SQLite database to find the actual username

-- Check all usernames in the system
SELECT DISTINCT username FROM files ORDER BY uploaded_at DESC;

-- Check files for the user you logged in as
SELECT 
    id,
    original_name,
    file_path,
    username,
    user_team,
    uploaded_at,
    status
FROM files 
ORDER BY uploaded_at DESC 
LIMIT 20;

-- This will show you:
-- 1. What username is actually being used
-- 2. What the file_path column contains
-- 3. Where files should be located

-- Expected results:
-- If username = "KMTI User" → Files are in: X:\uploads\KMTI User\
-- If username = "test_user" → Files are in: X:\uploads\test_user\

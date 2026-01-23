-- Check where files are actually stored
SELECT 
    id,
    original_name,
    file_path,
    username,
    user_team,
    status,
    uploaded_at
FROM files 
WHERE username = 'KMTI User'
ORDER BY uploaded_at DESC
LIMIT 10;

-- This will show you the EXACT paths stored in the database
-- Copy the file_path values and check if files exist at those locations

-- ============================================================
-- CLEANUP: Remove duplicate individual file records caused by
-- folder uploads that were missing folder_name metadata.
-- 
-- The bug: when a folder was uploaded, each file got stored
-- TWICE — once with folder_name set (correct) and once without
-- folder_name (phantom duplicate as individual file).
--
-- This script deletes the phantom individual records when a
-- matching folder-grouped record exists for the same file.
--
-- ALWAYS RUN THE SELECT FIRST to review before deleting!
-- ============================================================

-- STEP 1: Preview duplicates (run this first, review output)
SELECT 
  f_individual.id AS phantom_id,
  f_individual.original_name,
  f_individual.username,
  f_individual.folder_name AS phantom_folder_name,
  f_folder.id AS correct_id,
  f_folder.folder_name AS correct_folder_name,
  f_individual.uploaded_at
FROM files f_individual
JOIN files f_folder 
  ON f_individual.original_name = f_folder.original_name
  AND f_individual.user_id = f_folder.user_id
  AND (f_individual.folder_name IS NULL OR f_individual.folder_name = '')
  AND f_folder.folder_name IS NOT NULL
  AND f_folder.folder_name != ''
  AND f_individual.id != f_folder.id
ORDER BY f_individual.username, f_individual.original_name;

-- ============================================================
-- STEP 2: After reviewing the above, run this to DELETE
-- the phantom individual records (uncomment to execute)
-- ============================================================

-- DELETE FROM assignment_submissions
-- WHERE file_id IN (
--   SELECT f_individual.id
--   FROM files f_individual
--   JOIN files f_folder 
--     ON f_individual.original_name = f_folder.original_name
--     AND f_individual.user_id = f_folder.user_id
--     AND (f_individual.folder_name IS NULL OR f_individual.folder_name = '')
--     AND f_folder.folder_name IS NOT NULL
--     AND f_folder.folder_name != ''
--     AND f_individual.id != f_folder.id
-- );

-- DELETE FROM files
-- WHERE id IN (
--   SELECT f_individual.id
--   FROM files f_individual
--   JOIN files f_folder 
--     ON f_individual.original_name = f_folder.original_name
--     AND f_individual.user_id = f_folder.user_id
--     AND (f_individual.folder_name IS NULL OR f_individual.folder_name = '')
--     AND f_folder.folder_name IS NOT NULL
--     AND f_folder.folder_name != ''
--     AND f_individual.id != f_folder.id
-- );

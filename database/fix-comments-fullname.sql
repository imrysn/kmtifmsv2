-- Fix missing fullnames in assignment_comments table
-- This updates all comments that don't have user_fullname set

UPDATE assignment_comments ac
JOIN users u ON ac.user_id = u.id
SET ac.user_fullname = u.fullName
WHERE ac.user_fullname IS NULL OR ac.user_fullname = '';

-- Fix missing fullnames in comment_replies table
UPDATE comment_replies cr
JOIN users u ON cr.user_id = u.id
SET cr.user_fullname = u.fullName
WHERE cr.user_fullname IS NULL OR cr.user_fullname = '';

-- Verify the update
SELECT 
  COUNT(*) as total_comments,
  SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
FROM assignment_comments;

SELECT 
  COUNT(*) as total_replies,
  SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
FROM comment_replies;

-- Add 'comment' column to assignment_submissions table
-- This fixes the "Unknown column 'comment'" error

ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assignment_submissions' 
  AND column_name = 'comment';

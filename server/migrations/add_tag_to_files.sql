-- Add tag column to files table if it doesn't exist
ALTER TABLE files ADD COLUMN IF NOT EXISTS tag VARCHAR(100);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_files_tag ON files(tag);

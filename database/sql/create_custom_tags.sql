-- Create custom_tags table for user-created tags
CREATE TABLE IF NOT EXISTS custom_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_name TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster tag lookups
CREATE INDEX IF NOT EXISTS idx_custom_tags_name ON custom_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_custom_tags_created_by ON custom_tags(created_by);

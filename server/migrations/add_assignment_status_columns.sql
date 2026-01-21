-- Add status and completed_at columns to assignments table
ALTER TABLE assignments 
ADD COLUMN status VARCHAR(20) DEFAULT 'active',
ADD COLUMN completed_at DATETIME NULL;

-- Add index for status
CREATE INDEX idx_assignment_status ON assignments(status);

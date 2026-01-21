-- Create assignment_attachments table for storing files attached to assignments
CREATE TABLE IF NOT EXISTS assignment_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assignment_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100),
  uploaded_by_id INT NOT NULL,
  uploaded_by_username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  INDEX idx_assignment (assignment_id),
  INDEX idx_uploaded_by (uploaded_by_id)
);

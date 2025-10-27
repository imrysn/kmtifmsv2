-- ============================================================================
-- ADD ASSIGNMENT COMMENTS TABLE FOR FACEBOOK-STYLE COMMENTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignment_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  user_fullname VARCHAR(255),
  user_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_assignment_comments_assignment_id (assignment_id),
  INDEX idx_assignment_comments_user_id (user_id),
  INDEX idx_assignment_comments_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Assignment comments table created successfully' as Message;

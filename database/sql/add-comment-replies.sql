-- ============================================================================
-- ADD COMMENT REPLIES TABLE FOR FACEBOOK-STYLE NESTED REPLIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS comment_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  user_fullname VARCHAR(255),
  user_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  reply TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comment_id) REFERENCES assignment_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_comment_replies_comment_id (comment_id),
  INDEX idx_comment_replies_user_id (user_id),
  INDEX idx_comment_replies_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Comment replies table created successfully' as Message;

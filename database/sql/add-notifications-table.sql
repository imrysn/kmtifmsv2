-- ============================================================================
-- NOTIFICATIONS TABLE - User notifications for file actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  type ENUM('comment', 'approval', 'rejection', 'final_approval', 'final_rejection') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_by_id INT,
  action_by_username VARCHAR(100) NOT NULL,
  action_by_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_file_id (file_id),
  INDEX idx_notifications_is_read (is_read),
  INDEX idx_notifications_created_at (created_at),
  INDEX idx_notifications_user_unread (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Notifications table created successfully' as Message;

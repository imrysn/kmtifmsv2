-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  dueDate DATETIME,
  fileTypeRequired VARCHAR(100),
  assignedTo ENUM('all', 'specific') DEFAULT 'all',
  maxFileSize BIGINT DEFAULT 10485760,
  teamLeaderId INT NOT NULL,
  teamLeaderUsername VARCHAR(50) NOT NULL,
  team VARCHAR(100) NOT NULL,
  createdAt DATETIME NOT NULL,
  INDEX idx_team (team),
  INDEX idx_team_leader (teamLeaderId),
  INDEX idx_created (createdAt)
);

-- Create assignment_members table (for specific member assignments)
CREATE TABLE IF NOT EXISTS assignment_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assignment_id INT NOT NULL,
  user_id INT NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_assignment_member (assignment_id, user_id)
);

-- Create assignment_submissions table (links files to assignments)
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assignment_id INT NOT NULL,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  submitted_at DATETIME NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_assignment_submission (assignment_id, file_id)
);

-- ============================================
-- FIX FOR TEAM LEADERS - v2.1.13
-- ============================================
-- This script fixes the missing team leader data issue
-- by creating the team_leaders table and migrating existing data

USE kmtifms;

-- Step 1: Create team_leaders table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_leaders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_user (team_id, user_id),
  INDEX idx_team_leaders_team (team_id),
  INDEX idx_team_leaders_user (user_id)
) ENGINE=InnoDB;

-- Step 2: Migrate existing team leader data from teams table
-- This will populate team_leaders with existing leader assignments
INSERT IGNORE INTO team_leaders (team_id, user_id, username)
SELECT t.id, t.leader_id, t.leader_username 
FROM teams t
WHERE t.leader_id IS NOT NULL 
  AND t.leader_username IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_leaders tl 
    WHERE tl.team_id = t.id AND tl.user_id = t.leader_id
  );

-- Step 3: Verify the migration
SELECT CONCAT('✅ Team leaders table has ', COUNT(*), ' entries') AS status
FROM team_leaders;

-- Step 4: Show teams with their leaders
SELECT 
  t.name AS team_name,
  GROUP_CONCAT(tl.username) AS leaders
FROM teams t
LEFT JOIN team_leaders tl ON t.id = tl.team_id
GROUP BY t.id, t.name
ORDER BY t.name;

-- ============================================
-- END OF FIX
-- ============================================

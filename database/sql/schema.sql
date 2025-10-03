-- KMTIFMS2 MySQL Database Schema
-- Created for network-based multi-user concurrent access

-- Drop existing database if recreating (use with caution)
-- DROP DATABASE IF EXISTS kmtifms;

-- Create database (if running this manually)
-- CREATE DATABASE IF NOT EXISTS kmtifms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE kmtifms;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL DEFAULT 'USER',
  team VARCHAR(100) DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_team (team),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  leader_id INT,
  leader_username VARCHAR(100),
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_teams_name (name),
  INDEX idx_teams_leader (leader_id),
  INDEX idx_teams_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FILES TABLE - Main file tracking with approval workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- File Information
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- User Information
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  user_team VARCHAR(100) NOT NULL,
  
  -- Workflow Status
  status ENUM('uploaded', 'pending_team_leader', 'pending_admin', 'approved', 'rejected') 
    NOT NULL DEFAULT 'uploaded',
  current_stage ENUM('pending_team_leader', 'pending_admin', 'published', 'rejected') 
    NOT NULL DEFAULT 'pending_team_leader',
  
  -- Team Leader Review
  team_leader_id INT,
  team_leader_username VARCHAR(100),
  team_leader_reviewed_at TIMESTAMP NULL,
  team_leader_comments TEXT,
  
  -- Admin Review
  admin_id INT,
  admin_username VARCHAR(100),
  admin_reviewed_at TIMESTAMP NULL,
  admin_comments TEXT,
  
  -- Public Network
  public_network_url VARCHAR(500),
  final_approved_at TIMESTAMP NULL,
  
  -- Rejection Information
  rejection_reason TEXT,
  rejected_by VARCHAR(100),
  rejected_at TIMESTAMP NULL,
  
  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes for performance
  INDEX idx_files_user_id (user_id),
  INDEX idx_files_user_team (user_team),
  INDEX idx_files_current_stage (current_stage),
  INDEX idx_files_status (status),
  INDEX idx_files_uploaded_at (uploaded_at),
  INDEX idx_files_team_leader (team_leader_id),
  INDEX idx_files_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FILE COMMENTS TABLE - Comments and feedback on files
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  user_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  comment TEXT NOT NULL,
  comment_type ENUM('general', 'approval', 'rejection', 'revision') 
    NOT NULL DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_file_comments_file_id (file_id),
  INDEX idx_file_comments_user_id (user_id),
  INDEX idx_file_comments_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FILE STATUS HISTORY TABLE - Track all status changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  old_stage VARCHAR(50),
  new_stage VARCHAR(50) NOT NULL,
  changed_by_id INT,
  changed_by_username VARCHAR(100) NOT NULL,
  changed_by_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_file_status_history_file_id (file_id),
  INDEX idx_file_status_history_created_at (created_at),
  INDEX idx_file_status_history_changed_by (changed_by_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITY LOGS TABLE - System-wide activity tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(100) NOT NULL,
  role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
  team VARCHAR(100) NOT NULL,
  activity TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_activity_logs_timestamp (timestamp),
  INDEX idx_activity_logs_user_id (user_id),
  INDEX idx_activity_logs_role (role),
  INDEX idx_activity_logs_team (team)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INITIAL DATA - Default admin user and general team
-- ============================================================================

-- Insert default admin user (password: admin123 - hashed with bcrypt)
INSERT INTO users (fullName, username, email, password, role, team) 
VALUES (
  'System Administrator',
  'admin',
  'admin@kmti.local',
  '$2a$10$XOPbrlUPQdwdJUpSrIF6X.LbE8eeoooGlId3Kn.Uj/7p76FIwrMuG',
  'ADMIN',
  'Administration'
) ON DUPLICATE KEY UPDATE email=email;

-- Insert default General team
INSERT INTO teams (name, description, color, is_active)
VALUES (
  'General',
  'Default team for all users',
  '#3B82F6',
  TRUE
) ON DUPLICATE KEY UPDATE name=name;

-- ============================================================================
-- DATABASE INFORMATION
-- ============================================================================

SELECT 
  'KMTIFMS2 MySQL Database Schema Initialized' as Message,
  DATABASE() as DatabaseName,
  NOW() as CreatedAt;

-- Migration: Add 'under_revision' status to files table
-- This allows files that replace rejected ones to be marked as revised

USE kmtifms;

-- Add 'under_revision' to the status ENUM
ALTER TABLE files 
MODIFY COLUMN status ENUM(
  'uploaded', 
  'pending_team_leader', 
  'pending_admin', 
  'approved', 
  'rejected',
  'under_revision',
  'team_leader_approved',
  'final_approved',
  'rejected_by_team_leader',
  'rejected_by_admin'
) NOT NULL DEFAULT 'uploaded';

SELECT 'Migration completed: under_revision status added to files table' AS message;

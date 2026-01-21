-- =============================================================================
-- KMTI File Management System - Database Fix Script
-- =============================================================================
-- Purpose: Fix foreign key constraints and add missing columns
-- Run this script in your MySQL database to resolve file deletion issues
-- =============================================================================

USE kmtifms;

-- =============================================================================
-- Fix 1: Add missing 'comment' column to assignment_submissions table
-- =============================================================================
-- This fixes the "Unknown column 'comment'" error

ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL AFTER submitted_at;

SELECT '✅ Fix 1 Complete: Comment column added' AS Status;

-- =============================================================================
-- Fix 2: Fix foreign key constraint on assignment_members table
-- =============================================================================
-- This fixes the "Cannot add or update a child row: a foreign key constraint fails" error
-- The issue: file_id references files(id), but when files are deleted/replaced,
-- the constraint prevents updating assignment_members

-- Drop the existing constraint
ALTER TABLE assignment_members 
DROP FOREIGN KEY IF EXISTS assignment_members_ibfk_2;

-- Recreate with proper NULL handling
ALTER TABLE assignment_members
ADD CONSTRAINT assignment_members_ibfk_2 
  FOREIGN KEY (file_id) 
  REFERENCES files(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

SELECT '✅ Fix 2 Complete: Foreign key constraint fixed' AS Status;

-- =============================================================================
-- Fix 3: Clean up orphaned file references
-- =============================================================================
-- Find and clean up any assignment_members records that reference non-existent files

-- First, check how many orphaned references exist
SELECT COUNT(*) as orphaned_count,
       'These references will be cleaned up' as note
FROM assignment_members am
LEFT JOIN files f ON am.file_id = f.id
WHERE am.file_id IS NOT NULL AND f.id IS NULL;

-- Clean them up by setting file_id to NULL
UPDATE assignment_members 
SET file_id = NULL 
WHERE file_id IS NOT NULL 
  AND file_id NOT IN (SELECT id FROM files);

SELECT '✅ Fix 3 Complete: Orphaned references cleaned' AS Status;

-- =============================================================================
-- Verification: Check the database schema
-- =============================================================================

-- Show the fixed assignment_members table structure
SHOW CREATE TABLE assignment_members\G

-- Show the fixed assignment_submissions table structure  
DESCRIBE assignment_submissions;

SELECT '✅ All Fixes Complete!' AS Status;
SELECT 'Please restart your backend server for changes to take effect.' AS NextStep;

-- =============================================================================
-- Additional: Check for any remaining issues
-- =============================================================================

-- Check if there are still orphaned references (should be 0)
SELECT 
  (SELECT COUNT(*) 
   FROM assignment_members am
   LEFT JOIN files f ON am.file_id = f.id
   WHERE am.file_id IS NOT NULL AND f.id IS NULL) as remaining_orphans,
  'Should be 0 if cleanup was successful' as note;

-- Show recent files and their assignment links
SELECT 
    f.id as file_id,
    f.original_name,
    f.username,
    COUNT(am.id) as assignment_links
FROM files f
LEFT JOIN assignment_members am ON f.id = am.file_id
GROUP BY f.id
ORDER BY f.uploaded_at DESC
LIMIT 10;

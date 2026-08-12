/**
 * Migration 012: Fix files.status and files.current_stage columns.
 *
 * ROOT CAUSE BUG: The original schema.sql defined files.status as:
 *   ENUM('uploaded', 'pending_team_leader', 'pending_admin', 'approved', 'rejected')
 *
 * The application uses many additional values: 'checked', 'revision', 'for_editing',
 * 'team_leader_approved', 'final_approved', 'rejected_by_team_leader', 'rejected_by_admin',
 * 'under_revision', etc.
 *
 * MySQL silently ignores UPDATE statements when the value is not in the ENUM —
 * meaning "Done Checking" appeared to succeed but the status never changed in the DB.
 *
 * Fix: Convert both files.status and files.current_stage from ENUM to VARCHAR(50).
 */

const { query } = require('../config/database');

async function up() {
  try {
    // Check files.status column type
    const statusCol = await query(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'status'
    `);

    const statusType = statusCol?.[0]?.COLUMN_TYPE || '';

    if (statusType.toLowerCase().startsWith('varchar')) {
      console.log('✅ [012] files.status is already VARCHAR — skipping status alter.');
    } else {
      await query(`
        ALTER TABLE files
        MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'uploaded'
      `);
      console.log('✅ [012] files.status converted from ENUM to VARCHAR(50)');
    }

    // Check files.current_stage column type
    const stageCol = await query(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'current_stage'
    `);

    const stageType = stageCol?.[0]?.COLUMN_TYPE || '';

    if (stageType.toLowerCase().startsWith('varchar')) {
      console.log('✅ [012] files.current_stage is already VARCHAR — skipping stage alter.');
    } else {
      await query(`
        ALTER TABLE files
        MODIFY COLUMN current_stage VARCHAR(50) NOT NULL DEFAULT 'pending_team_leader'
      `);
      console.log('✅ [012] files.current_stage converted from ENUM to VARCHAR(50)');
    }

    return true;
  } catch (error) {
    console.error('❌ [012] Migration failed:', error.message);
    return true; // Don't crash the server
  }
}

module.exports = up;

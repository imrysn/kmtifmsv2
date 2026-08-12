/**
 * Migration 017: Add project_folder_path column to assignments table.
 *
 * Populated by the server when a task is created (non-blocking setImmediate).
 * NULL for tasks created before this deployment (old pipeline).
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'assignments'
        AND COLUMN_NAME = 'project_folder_path'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [017] assignments.project_folder_path already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE assignments
      ADD COLUMN project_folder_path VARCHAR(1024) NULL COMMENT 'Absolute NAS path provisioned at task creation time' AFTER status
    `);
    console.log('✅ [017] assignments.project_folder_path column added.');
    return true;
  } catch (error) {
    console.error('❌ [017] Migration failed:', error.message);
    return true; // Don't crash server
  }
}

module.exports = up;

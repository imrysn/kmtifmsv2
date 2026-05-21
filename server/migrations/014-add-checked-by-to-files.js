/**
 * Migration 014: Add checked_by column to files table.
 *
 * Stores the name of the checker who marked a file as 'checked',
 * so the Team Leader can see "Checked by: <name>" on each file.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'checked_by'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [014] files.checked_by already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE files
      ADD COLUMN checked_by VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ [014] files.checked_by column added.');
    return true;
  } catch (error) {
    console.error('❌ [014] Migration failed:', error.message);
    return true; // Don't crash server
  }
}

module.exports = up;

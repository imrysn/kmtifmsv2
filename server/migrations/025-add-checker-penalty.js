/**
 * Migration 025: Add checker_penalty_percentage column to files table.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'checker_penalty_percentage'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [025] files.checker_penalty_percentage already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE files
      ADD COLUMN checker_penalty_percentage INT DEFAULT 0
    `);
    console.log('✅ [025] files.checker_penalty_percentage column added.');

    return true;
  } catch (error) {
    console.error('❌ [025] Migration failed:', error.message);
    return true; // Return true to not block other migrations, standard in this codebase
  }
}

module.exports = up;

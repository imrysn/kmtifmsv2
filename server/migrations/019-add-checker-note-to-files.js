/**
 * Migration 019: Add checker_note column to files table.
 *
 * Stores the wrong items noted by the checker when marking a file
 * as "For Editing", so the note appears in File Details.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'checker_note'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [019] files.checker_note already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE files
      ADD COLUMN checker_note TEXT DEFAULT NULL
    `);
    console.log('✅ [019] files.checker_note column added.');
    return true;
  } catch (error) {
    console.error('❌ [019] Migration failed:', error.message);
    return true;
  }
}

module.exports = up;

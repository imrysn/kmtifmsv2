/**
 * Migration 024: Add penalty_percentage column to files table.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'penalty_percentage'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [024] files.penalty_percentage already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE files
      ADD COLUMN penalty_percentage INT DEFAULT 0
    `);
    console.log('✅ [024] files.penalty_percentage column added.');

    // Backfill using mistakes_count
    await query(`
      UPDATE files 
      SET penalty_percentage = COALESCE(mistakes_count, 0) * 10 
      WHERE COALESCE(mistakes_count, 0) > 0
    `);
    console.log('✅ [024] Backfilled penalty_percentage from mistakes_count.');

    return true;
  } catch (error) {
    console.error('❌ [024] Migration failed:', error.message);
    return true;
  }
}

module.exports = up;

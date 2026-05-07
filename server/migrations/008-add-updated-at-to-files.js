/**
 * Migration 008: Add updated_at column to files table
 * This column is required by the repository logic but missing from the initial schema.
 */

async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 008: Add updated_at to files...');

  try {
    const cols = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND COLUMN_NAME = 'updated_at'`
    );

    if (cols.length === 0) {
      await query(`ALTER TABLE files ADD COLUMN updated_at DATETIME NULL AFTER uploaded_at`);
      console.log('  ✅ files.updated_at column added (DATETIME)');
    } else {
      console.log('  ⏭️  files.updated_at already exists');
    }
    return true;
  } catch (err) {
    console.error('  ❌ Could not add files.updated_at:', err.message);
    return false;
  }
}

module.exports = up;
module.exports.up = up;

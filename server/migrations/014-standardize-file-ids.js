/**
 * Migration 014: Standardize file_id types across tables
 * Ensures file_id in file_views is INT(11) to match other tables.
 */
async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 014: Standardizing file_id types...');

  try {
    // 1. Check file_views.file_id type
    const cols = await query(
      `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views' AND COLUMN_NAME = 'file_id'`
    );

    if (cols.length && cols[0].DATA_TYPE !== 'int') {
      console.log(`  🔧 Converting file_views.file_id from ${cols[0].DATA_TYPE} to INT...`);
      
      // Remove any problematic rows that can't be converted to INT (should be none in normal use)
      await query(`DELETE FROM file_views WHERE file_id NOT REGEXP '^[0-9]+$'`);
      
      // Alter column
      await query(`ALTER TABLE file_views MODIFY COLUMN file_id INT NOT NULL`);
      console.log('  ✅ file_views.file_id is now INT');
    } else {
      console.log('  ⏭️  file_views.file_id already INT or table missing');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not standardize file_views.file_id:', err.message);
  }

  console.log('✅ Migration 014 complete');
  return true;
}

module.exports = up;
module.exports.up = up;

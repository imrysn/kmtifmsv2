/**
 * Migration 007: Add file_views table to track who viewed which files
 */
async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 007: Add file_views table...');

  try {
    const exists = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views'`
    );

    if (exists.length === 0) {
      // Table doesn't exist — create it fresh
      await query(`
        CREATE TABLE file_views (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          user_id INT NOT NULL,
          username VARCHAR(255) NOT NULL DEFAULT '',
          full_name VARCHAR(255),
          role VARCHAR(100),
          viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_file (file_id, user_id),
          INDEX idx_file_id (file_id),
          INDEX idx_user_id (user_id)
        )
      `);
      console.log('  ✅ file_views table created');
    } else {
      // Table exists — ensure all required columns are present
      console.log('  🔧 file_views table exists, checking columns...');

      const columns = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views'`
      );
      const colNames = columns.map(c => c.COLUMN_NAME.toLowerCase());

      if (!colNames.includes('username')) {
        await query(`ALTER TABLE file_views ADD COLUMN username VARCHAR(255) NOT NULL DEFAULT ''`);
        console.log('  ✅ Added username column');
      }
      if (!colNames.includes('full_name')) {
        await query(`ALTER TABLE file_views ADD COLUMN full_name VARCHAR(255)`);
        console.log('  ✅ Added full_name column');
      }
      if (!colNames.includes('role')) {
        await query(`ALTER TABLE file_views ADD COLUMN role VARCHAR(100)`);
        console.log('  ✅ Added role column');
      }
      if (!colNames.includes('viewed_at')) {
        await query(`ALTER TABLE file_views ADD COLUMN viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        console.log('  ✅ Added viewed_at column');
      }

      // Ensure unique key exists
      const existingIndexes = await query(`
        SHOW INDEX FROM file_views WHERE Key_name = 'unique_user_file'
      `);
      
      if (existingIndexes.length === 0) {
        await query(`ALTER TABLE file_views ADD UNIQUE KEY unique_user_file (file_id, user_id)`);
        console.log('  ✅ Added unique key');
      } else {
        console.log('  ⏭️  Unique key already exists');
      }

      console.log('  ✅ file_views columns verified');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not set up file_views table:', err.message);
  }

  console.log('✅ Migration 007 complete');
  return true;
}

module.exports = up;
module.exports.up = up;

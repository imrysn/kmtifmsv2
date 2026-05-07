/**
 * Quick fix: ensure file_views table has all required columns.
 * Run with: node fix-file-views-table.js
 */
const { query } = require('./database/config');

async function fix() {
  console.log('🔧 Checking file_views table...');

  try {
    // Check if table exists
    const exists = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views'`
    );

    if (exists.length === 0) {
      console.log('  Table missing — creating...');
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
      console.log('  ✅ Table created');
    } else {
      console.log('  Table exists — checking columns...');

      const columns = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views'`
      );
      const colNames = columns.map(c => c.COLUMN_NAME.toLowerCase());
      console.log('  Existing columns:', colNames.join(', '));

      if (!colNames.includes('username')) {
        await query(`ALTER TABLE file_views ADD COLUMN username VARCHAR(255) NOT NULL DEFAULT ''`);
        console.log('  ✅ Added: username');
      }
      if (!colNames.includes('full_name')) {
        await query(`ALTER TABLE file_views ADD COLUMN full_name VARCHAR(255)`);
        console.log('  ✅ Added: full_name');
      }
      if (!colNames.includes('role')) {
        await query(`ALTER TABLE file_views ADD COLUMN role VARCHAR(100)`);
        console.log('  ✅ Added: role');
      }
      if (!colNames.includes('viewed_at')) {
        await query(`ALTER TABLE file_views ADD COLUMN viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        console.log('  ✅ Added: viewed_at');
      }

      // Try adding unique key (ignore if already exists)
      try {
        await query(`ALTER TABLE file_views ADD UNIQUE KEY unique_user_file (file_id, user_id)`);
        console.log('  ✅ Added unique key');
      } catch (e) {
        console.log('  ⏭️  Unique key already exists');
      }

      console.log('  ✅ All columns verified');
    }

    // Show final table structure
    const finalCols = await query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_views'
       ORDER BY ORDINAL_POSITION`
    );
    console.log('\n📋 Final file_views structure:');
    finalCols.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.COLUMN_TYPE}, nullable: ${c.IS_NULLABLE})`));

    console.log('\n✅ Done! Restart your server now.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

fix();

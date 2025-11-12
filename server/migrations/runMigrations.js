const { db, USE_MYSQL } = require('../config/database');

async function runMigrations() {
  try {
    console.log('🔄 Checking database migrations...');
    
    if (!USE_MYSQL) {
      console.log('⏭️  Skipping migrations (SQLite mode)');
      return true;
    }
    
    // For MySQL, check and add tag column
    const mysqlConfig = require('../../database/config');
    
    // Check if tag column exists
    const checkColumn = await mysqlConfig.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'files' 
      AND COLUMN_NAME = 'tag'
    `);
    
    if (!checkColumn || checkColumn.length === 0) {
      console.log('🔄 Adding tag column to files table...');
      await mysqlConfig.query(`ALTER TABLE files ADD COLUMN tag VARCHAR(100)`);
      console.log('✅ Successfully added tag column');
      
      // Add index
      try {
        await mysqlConfig.query(`CREATE INDEX idx_files_tag ON files(tag)`);
        console.log('✅ Successfully added index on tag column');
      } catch (error) {
        if (!error.message.includes('Duplicate key name')) {
          console.warn('⚠️ Could not create index:', error.message);
        }
      }
    } else {
      console.log('✅ Tag column already exists');
    }
    
    console.log('✅ All migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error);
    // Don't fail the server startup if migrations fail
    return false;
  }
}

module.exports = runMigrations;

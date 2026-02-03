const { USE_MYSQL } = require('../config/database');

async function migrate() {
  try {
    if (!USE_MYSQL) {
      // In SQLite, we handle this in initialize.js usually, but let's be safe
      return true;
    }

    const mysqlConfig = require('../../database/config');

    // Check if tag column exists
    const columns = await mysqlConfig.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'files' 
      AND COLUMN_NAME = 'tag'
    `);

    if (!columns || columns.length === 0) {
      console.log('🔄 Adding tag column to files table...');
      await mysqlConfig.query('ALTER TABLE files ADD COLUMN tag VARCHAR(100)');
      console.log('✅ Successfully added tag column');

      // Add index
      try {
        await mysqlConfig.query('CREATE INDEX idx_files_tag ON files(tag)');
        console.log('✅ Successfully added index on tag column');
      } catch (error) {
        if (!error.message.includes('Duplicate key name')) {
          console.warn('⚠️ Could not create index:', error.message);
        }
      }
    } else {
      // console.log('✅ Tag column already exists');
    }

    return true;
  } catch (error) {
    console.error('❌ Migration 001 error:', error.message);
    return false;
  }
}

module.exports = migrate;

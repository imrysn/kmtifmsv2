const path = require('path');

/**
 * Migration: Add folder support to files table (MySQL Only)
 * Adds columns: folder_name, relative_path, is_folder
 */

async function addFolderColumns() {
  console.log('🔄 Adding folder support columns to files table...');

  const mysqlConfig = require(path.join(__dirname, '../../database/config'));

  try {
    // Check if columns already exist
    const columns = await mysqlConfig.query('SHOW COLUMNS FROM files');
    const columnNames = columns.map(col => col.Field);

    if (!columnNames.includes('folder_name')) {
      await mysqlConfig.query(`
        ALTER TABLE files 
        ADD COLUMN folder_name VARCHAR(255) DEFAULT NULL AFTER description
      `);
      console.log('✅ Added folder_name column');
    }

    if (!columnNames.includes('relative_path')) {
      await mysqlConfig.query(`
        ALTER TABLE files 
        ADD COLUMN relative_path VARCHAR(500) DEFAULT NULL AFTER folder_name
      `);
      console.log('✅ Added relative_path column');
    }

    if (!columnNames.includes('is_folder')) {
      await mysqlConfig.query(`
        ALTER TABLE files 
        ADD COLUMN is_folder BOOLEAN DEFAULT 0 AFTER relative_path
      `);
      console.log('✅ Added is_folder column');
    }

    console.log('✅ Folder support migration completed');
    return true;

  } catch (error) {
    console.error('❌ MySQL migration error:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  addFolderColumns()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addFolderColumns;

const path = require('path');
const { db, USE_MYSQL } = require(path.join(__dirname, '../config/database'));

/**
 * Migration: Add folder support to files table
 * Adds columns: folder_name, relative_path, is_folder
 */

async function addFolderColumns() {
  console.log('🔄 Adding folder support columns to files table...');

  if (USE_MYSQL) {
    // MySQL version
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
        console.log('✅ Added folder_name column (MySQL)');
      }
      
      if (!columnNames.includes('relative_path')) {
        await mysqlConfig.query(`
          ALTER TABLE files 
          ADD COLUMN relative_path VARCHAR(500) DEFAULT NULL AFTER folder_name
        `);
        console.log('✅ Added relative_path column (MySQL)');
      }
      
      if (!columnNames.includes('is_folder')) {
        await mysqlConfig.query(`
          ALTER TABLE files 
          ADD COLUMN is_folder BOOLEAN DEFAULT 0 AFTER relative_path
        `);
        console.log('✅ Added is_folder column (MySQL)');
      }
      
      console.log('✅ Folder support migration completed (MySQL)');
      return true;
      
    } catch (error) {
      console.error('❌ MySQL migration error:', error);
      throw error;
    }
    
  } else {
    // SQLite version
    return new Promise((resolve, reject) => {
      // Check if columns already exist
      db.all('PRAGMA table_info(files)', (err, columns) => {
        if (err) {
          console.error('❌ Error getting table info:', err);
          reject(err);
          return;
        }
        
        const columnNames = columns.map(col => col.name);
        const alterPromises = [];
        
        if (!columnNames.includes('folder_name')) {
          alterPromises.push(new Promise((resolve, reject) => {
            db.run('ALTER TABLE files ADD COLUMN folder_name TEXT DEFAULT NULL', (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Added folder_name column (SQLite)');
                resolve();
              }
            });
          }));
        }
        
        if (!columnNames.includes('relative_path')) {
          alterPromises.push(new Promise((resolve, reject) => {
            db.run('ALTER TABLE files ADD COLUMN relative_path TEXT DEFAULT NULL', (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Added relative_path column (SQLite)');
                resolve();
              }
            });
          }));
        }
        
        if (!columnNames.includes('is_folder')) {
          alterPromises.push(new Promise((resolve, reject) => {
            db.run('ALTER TABLE files ADD COLUMN is_folder INTEGER DEFAULT 0', (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Added is_folder column (SQLite)');
                resolve();
              }
            });
          }));
        }
        
        if (alterPromises.length === 0) {
          console.log('ℹ️ All folder columns already exist');
          resolve();
          return;
        }
        
        Promise.all(alterPromises)
          .then(() => {
            console.log('✅ Folder support migration completed (SQLite)');
            resolve();
          })
          .catch(reject);
      });
    });
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

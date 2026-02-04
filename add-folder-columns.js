const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kmtifms'
  });

  try {
    console.log('🔄 Adding folder support columns to MySQL files table...');
    
    const [columns] = await connection.execute('SHOW COLUMNS FROM files');
    const columnNames = columns.map(col => col.Field);
    
    const columnsToAdd = [
      { name: 'folder_name', definition: 'VARCHAR(255) DEFAULT NULL AFTER description' },
      { name: 'relative_path', definition: 'VARCHAR(500) DEFAULT NULL AFTER folder_name' },
      { name: 'is_folder', definition: 'BOOLEAN DEFAULT 0 AFTER relative_path' }
    ];

    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        await connection.execute(`ALTER TABLE files ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column`);
      } else {
        console.log(`ℹ️ ${col.name} column already exists`);
      }
    }
    
    console.log('\n✅ Folder support columns added successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addColumns();

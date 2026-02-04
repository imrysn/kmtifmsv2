require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixDatabaseSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const conn = await pool.getConnection();
    
    console.log('\n🔧 Fixing database schema...\n');
    
    console.log('1️⃣ Checking file_status_history table...');
    const [tables] = await conn.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_status_history'",
      [process.env.DB_NAME]
    );
    
    if (tables.length === 0) {
      console.log('   Creating file_status_history table...');
      await conn.query(`
        CREATE TABLE file_status_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          old_status VARCHAR(50),
          new_status VARCHAR(50),
          old_stage VARCHAR(50),
          new_stage VARCHAR(50),
          changed_by_id INT,
          changed_by_username VARCHAR(100),
          changed_by_role VARCHAR(50),
          comment TEXT,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          INDEX (file_id),
          INDEX (changed_at)
        )
      `);
      console.log('   ✅ Created file_status_history table');
    } else {
      console.log('   ✅ file_status_history table exists');
      
      const [columns] = await conn.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_status_history' AND COLUMN_NAME = 'comment'",
        [process.env.DB_NAME]
      );
      
      if (columns.length === 0) {
        console.log('   Adding comment column...');
        await conn.query('ALTER TABLE file_status_history ADD COLUMN comment TEXT AFTER changed_by_role');
        console.log('   ✅ Added comment column');
      }
    }
    
    console.log('\n✅ Database schema fixed!\n');
    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabaseSchema();

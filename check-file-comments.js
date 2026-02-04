require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAndCreateCommentsTable() {
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
    
    console.log('🔍 Checking file_comments table...');
    const [tables] = await conn.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_comments'",
      [process.env.DB_NAME]
    );

    if (tables.length === 0) {
      console.log('❌ file_comments table does not exist. Creating it...');
      
      await conn.query(`
        CREATE TABLE file_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          user_id INT NOT NULL,
          username VARCHAR(255),
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          INDEX (file_id),
          INDEX (created_at)
        )
      `);
      console.log('✅ Created file_comments table');
    } else {
      console.log('✅ file_comments table already exists');
      
      const [columns] = await conn.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_comments' AND COLUMN_NAME = 'comment'",
        [process.env.DB_NAME]
      );
      
      if (columns.length === 0) {
        console.log('⚠️ comment column missing, adding it...');
        await conn.query('ALTER TABLE file_comments ADD COLUMN comment TEXT AFTER username');
        console.log('✅ Added comment column');
      }
    }

    const [structure] = await conn.query('DESCRIBE file_comments');
    console.log('\n📋 file_comments table structure:');
    console.table(structure);

    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndCreateCommentsTable();

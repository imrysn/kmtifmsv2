require('dotenv').config();
const mysql = require('mysql2/promise');

async function initializeDatabase() {
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
    
    console.log(`\n🗄️ Initializing ${process.env.DB_NAME} database\n`);
    
    // Ensure files table has folder columns
    console.log('1️⃣ Checking files table...');
    const [filesColumns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'files' AND COLUMN_NAME IN ('folder_name', 'relative_path', 'is_folder')",
      [process.env.DB_NAME]
    );
    
    const columnNames = filesColumns.map(c => c.COLUMN_NAME);
    const columnsToAdd = [
      { name: 'folder_name', sql: 'ALTER TABLE files ADD COLUMN folder_name VARCHAR(255) DEFAULT NULL' },
      { name: 'relative_path', sql: 'ALTER TABLE files ADD COLUMN relative_path VARCHAR(500) DEFAULT NULL' },
      { name: 'is_folder', sql: 'ALTER TABLE files ADD COLUMN is_folder TINYINT(1) DEFAULT 0' }
    ];

    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        console.log(`   Adding ${col.name} column...`);
        await conn.query(col.sql);
        console.log(`   ✅ Added ${col.name}`);
      }
    }
    
    // Ensure file_comments table exists
    console.log('\n2️⃣ Checking file_comments table...');
    const [commentTables] = await conn.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_comments'",
      [process.env.DB_NAME]
    );
    
    if (commentTables.length === 0) {
      console.log('   Creating file_comments table...');
      await conn.query(`
        CREATE TABLE file_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          user_id INT NOT NULL,
          username VARCHAR(100) DEFAULT NULL,
          user_role ENUM('USER','TEAM_LEADER','ADMIN') NOT NULL,
          comment TEXT NOT NULL,
          comment_type ENUM('general','approval','rejection','revision') DEFAULT 'general',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          INDEX (file_id),
          INDEX (created_at)
        )
      `);
      console.log('   ✅ Created file_comments table');
    } else {
      console.log('   ✅ file_comments table exists');
      
      const [commentCols] = await conn.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_comments' AND COLUMN_NAME = 'comment'",
        [process.env.DB_NAME]
      );
      
      if (commentCols.length === 0) {
        console.log('   Adding comment column...');
        await conn.query('ALTER TABLE file_comments ADD COLUMN comment TEXT NOT NULL AFTER user_role');
        console.log('   ✅ Added comment column');
      }
    }
    
    // Test query
    console.log('\n3️⃣ Testing file retrieval queries...');
    const [result] = await conn.query(`
      SELECT f.*, fc.comment as latest_comment
      FROM files f
      LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
        SELECT MAX(id) FROM file_comments WHERE file_id = f.id
      )
      WHERE f.user_id = ? 
      ORDER BY f.uploaded_at DESC LIMIT 1
    `, [2]);
    console.log('   ✅ File query works');
    
    console.log('\n✅ Database initialization complete!\n');
    conn.release();
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase();

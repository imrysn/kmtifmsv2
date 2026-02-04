require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugCommentError() {
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
    
    console.log(`\n🔍 Connected to ${process.env.DB_NAME} database on ${process.env.DB_HOST}\n`);
    
    // Show all tables
    console.log('📋 All tables in database:');
    const [tables] = await conn.query('SHOW TABLES');
    console.table(tables);
    
    // Check files table structure
    console.log('\n📋 Files table structure:');
    const [filesStructure] = await conn.query('DESCRIBE files');
    console.table(filesStructure);
    
    // Check file_comments table
    console.log('\n🔍 Checking file_comments table...');
    const [commentTables] = await conn.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'file_comments'",
      [process.env.DB_NAME]
    );
    
    if (commentTables.length === 0) {
      console.log('❌ file_comments table does NOT exist!');
    } else {
      console.log('✅ file_comments table exists');
      const [commentStructure] = await conn.query('DESCRIBE file_comments');
      console.table(commentStructure);
    }
    
    // Try the problematic query
    console.log('\n🧪 Testing the problematic query...');
    try {
      const [result] = await conn.query(`
        SELECT f.*, fc.comment as latest_comment
        FROM files f
        LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
          SELECT MAX(id) FROM file_comments WHERE file_id = f.id
        )
        WHERE f.user_id = ?
        ORDER BY f.uploaded_at DESC LIMIT 1
      `, [2]);
      console.log('✅ Query succeeded!');
      console.log(result);
    } catch (queryErr) {
      console.error('❌ Query failed:', queryErr.message);
    }

    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugCommentError();

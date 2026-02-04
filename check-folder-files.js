require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkFolderFiles() {
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
    
    console.log('\n📊 Checking files with folder_name:\n');
    
    const [filesWithFolder] = await conn.query(`
      SELECT id, original_name, folder_name, relative_path, is_folder, uploaded_at, user_id, username
      FROM files
      WHERE folder_name IS NOT NULL
      ORDER BY uploaded_at DESC
      LIMIT 20
    `);
    
    console.log(`Files with folder_name (${filesWithFolder.length} total):`);
    if (filesWithFolder.length === 0) {
      console.log('  ❌ NO FILES WITH folder_name FOUND!');
    } else {
      console.table(filesWithFolder);
    }
    
    const [totalFiles] = await conn.query('SELECT COUNT(*) as total FROM files');
    console.log(`\n📈 Total files: ${totalFiles[0].total}`);
    
    console.log('\n📋 Most recent files (last 10):\n');
    const [recentFiles] = await conn.query(`
      SELECT id, original_name, folder_name, relative_path, is_folder, uploaded_at, username
      FROM files
      ORDER BY uploaded_at DESC
      LIMIT 10
    `);
    console.table(recentFiles);
    
    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFolderFiles();

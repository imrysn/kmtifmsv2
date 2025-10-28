const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const fs = require('fs');
const path = require('path');

async function migrateCommentReplies() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kmtifms',
      multipleStatements: true
    });

    console.log('Connected to database');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'sql', 'add-comment-replies.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing comment replies migration...');
    
    // Execute SQL
    const [results] = await connection.query(sql);
    
    console.log('✅ Comment replies table created successfully!');
    
    // Verify table was created
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'comment_replies'"
    );
    
    if (tables.length > 0) {
      console.log('✅ Verified: comment_replies table exists');
      
      // Show table structure
      const [columns] = await connection.query(
        "DESCRIBE comment_replies"
      );
      
      console.log('\nTable Structure:');
      console.table(columns);
    } else {
      console.log('⚠️  Warning: comment_replies table not found after migration');
    }

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run migration
console.log('Starting comment replies migration...\n');
migrateCommentReplies();

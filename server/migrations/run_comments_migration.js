const fs = require('fs');
const path = require('path');
const { query } = require('../../database/config');

async function runCommentsMigration() {
  try {
    console.log('📊 Starting comments migration...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create_comments_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await query(statement);
    }
    
    console.log('✅ Comments migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runCommentsMigration();

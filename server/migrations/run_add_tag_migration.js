const { query } = require('../../database/config');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add_tag_to_files.sql');
    
    const migrationPath = path.join(__dirname, 'add_tag_to_files.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await query(statement);
      console.log('✅ Success');
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

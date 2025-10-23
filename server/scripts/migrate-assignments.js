const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('📦 Running assignments table migration...\n');

    const sqlFile = path.join(__dirname, '../migrations/create_assignments_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await db.query(statement);
      console.log('✅ Executed:', statement.substring(0, 50) + '...');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Created tables:');
    console.log('   • assignments');
    console.log('   • assignment_members');
    console.log('   • assignment_submissions');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

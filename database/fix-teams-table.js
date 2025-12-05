// Quick Fix: Add missing updated_at column to teams table
// Run this if you need teams working immediately without recreating tables

const { getPool, testConnection, closePool } = require('./config');

async function addMissingColumn() {
  console.log('🔧 Adding missing updated_at column to teams table...\n');
  
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to MySQL database.');
      process.exit(1);
    }
    
    const pool = getPool();
    
    // Check if column already exists
    const [columns] = await pool.query("SHOW COLUMNS FROM teams LIKE 'updated_at'");
    
    if (columns.length > 0) {
      console.log('✅ Column updated_at already exists in teams table');
      console.log('   No changes needed\n');
    } else {
      console.log('📝 Adding updated_at column...');
      await pool.query(`
        ALTER TABLE teams 
        ADD COLUMN updated_at DATETIME NULL
      `);
      console.log('✅ Column added successfully\n');
    }
    
    // Verify it was added
    const [verifyColumns] = await pool.query("SHOW COLUMNS FROM teams");
    console.log('📊 Current teams table structure:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    console.log('\n✅ Teams table is now ready!');
    console.log('   You can now create teams in the application.\n');
    
  } catch (error) {
    console.error('❌ Failed to add column:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  addMissingColumn().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { addMissingColumn };

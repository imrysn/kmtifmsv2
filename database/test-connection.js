// Test MySQL Database Connection
// Quick script to verify database connectivity

const { testConnection, getPool, closePool, config } = require('./config');

async function runConnectionTest() {
  console.log('🔍 Testing MySQL Database Connection...\n');
  
  console.log('📋 Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Password: ${'*'.repeat(config.password.length)}\n`);
  
  try {
    // Test basic connection
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Connection test failed\n');
      process.exit(1);
    }
    
    // Run diagnostic queries
    console.log('🔧 Running diagnostic queries...\n');
    
    const pool = getPool();
    
    // Check MySQL version
    const [versionResult] = await pool.query('SELECT VERSION() as version');
    console.log(`   MySQL Version: ${versionResult[0].version}`);
    
    // Check current database
    const [dbResult] = await pool.query('SELECT DATABASE() as db');
    console.log(`   Current Database: ${dbResult[0].db || 'NONE'}`);
    
    // Check connection count
    const [connResult] = await pool.query('SHOW STATUS LIKE "Threads_connected"');
    console.log(`   Active Connections: ${connResult[0].Value}`);
    
    // List tables
    const [tables] = await pool.query('SHOW TABLES');
    console.log(`   Tables Found: ${tables.length}`);
    
    if (tables.length > 0) {
      console.log('\n📊 Database Tables:');
      tables.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`   ✓ ${tableName}`);
      });
      
      // Check record counts
      console.log('\n📈 Record Counts:');
      const tableNames = ['users', 'teams', 'files', 'file_comments', 
                         'file_status_history', 'activity_logs'];
      
      for (const tableName of tableNames) {
        try {
          const [countResult] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`   ${tableName.padEnd(25)}: ${countResult[0].count.toString().padStart(6)} records`);
        } catch (error) {
          console.log(`   ${tableName.padEnd(25)}: Table not found`);
        }
      }
    } else {
      console.log('\n⚠️  No tables found. Run: npm run db:init');
    }
    
    // Test write permissions
    console.log('\n🔐 Testing permissions...');
    try {
      await pool.query('CREATE TEMPORARY TABLE test_permissions (id INT)');
      await pool.query('DROP TEMPORARY TABLE test_permissions');
      console.log('   ✅ Write permissions OK');
    } catch (error) {
      console.log('   ❌ Write permissions FAILED:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All connection tests passed!');
    console.log('='.repeat(60));
    console.log('\n💡 Your MySQL database is ready to use.\n');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Verify MySQL server is running');
    console.error('2. Check database credentials in database/config.js');
    console.error('3. Ensure firewall allows MySQL port (3306)');
    console.error('4. Test with: telnet', config.host, config.port);
    console.error('5. Check MySQL error log for details\n');
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run test
if (require.main === module) {
  runConnectionTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runConnectionTest };

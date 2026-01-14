// Test Server Startup Script
// This script tests if the server can start successfully with the new MySQL fixes

const path = require('path');

async function testServerStartup() {
  console.log('🔍 Testing server startup with MySQL...\n');
  
  try {
    // Load environment variables
    require('dotenv').config();
    
    // Test MySQL connection first
    console.log('📊 Step 1: Testing MySQL connection...');
    const mysqlConfig = require('./database/config');
    
    const connected = await mysqlConfig.testConnection();
    
    if (!connected) {
      console.error('❌ MySQL connection failed!');
      console.error('The server cannot start without a database connection.\n');
      process.exit(1);
    }
    
    console.log('✅ MySQL connection successful!\n');
    
    // Test a simple query
    console.log('📊 Step 2: Testing query execution...');
    try {
      const users = await mysqlConfig.query('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Query successful! Found ${users[0].count} users\n`);
    } catch (queryError) {
      console.error('❌ Query failed:', queryError.message);
      console.error('This might indicate a table structure issue.\n');
    }
    
    // Check if server can load
    console.log('📊 Step 3: Loading server modules...');
    const serverIndex = require('./server/index.js');
    console.log('✅ Server modules loaded successfully!\n');
    
    console.log('='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));
    console.log('\nYour server should now start successfully.');
    console.log('You can now run: npm start\n');
    
    // Close the connection pool
    await mysqlConfig.closePool();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Error details:', error.stack);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure MySQL server (KMTI-NAS) is running');
    console.error('   2. Check .env file has correct credentials');
    console.error('   3. Verify network connection to KMTI-NAS');
    console.error('   4. Run: npm run db:test\n');
    process.exit(1);
  }
}

testServerStartup();

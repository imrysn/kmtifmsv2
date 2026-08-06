// Quick MySQL Connection Test
require('dotenv').config();

console.log('\n🔍 Testing MySQL Connection...\n');
console.log('Configuration:');
console.log(`  Host: ${process.env.DB_HOST}`);
console.log(`  Port: ${process.env.DB_PORT}`);
console.log(`  Database: ${process.env.DB_NAME}`);
console.log(`  User: ${process.env.DB_USER}`);
console.log(`\n🔌 Attempting to connect...\n`);

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kmtifms',
};

async function testConnection() {
  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Successfully connected to MySQL database!');
    console.log('\n📊 Database Info:');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT DATABASE() as db, VERSION() as version');
    console.log(`  Current Database: ${rows[0].db}`);
    console.log(`  MySQL Version: ${rows[0].version}`);
    
    await connection.end();
    console.log('\n✅ Connection test completed successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to MySQL:');
    console.error(`  Error: ${error.message}`);
    console.error(`  Code: ${error.code}`);
    console.error('\n💡 Possible issues:');
    console.error('  1. MySQL server is not running');
    console.error('  2. Network connectivity issues');
    console.error('  3. Incorrect credentials in .env file');
    console.error('  4. Database does not exist');
    console.error('  5. Firewall blocking port 3306\n');
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});

// Quick MySQL Verification Script
require('dotenv').config();

console.log('\n🔍 KMTIFMS2 Database Configuration Check\n');
console.log('='.repeat(60));

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log(`   USE_MYSQL: ${process.env.USE_MYSQL}`);
console.log(`   DB_HOST: ${process.env.DB_HOST}`);
console.log(`   DB_PORT: ${process.env.DB_PORT}`);
console.log(`   DB_NAME: ${process.env.DB_NAME}`);
console.log(`   DB_USER: ${process.env.DB_USER}`);
console.log(`   DB_PASSWORD: ${'*'.repeat((process.env.DB_PASSWORD || '').length)}`);

// Check what the server will use
const USE_MYSQL = process.env.USE_MYSQL === 'true' || process.env.DB_HOST;
console.log('\n🗄️  Database Mode:');
console.log(`   ${USE_MYSQL ? '✅ MySQL ENABLED' : '❌ SQLite (fallback)'}`);

if (USE_MYSQL) {
  console.log('\n✨ MySQL Configuration:');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || '3306'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'kmtifms'}`);
  console.log(`   User: ${process.env.DB_USER || 'root'}`);
  
  // Test connection
  console.log('\n🔌 Testing connection...');
  const mysql = require('mysql2/promise');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kmtifms',
    connectTimeout: 10000
  };
  
  mysql.createConnection(config)
    .then(async (connection) => {
      console.log('   ✅ Connection successful!');
      
      // Test query
      const [rows] = await connection.query('SELECT VERSION() as version, DATABASE() as db');
      console.log(`   MySQL Version: ${rows[0].version}`);
      console.log(`   Current Database: ${rows[0].db}`);
      
      // Check tables
      const [tables] = await connection.query('SHOW TABLES');
      console.log(`   Tables Found: ${tables.length}`);
      
      if (tables.length > 0) {
        console.log('\n📊 Available Tables:');
        tables.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`      ✓ ${tableName}`);
        });
      }
      
      await connection.end();
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ MySQL is configured correctly and operational!');
      console.log('='.repeat(60));
      console.log('\n💡 Your server will use MySQL for all operations.');
      console.log('🚀 Start the server with: npm run server:standalone\n');
    })
    .catch((error) => {
      console.log('   ❌ Connection failed!');
      console.log(`   Error: ${error.message}`);
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check if MySQL is running on KMTI-NAS');
      console.log('   2. Verify firewall allows port 3306');
      console.log('   3. Test with: telnet KMTI-NAS 3306');
      console.log('   4. Verify database credentials are correct');
      console.log('   5. Run: npm run db:init (to create database if needed)\n');
    });
    
} else {
  console.log('\n⚠️  MySQL is NOT configured!');
  console.log('\n📝 To enable MySQL, ensure your .env file has:');
  console.log('   USE_MYSQL=true');
  console.log('   DB_HOST=KMTI-NAS');
  console.log('   DB_PORT=3306');
  console.log('   DB_NAME=kmtifms');
  console.log('   DB_USER=kmtifms_user');
  console.log('   DB_PASSWORD=your-password\n');
}

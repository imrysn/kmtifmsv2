// Diagnostic Script for KMTI FMS
// Run this to diagnose startup issues

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 KMTI File Management System - Diagnostic Report\n');
console.log('='.repeat(70));

// Check environment
console.log('\n📋 Environment Configuration:');
require('dotenv').config();

console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   USE_MYSQL: ${process.env.USE_MYSQL || 'not set'}`);
console.log(`   DB_HOST: ${process.env.DB_HOST || 'not set'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'not set'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'not set'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'not set'}`);
console.log(`   SERVER_PORT: ${process.env.SERVER_PORT || 'not set'}`);

// Check database files
console.log('\n📁 Database Files:');
const dbConfigPath = path.join(__dirname, 'database', 'config.js');
const serverIndexPath = path.join(__dirname, 'server', 'index.js');
const dotenvPath = path.join(__dirname, '.env');

console.log(`   database/config.js: ${fs.existsSync(dbConfigPath) ? '✅ Found' : '❌ Missing'}`);
console.log(`   server/index.js: ${fs.existsSync(serverIndexPath) ? '✅ Found' : '❌ Missing'}`);
console.log(`   .env file: ${fs.existsSync(dotenvPath) ? '✅ Found' : '❌ Missing'}`);

// Check if MySQL is configured
console.log('\n🗄️  Database Configuration:');
if (process.env.USE_MYSQL === 'true' || process.env.DB_HOST) {
  console.log('   Type: MySQL');
  console.log('   Status: Configured');
  
  // Test MySQL connection
  console.log('\n📡 Testing MySQL Connection...');
  testMySQL().then(() => {
    // Test Express server
    console.log('\n🌐 Testing Express Server...');
    testExpressServer();
  }).catch(err => {
    console.error('   ❌ MySQL test failed:', err.message);
    finishReport();
  });
} else {
  console.log('   Type: SQLite');
  console.log('   Status: Fallback mode');
  
  // Test Express server
  console.log('\n🌐 Testing Express Server...');
  testExpressServer();
}

async function testMySQL() {
  try {
    const mysqlConfig = require('./database/config');
    const connected = await mysqlConfig.testConnection();
    
    if (connected) {
      console.log('   ✅ MySQL connection successful');
      
      // Try a simple query
      try {
        const result = await mysqlConfig.query('SELECT 1 as test');
        console.log('   ✅ Query execution successful');
      } catch (queryErr) {
        console.log('   ⚠️  Connection OK but query failed:', queryErr.message);
      }
    } else {
      console.log('   ❌ MySQL connection failed');
      console.log('   💡 Check if KMTI-NAS is accessible');
    }
    
    await mysqlConfig.closePool();
  } catch (error) {
    console.error('   ❌ MySQL error:', error.message);
    throw error;
  }
}

function testExpressServer() {
  const PORT = process.env.SERVER_PORT || 3001;
  console.log(`   Checking port ${PORT}...`);
  
  const req = http.get(`http://localhost:${PORT}/api/health`, { timeout: 3000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('   ✅ Express server is running');
        try {
          const health = JSON.parse(data);
          console.log(`   📊 Server status: ${health.status}`);
          console.log(`   🗄️  Database: ${health.database}`);
        } catch (e) {
          // Ignore JSON parse error
        }
      } else {
        console.log(`   ⚠️  Express server responded with status ${res.statusCode}`);
      }
      finishReport();
    });
  });
  
  req.on('error', (error) => {
    console.log('   ❌ Express server not responding');
    console.log('   💡 The server may not be running');
    console.log(`   💡 Try: node server.js`);
    finishReport();
  });
  
  req.on('timeout', () => {
    req.destroy();
    console.log('   ❌ Connection timeout');
    finishReport();
  });
}

function finishReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📝 Diagnostic Report Complete');
  console.log('='.repeat(70));
  console.log('\n💡 Next Steps:');
  console.log('   1. If MySQL failed: Check network connection to KMTI-NAS');
  console.log('   2. If Express failed: Run "node server.js" to see errors');
  console.log('   3. If all passed: Run "npm start" to launch the app\n');
  
  setTimeout(() => process.exit(0), 500);
}

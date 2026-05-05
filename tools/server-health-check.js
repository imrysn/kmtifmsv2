#!/usr/bin/env node

// KMTI FMS Server Health Check
// Verifies that all server components are properly configured

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🏥 KMTI FMS Server Health Check');
console.log('='.repeat(70) + '\n');

let allChecksPass = true;

// Check 1: Node.js version
console.log('📦 Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 16) {
  console.log(`   ✅ Node.js ${nodeVersion} (OK)`);
} else {
  console.log(`   ❌ Node.js ${nodeVersion} (Requires v16 or higher)`);
  allChecksPass = false;
}

// Check 2: Required files exist
console.log('\n📁 Checking required files...');
const requiredFiles = [
  'server.js',
  'server/index.js',
  'server/config/database.js',
  'package.json',
  '.env'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} (MISSING)`);
    allChecksPass = false;
  }
});

// Check 3: Dependencies installed
console.log('\n📚 Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules exists');
  
  // Check critical dependencies
  const criticalDeps = ['express', 'mysql2', 'sqlite3', 'dotenv', 'cors'];
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`   ✅ ${dep}`);
    } else {
      console.log(`   ❌ ${dep} (MISSING - run: npm install)`);
      allChecksPass = false;
    }
  });
} else {
  console.log('   ❌ node_modules missing (run: npm install)');
  allChecksPass = false;
}

// Check 4: Environment configuration
console.log('\n⚙️  Checking environment configuration...');
try {
  require('dotenv').config();
  console.log('   ✅ .env file loaded');
  
  const useMySQL = process.env.USE_MYSQL === 'true' || process.env.DB_HOST;
  if (useMySQL) {
    console.log('   📊 Database Mode: MySQL');
    console.log(`   🔧 DB Host: ${process.env.DB_HOST || 'NOT SET'}`);
    console.log(`   🔧 DB Port: ${process.env.DB_PORT || '3306'}`);
    console.log(`   🔧 DB Name: ${process.env.DB_NAME || 'NOT SET'}`);
    console.log(`   🔧 DB User: ${process.env.DB_USER || 'NOT SET'}`);
    
    if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
      console.log('   ⚠️  Warning: Some MySQL settings are missing');
    }
  } else {
    console.log('   📊 Database Mode: SQLite');
    console.log('   💡 To use MySQL, set USE_MYSQL=true in .env');
  }
  
  const serverPort = process.env.SERVER_PORT || 3001;
  console.log(`   🌐 Server Port: ${serverPort}`);
  
} catch (error) {
  console.log('   ❌ Error reading .env file:', error.message);
  allChecksPass = false;
}

// Check 5: Port availability
console.log('\n🔌 Checking port availability...');
const net = require('net');
const port = process.env.SERVER_PORT || 3001;

const server = net.createServer();
server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`   ⚠️  Port ${port} is already in use`);
    console.log('   💡 Solution: Kill the process or change SERVER_PORT in .env');
  } else {
    console.log(`   ❌ Port check error: ${err.message}`);
  }
});

server.once('listening', () => {
  console.log(`   ✅ Port ${port} is available`);
  server.close();
});

server.listen(port);

// Check 6: Database connectivity (if MySQL)
setTimeout(async () => {
  if (process.env.USE_MYSQL === 'true' || process.env.DB_HOST) {
    console.log('\n🗄️  Checking MySQL connectivity...');
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
      
      const [rows] = await connection.execute('SELECT 1 as test');
      console.log('   ✅ MySQL connection successful');
      await connection.end();
    } catch (error) {
      console.log('   ❌ MySQL connection failed:', error.message);
      console.log('   💡 Run: node test-mysql-connection.js for details');
      allChecksPass = false;
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  if (allChecksPass) {
    console.log('✅ All health checks passed!');
    console.log('\n🚀 You can start the server with:');
    console.log('   • npm start (development mode)');
    console.log('   • node server.js (direct start)');
    console.log('   • start-server-direct.bat (Windows helper)\n');
  } else {
    console.log('⚠️  Some health checks failed!');
    console.log('\n📖 Check SERVER-TROUBLESHOOTING.md for solutions\n');
  }
  console.log('='.repeat(70) + '\n');
  
  process.exit(allChecksPass ? 0 : 1);
}, 1000);

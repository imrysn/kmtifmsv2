#!/usr/bin/env node

// KMTI FMS Server Health Check
// Verifies that all server components are properly configured.

const fs = require('fs');
const path = require('path');
const net = require('net');

console.log('\n' + '='.repeat(70));
console.log('KMTI FMS Server Health Check');
console.log('='.repeat(70) + '\n');

let allChecksPass = true;

console.log('Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (majorVersion >= 16) {
  console.log(`   OK Node.js ${nodeVersion}`);
} else {
  console.log(`   FAIL Node.js ${nodeVersion} (requires v16 or higher)`);
  allChecksPass = false;
}

console.log('\nChecking required files...');
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
    console.log(`   OK ${file}`);
  } else {
    console.log(`   FAIL ${file} (missing)`);
    allChecksPass = false;
  }
});

console.log('\nChecking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   OK node_modules exists');

  const criticalDeps = ['express', 'mysql2', 'dotenv', 'cors'];
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      console.log(`   OK ${dep}`);
    } else {
      console.log(`   FAIL ${dep} (missing - run: npm install)`);
      allChecksPass = false;
    }
  });
} else {
  console.log('   FAIL node_modules missing (run: npm install)');
  allChecksPass = false;
}

console.log('\nChecking environment configuration...');
try {
  require('dotenv').config();
  console.log('   OK .env file loaded');
  console.log('   Database Mode: MySQL');
  console.log(`   DB Host: ${process.env.DB_HOST || 'NOT SET'}`);
  console.log(`   DB Port: ${process.env.DB_PORT || '3306'}`);
  console.log(`   DB Name: ${process.env.DB_NAME || 'NOT SET'}`);
  console.log(`   DB User: ${process.env.DB_USER || 'NOT SET'}`);

  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
    console.log('   WARN Some MySQL settings are missing');
  }

  const serverPort = process.env.SERVER_PORT || 3001;
  console.log(`   Server Port: ${serverPort}`);
} catch (error) {
  console.log('   FAIL Error reading .env file:', error.message);
  allChecksPass = false;
}

console.log('\nChecking port availability...');
const port = process.env.SERVER_PORT || 3001;
const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`   WARN Port ${port} is already in use`);
    console.log('   Solution: kill the process or change SERVER_PORT in .env');
  } else {
    console.log(`   FAIL Port check error: ${err.message}`);
    allChecksPass = false;
  }
});

server.once('listening', () => {
  console.log(`   OK Port ${port} is available`);
  server.close();
});

server.listen(port);

setTimeout(async () => {
  console.log('\nChecking MySQL connectivity...');
  try {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await connection.execute('SELECT 1 as test');
    console.log('   OK MySQL connection successful');
    await connection.end();
  } catch (error) {
    console.log('   FAIL MySQL connection failed:', error.message);
    console.log('   Run: node test-mysql-connection.js for details');
    allChecksPass = false;
  }

  console.log('\n' + '='.repeat(70));
  if (allChecksPass) {
    console.log('All health checks passed!');
    console.log('\nYou can start the server with:');
    console.log('   - npm start (development mode)');
    console.log('   - node server.js (direct start)');
  } else {
    console.log('Some health checks failed.');
  }
  console.log('='.repeat(70) + '\n');

  process.exit(allChecksPass ? 0 : 1);
}, 1000);

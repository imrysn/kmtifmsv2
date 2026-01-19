const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔄 Resetting database for File Approval System...');

// Delete existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ Deleted existing database');
}

console.log('🚀 Starting server to initialize new database with File Approval System...');
console.log('   - This will create all tables including file approval tables');
console.log('   - Sample files will be added to demonstrate the workflow');
console.log('   - All test users will be recreated\n');

// Start the server which will initialize the database
require('./server.js');

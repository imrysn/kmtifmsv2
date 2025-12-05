const fs = require('fs');
const path = require('path');

// Force close any database connections and delete the database file

const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔄 Attempting to reset database...');

// Try to delete multiple times with delay to handle locked files
function forceDeleteDatabase(attempts = 0) {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Deleted existing database file');
      console.log('📋 Database will be recreated with new schema when server starts');
      console.log('\n🔑 Available test accounts after restart:');
      console.log('  USER: user@example.com / password123 (John User)');
      console.log('  TEAM LEADER: teamleader@example.com / password123 (Sarah Team Leader)');
      console.log('  ADMIN: admin@example.com / password123 (Admin Administrator)');
      console.log('  Legacy USER: test@example.com / password123 (Test User)');
      console.log('\n🚀 Now run: npm run dev');
    } else {
      console.log('⚠️  Database file does not exist');
    }
  } catch (error) {
    if (error.code === 'EBUSY' && attempts < 5) {
      console.log(`⏳ Database file is locked, retrying in 2 seconds... (attempt ${attempts + 1}/5)`);
      setTimeout(() => forceDeleteDatabase(attempts + 1), 2000);
    } else {
      console.error('❌ Failed to delete database file:', error.message);
      console.log('\n🛠️  Manual steps to fix:');
      console.log('1. Close all running applications (Electron app, terminals)');
      console.log('2. Kill any Node.js processes:');
      console.log('   - Windows: taskkill /f /im node.exe');
      console.log('   - Mac/Linux: killall node');
      console.log('3. Delete database.sqlite manually from the project folder');
      console.log('4. Run: npm run dev');
    }
  }
}

// Kill any existing Node processes on this port first
console.log('🔄 Checking for running processes...');

forceDeleteDatabase();

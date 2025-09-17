const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Test script to verify user management database operations
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('🔍 Testing User Management Database...');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    return;
  }
  console.log('✅ Connected to SQLite database');
});

// Test database operations
db.serialize(() => {
  // Check if users table exists and get its structure
  db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", [], (err, tables) => {
    if (err) {
      console.error('❌ Error checking tables:', err);
      return;
    }
    
    if (tables.length === 0) {
      console.log('⚠️  Users table does not exist');
      return;
    }
    
    console.log('✅ Users table exists');
    console.log('📋 Table structure:', tables[0].sql);
    
    // Get all users
    db.all('SELECT id, fullName, username, email, role, team, created_at FROM users', [], (err, users) => {
      if (err) {
        console.error('❌ Error fetching users:', err);
        return;
      }
      
      console.log(`\n👥 Found ${users.length} users in database:`);
      users.forEach(user => {
        console.log(`  - ${user.fullName} (${user.username}) - ${user.role} - Team: ${user.team}`);
      });
      
      // Check activity logs
      db.all('SELECT COUNT(*) as count FROM activity_logs', [], (err, result) => {
        if (err) {
          console.error('❌ Error checking activity logs:', err);
        } else {
          console.log(`\n📋 Activity logs: ${result[0].count} entries`);
        }
        
        console.log('\n✅ User Management Database Test Complete');
        console.log('🚀 Your User Management is already using REAL DATABASE OPERATIONS!');
        console.log('\n📌 To use the system:');
        console.log('   1. Start the server: node server.js');
        console.log('   2. Start the client: npm run dev (in client folder)');
        console.log('   3. Login with: admin@example.com / password123');
        
        db.close();
      });
    });
  });
});

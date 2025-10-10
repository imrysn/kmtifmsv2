const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking database tables...\n');

// Check if teams table exists
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('❌ Error checking tables:', err);
    return;
  }
  
  console.log('📋 Existing tables:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  
  const hasTeamsTable = tables.some(table => table.name === 'teams');
  
  if (hasTeamsTable) {
    console.log('\n✅ Teams table exists');
    // Check teams data
    db.all('SELECT * FROM teams', [], (err, teams) => {
      if (err) {
        console.error('❌ Error reading teams:', err);
      } else {
        console.log(`\n🏢 Teams in database (${teams.length}):`);
        teams.forEach(team => {
          console.log(`  - ${team.name} (ID: ${team.id}, Leader: ${team.leader_username || 'None'})`);
        });
      }
      db.close();
    });
  } else {
    console.log('\n❌ Teams table does NOT exist');
    console.log('\n💡 Solution: Run "node reset-db.js" to recreate database with teams table');
    db.close();
  }
});

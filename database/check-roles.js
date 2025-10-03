// Check Role Values in Database
// This script shows what role values are actually stored in the users table

const { getPool, testConnection, closePool } = require('./config');

async function checkRoleValues() {
  console.log('🔍 Checking Role Values in Database...\n');
  
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to MySQL database.');
      process.exit(1);
    }
    
    const pool = getPool();
    
    // Get all users with their roles
    const [users] = await pool.query(`
      SELECT id, username, email, role 
      FROM users 
      ORDER BY role, username
    `);
    
    console.log('📊 Current Users and Roles:\n');
    console.log('ID  | Username       | Email                    | Role');
    console.log('-'.repeat(70));
    
    users.forEach(user => {
      const role = `'${user.role}'`; // Show quotes around role value
      console.log(`${String(user.id).padEnd(4)}| ${user.username.padEnd(15)}| ${user.email.padEnd(25)}| ${role}`);
    });
    
    // Get distinct role values
    const [roles] = await pool.query('SELECT DISTINCT role FROM users');
    
    console.log('\n📋 Distinct Role Values Found:');
    roles.forEach(r => {
      console.log(`   - '${r.role}' (length: ${r.role.length} characters)`);
    });
    
    // Check the enum definition
    const [columns] = await pool.query("SHOW COLUMNS FROM users WHERE Field = 'role'");
    if (columns.length > 0) {
      console.log('\n🔧 Database Role ENUM Definition:');
      console.log(`   ${columns[0].Type}`);
    }
    
    console.log('\n💡 Recommendation:');
    console.log('   If roles have spaces, update code to use spaces');
    console.log('   If roles have underscores, update database data to match enum\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  checkRoleValues().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { checkRoleValues };

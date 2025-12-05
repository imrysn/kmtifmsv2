// Reset Admin Password
// This script resets the admin password to 'admin123'

const bcrypt = require('bcryptjs');
const { getPool, testConnection, closePool } = require('./config');

async function resetAdminPassword() {
  console.log('🔐 Resetting Admin Password...\n');
  
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to MySQL database.');
      process.exit(1);
    }
    
    const pool = getPool();
    
    // Generate new password hash
    const newPassword = 'admin123';
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    console.log('📝 Generated password hash for: admin123');
    console.log(`   Hash: ${hashedPassword}\n`);
    
    // Check if admin user exists
    const [adminUsers] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    
    if (adminUsers.length === 0) {
      console.log('⚠️  Admin user not found. Creating new admin user...\n');
      
      // Create admin user
      await pool.query(`
        INSERT INTO users (fullName, username, email, password, role, team) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'System Administrator',
        'admin',
        'admin@kmti.local',
        hashedPassword,
        'ADMIN',
        'Administration'
      ]);
      
      console.log('✅ Admin user created successfully\n');
    } else {
      console.log('📝 Admin user found. Updating password...\n');
      
      // Update password
      await pool.query(`
        UPDATE users 
        SET password = ? 
        WHERE username = 'admin'
      `, [hashedPassword]);
      
      console.log('✅ Admin password updated successfully\n');
    }
    
    // Verify the update
    const [verifyAdmin] = await pool.query("SELECT id, username, email, role FROM users WHERE username = 'admin'");
    
    console.log('📊 Admin User Details:');
    console.log(`   ID: ${verifyAdmin[0].id}`);
    console.log(`   Username: ${verifyAdmin[0].username}`);
    console.log(`   Email: ${verifyAdmin[0].email}`);
    console.log(`   Role: ${verifyAdmin[0].role}\n`);
    
    console.log('=' .repeat(60));
    console.log('✅ Admin password reset complete!');
    console.log('=' .repeat(60));
    console.log('\n📝 Login Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n💡 You can now login to the application\n');
    
  } catch (error) {
    console.error('❌ Failed to reset password:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  resetAdminPassword().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { resetAdminPassword };

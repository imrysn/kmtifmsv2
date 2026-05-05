/**
 * Fix Role Enums Migration
 * Standardizes 'TEAM LEADER' to 'TEAM_LEADER' across all tables
 */
const { query, transaction } = require('./config');

async function fixRoleEnums() {
  console.log('🔄 Starting Role Enum standardization...');

  try {
    await transaction(async (connection) => {
      // 1. Update users table
      console.log('👥 Updating users table schema...');
      
      // First, change any existing data that might use spaces
      await connection.query("UPDATE users SET role = 'TEAM_LEADER' WHERE role = 'TEAM LEADER'");
      
      // Then alter the column definition
      await connection.query("ALTER TABLE users MODIFY COLUMN role ENUM('USER', 'TEAM_LEADER', 'ADMIN')");
      console.log('✅ Users table updated');

      // 2. Update activity_logs table
      console.log('📜 Updating activity_logs table schema...');
      
      // First, change any existing data
      await connection.query("UPDATE activity_logs SET role = 'TEAM_LEADER' WHERE role = 'TEAM LEADER'");
      
      // Then alter the column definition
      await connection.query("ALTER TABLE activity_logs MODIFY COLUMN role ENUM('USER', 'TEAM_LEADER', 'ADMIN')");
      console.log('✅ Activity logs table updated');

      // 3. Update notifications table (just in case, though it seems correct)
      console.log('🔔 Updating notifications table schema...');
      await connection.query("UPDATE notifications SET action_by_role = 'TEAM_LEADER' WHERE action_by_role = 'TEAM LEADER'");
      await connection.query("ALTER TABLE notifications MODIFY COLUMN action_by_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL");
      console.log('✅ Notifications table updated');
    });

    console.log('\n✨ Role Enum standardization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to standardize Role Enums:', error.message);
    process.exit(1);
  }
}

fixRoleEnums();

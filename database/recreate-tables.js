// Force Recreate MySQL Database Tables with Correct Schema
// This script DROPS existing tables and recreates them with fixed enums

const { getPool, testConnection, closePool } = require('./config');

async function recreateDatabase() {
  console.log('🔄 Force Recreating MySQL Database Tables...\n');
  console.log('⚠️  WARNING: This will DELETE all existing data!\n');
  
  try {
    // Test connection first
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('\n❌ Cannot connect to MySQL database.');
      process.exit(1);
    }
    
    console.log('✅ Database connection successful\n');
    
    const pool = getPool();
    
    // STEP 1: Drop existing tables (in correct order due to foreign keys)
    console.log('🗑️  Dropping existing tables...\n');
    
    const tablesToDrop = [
      'file_status_history',
      'file_comments', 
      'files',
      'activity_logs',
      'teams',
      'users'
    ];
    
    for (const table of tablesToDrop) {
      try {
        process.stdout.write(`   Dropping ${table}... `);
        await pool.query(`DROP TABLE IF EXISTS ${table}`);
        console.log('✅');
      } catch (error) {
        console.log(`❌ ${error.message}`);
      }
    }
    
    console.log('\n📋 Creating tables with correct schema...\n');
    
    // STEP 2: Create tables with CORRECT enum definitions
    
    // USERS TABLE
    try {
      process.stdout.write('   Creating users table... ');
      await pool.query(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          fullName VARCHAR(255) NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL DEFAULT 'USER',
          team VARCHAR(100) DEFAULT 'General',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_users_email (email),
          INDEX idx_users_username (username),
          INDEX idx_users_team (team),
          INDEX idx_users_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // TEAMS TABLE
    try {
      process.stdout.write('   Creating teams table... ');
      await pool.query(`
        CREATE TABLE teams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          leader_id INT,
          leader_username VARCHAR(100),
          color VARCHAR(7) DEFAULT '#3B82F6',
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_teams_name (name),
          INDEX idx_teams_leader (leader_id),
          INDEX idx_teams_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // FILES TABLE - WITH CORRECTED ENUMS
    try {
      process.stdout.write('   Creating files table (with fixed enums)... ');
      await pool.query(`
        CREATE TABLE files (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          file_type VARCHAR(50) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          description TEXT,
          user_id INT NOT NULL,
          username VARCHAR(100) NOT NULL,
          user_team VARCHAR(100) NOT NULL,
          status ENUM('uploaded', 'team_leader_approved', 'admin_approved', 'rejected_by_team_leader', 'rejected_by_admin', 'final_approved') NOT NULL DEFAULT 'uploaded',
          current_stage ENUM('pending_team_leader', 'pending_admin', 'published_to_public', 'rejected_by_team_leader', 'rejected_by_admin') NOT NULL DEFAULT 'pending_team_leader',
          team_leader_id INT,
          team_leader_username VARCHAR(100),
          team_leader_reviewed_at DATETIME NULL,
          team_leader_comments TEXT,
          admin_id INT,
          admin_username VARCHAR(100),
          admin_reviewed_at DATETIME NULL,
          admin_comments TEXT,
          public_network_url VARCHAR(500),
          final_approved_at DATETIME NULL,
          rejection_reason TEXT,
          rejected_by VARCHAR(100),
          rejected_at DATETIME NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_files_user_id (user_id),
          INDEX idx_files_user_team (user_team),
          INDEX idx_files_current_stage (current_stage),
          INDEX idx_files_status (status),
          INDEX idx_files_uploaded_at (uploaded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // FILE COMMENTS TABLE
    try {
      process.stdout.write('   Creating file_comments table... ');
      await pool.query(`
        CREATE TABLE file_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          user_id INT NOT NULL,
          username VARCHAR(100) NOT NULL,
          user_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
          comment TEXT NOT NULL,
          comment_type ENUM('general', 'approval', 'rejection', 'revision') NOT NULL DEFAULT 'general',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_file_comments_file_id (file_id),
          INDEX idx_file_comments_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // FILE STATUS HISTORY TABLE
    try {
      process.stdout.write('   Creating file_status_history table... ');
      await pool.query(`
        CREATE TABLE file_status_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_id INT NOT NULL,
          old_status VARCHAR(50),
          new_status VARCHAR(50) NOT NULL,
          old_stage VARCHAR(50),
          new_stage VARCHAR(50) NOT NULL,
          changed_by_id INT,
          changed_by_username VARCHAR(100) NOT NULL,
          changed_by_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_file_status_history_file_id (file_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // ACTIVITY LOGS TABLE
    try {
      process.stdout.write('   Creating activity_logs table... ');
      await pool.query(`
        CREATE TABLE activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          username VARCHAR(100) NOT NULL,
          role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
          team VARCHAR(100) NOT NULL,
          activity TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_activity_logs_timestamp (timestamp),
          INDEX idx_activity_logs_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
      throw error;
    }
    
    // STEP 3: Insert default data
    console.log('\n📝 Inserting default data...\n');
    
    // Default admin user
    try {
      process.stdout.write('   Creating default admin user... ');
      await pool.query(`
        INSERT INTO users (fullName, username, email, password, role, team) 
        VALUES ('System Administrator', 'admin', 'admin@kmti.local', 
                '$2a$10$XOPbrlUPQdwdJUpSrIF6X.LbE8eeoooGlId3Kn.Uj/7p76FIwrMuG', 
                'ADMIN', 'Administration')
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
    }
    
    // Default team
    try {
      process.stdout.write('   Creating default General team... ');
      await pool.query(`
        INSERT INTO teams (name, description, color, is_active)
        VALUES ('General', 'Default team for all users', '#3B82F6', 1)
      `);
      console.log('✅');
    } catch (error) {
      console.log('❌', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Database recreation complete!');
    console.log('='.repeat(60));
    
    // Verify tables
    console.log('\n🔍 Verifying database schema...');
    const [tables] = await pool.query('SHOW TABLES');
    
    console.log(`\n📊 Database contains ${tables.length} tables:`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });
    
    // Verify enum values
    console.log('\n🔧 Verifying enum definitions...');
    const [columns] = await pool.query("SHOW COLUMNS FROM files WHERE Field IN ('status', 'current_stage')");
    
    const statusColumn = columns.find(c => c.Field === 'status');
    if (statusColumn) {
      const statusEnums = statusColumn.Type.match(/enum\((.*)\)/i)[1];
      console.log(`   Status enum: ${statusEnums}`);
    }
    
    const stageColumn = columns.find(c => c.Field === 'current_stage');
    if (stageColumn) {
      const stageEnums = stageColumn.Type.match(/enum\((.*)\)/i)[1];
      console.log(`   Stage enum: ${stageEnums}`);
    }
    
    console.log('\n✅ All tables recreated with correct schema!');
    console.log('\n📝 Default login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm run db:verify');
    console.log('2. Start server: npm run server:standalone');
    console.log('3. Login with admin/admin123\n');
    
  } catch (error) {
    console.error('\n❌ Recreation failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run recreation
if (require.main === module) {
  recreateDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { recreateDatabase };

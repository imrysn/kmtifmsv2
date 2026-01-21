// Migration Script: Add 'under_revision' status to files table
// Direct connection to production database

const mysql = require('mysql2/promise');

// Force production database settings
const dbConfig = {
  host: 'KMTI-NAS',
  port: 3306,
  user: 'kmtifms_user',
  password: 'Ph15IcadRs',
  database: 'kmtifms'  // Force production database
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to production database...');
    console.log(`📊 Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`📊 Database: ${dbConfig.database}`);
    console.log(`📊 User: ${dbConfig.user}\n`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    console.log('🔄 Running migration: Add under_revision status...');
    
    await connection.query(`
      ALTER TABLE files 
      MODIFY COLUMN status ENUM(
        'uploaded', 
        'pending_team_leader', 
        'pending_admin', 
        'approved', 
        'rejected',
        'under_revision',
        'team_leader_approved',
        'final_approved',
        'rejected_by_team_leader',
        'rejected_by_admin'
      ) NOT NULL DEFAULT 'uploaded'
    `);

    console.log('✅ Migration completed successfully!\n');
    console.log('📝 The files table now supports "under_revision" status');
    console.log('📝 Files that replace rejected ones will be marked as REVISED\n');
    
    console.log('🎉 Next steps:');
    console.log('   1. Restart your server (if running)');
    console.log('   2. Upload a file with the same name as a rejected file');
    console.log('   3. See the 📝 REVISED badge appear!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Fix: Check database credentials');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Fix: Make sure the database "kmtifms" exists on KMTI-NAS');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n💡 Fix: Cannot connect to KMTI-NAS');
      console.error('   - Check that KMTI-NAS is accessible on the network');
      console.error('   - Verify MySQL server is running on KMTI-NAS');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Fix: Connection timeout to KMTI-NAS');
      console.error('   - Check network connectivity');
      console.error('   - Verify firewall settings allow MySQL port 3306');
    }
    
    console.error('\n📋 Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
console.log('🚀 Starting database migration to PRODUCTION...\n');
runMigration();

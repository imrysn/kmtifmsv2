// Migration Script: Add 'under_revision' status to files table
// Run this to enable the REVISED status badge feature

const mysql = require('mysql2/promise');

// Database configuration from your .env file
const dbConfig = {
  host: 'KMTI-NAS',
  port: 3306,
  user: 'kmtifms_user',
  password: 'Ph15IcadRs',
  database: 'kmtifms'
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

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

    console.log('✅ Migration completed successfully!');
    console.log('📝 The files table now supports "under_revision" status');
    console.log('📝 Files that replace rejected ones will be marked as REVISED');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Fix: Update the database credentials in this file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Fix: Make sure the database "kmtifms" exists');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
console.log('🚀 Starting migration...\n');
runMigration();

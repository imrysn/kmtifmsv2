// Migration Script: Add 'under_revision' status to files table
// This version uses your existing database configuration

// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const path = require('path');
const { query } = require('../config');

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add under_revision status...');
    console.log('📊 Using database configuration from config.js\n');

    await query(`
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
    console.log('📝 Files that replace rejected ones will be marked as REVISED\n');
    
    console.log('🎉 You can now:');
    console.log('   1. Restart your server');
    console.log('   2. Upload a file with the same name as a rejected file');
    console.log('   3. See the 📝 REVISED badge appear!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Fix: Check database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Fix: Make sure the database "kmtifms" exists');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Fix: Make sure MySQL server is running');
      console.error('   Check that KMTI-NAS is accessible on the network');
    }
    
    console.error('\n📋 Error details:', error);
    process.exit(1);
  }
}

// Run the migration
console.log('🚀 Starting database migration...\n');
runMigration();

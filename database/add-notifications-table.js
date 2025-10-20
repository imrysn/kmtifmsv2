// Script to add the notifications table to the MySQL database
const fs = require('fs');
const path = require('path');
const { getPool, closePool } = require('./config');

async function addNotificationsTable() {
  console.log('🚀 Adding notifications table to MySQL database...');
  
  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'sql', 'add-notifications-table.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Connect to the database
    const pool = getPool();
    
    console.log('📝 Executing SQL script...');
    await pool.query(sqlScript);
    
    console.log('✅ Notifications table added successfully!');
    
    // Verify the table exists
    const [tables] = await pool.query('SHOW TABLES LIKE "notifications"');
    if (tables.length > 0) {
      console.log('✅ Verification successful: notifications table exists');
    } else {
      console.error('❌ Verification failed: notifications table was not created');
    }
  } catch (error) {
    console.error('❌ Error adding notifications table:', error.message);
  } finally {
    await closePool();
  }
}

// Run the script
if (require.main === module) {
  addNotificationsTable().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { addNotificationsTable };

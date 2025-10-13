const fs = require('fs');
const path = require('path');
const { db } = require('../server/config/database');

console.log('🔄 Adding notifications table to database...\n');

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'sql', 'add-notifications-table.sql');
const sql = fs.readFileSync(sqlFilePath, 'utf8');

// Execute the SQL
db.exec(sql, (err) => {
  if (err) {
    console.error('❌ Error creating notifications table:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Notifications table created successfully!');
  console.log('\nNotifications table structure:');
  console.log('- id (Primary Key)');
  console.log('- user_id (Who receives the notification)');
  console.log('- file_id (Which file the notification is about)');
  console.log('- type (comment, approval, rejection, final_approval, final_rejection)');
  console.log('- title (Notification title)');
  console.log('- message (Notification message)');
  console.log('- action_by_id, action_by_username, action_by_role (Who performed the action)');
  console.log('- is_read (Boolean flag)');
  console.log('- created_at, read_at (Timestamps)');
  console.log('\n✨ Your notification system is ready!');
  
  process.exit(0);
});

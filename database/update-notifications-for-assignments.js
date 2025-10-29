const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function updateNotificationsTable() {
  let connection;
  
  try {
    // Create connection using your actual database credentials
    connection = await mysql.createConnection({
      host: 'KMTI-NAS',
      port: 3306,
      user: 'kmtifms_user',
      password: 'Ph15IcadRs',
      database: 'kmtifms',
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, 'sql', 'update-notifications-for-assignments.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing SQL migration...');
    const [results] = await connection.query(sql);
    
    console.log('✅ Notifications table updated successfully');
    console.log('📊 Migration results:', results);

  } catch (error) {
    console.error('❌ Error updating notifications table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
updateNotificationsTable()
  .then(() => {
    console.log('✨ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });

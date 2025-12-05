const mysql = require('mysql2/promise');

async function addPasswordResetType() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'kmtifms'
    });

    console.log('✅ Connected to database');
    console.log('\n🔧 Adding password_reset_request type to notifications...\n');

    // Check current type column
    const [columns] = await connection.query('DESCRIBE notifications');
    const typeColumn = columns.find(col => col.Field === 'type');

    if (typeColumn.Type.includes('password_reset_request')) {
      console.log('✅ password_reset_request type already exists');
      return;
    }

    // Update the enum to include password_reset_request
    console.log('🔧 Updating type enum...');
    await connection.query(`
      ALTER TABLE notifications
      MODIFY COLUMN type ENUM('comment', 'approval', 'rejection', 'final_approval', 'final_rejection', 'assignment', 'password_reset_request') NOT NULL
    `);

    console.log('✅ Type enum updated successfully!');

    // Verify
    const [finalColumns] = await connection.query('DESCRIBE notifications');
    const finalTypeColumn = finalColumns.find(col => col.Field === 'type');
    console.log(`📋 Type column: ${finalTypeColumn.Type}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
addPasswordResetType()
  .then(() => {
    console.log('\n✨ Password reset notifications are now supported!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed');
    process.exit(1);
  });

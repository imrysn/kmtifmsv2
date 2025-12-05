const mysql = require('mysql2/promise');

async function checkNotificationsTable() {
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

    // Check table structure
    console.log('\n📋 Checking notifications table structure...');
    const [columns] = await connection.query(`
      DESCRIBE notifications
    `);
    
    console.log('\n📊 Current columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // Check if assignment_id column exists
    const hasAssignmentId = columns.some(col => col.Field === 'assignment_id');
    const hasFileIdNullable = columns.find(col => col.Field === 'file_id')?.Null === 'YES';
    
    console.log('\n✅ Status:');
    console.log(`  assignment_id column: ${hasAssignmentId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  file_id nullable: ${hasFileIdNullable ? '✅ YES' : '❌ NO (needs to be nullable)'}`);
    
    // Check enum values for type
    const typeColumn = columns.find(col => col.Field === 'type');
    if (typeColumn) {
      console.log(`  type enum values: ${typeColumn.Type}`);
      const hasAssignmentType = typeColumn.Type.includes('assignment');
      console.log(`  'assignment' type: ${hasAssignmentType ? '✅ EXISTS' : '❌ MISSING'}`);
    }

    // Check sample notifications
    console.log('\n📬 Recent notifications:');
    const [notifications] = await connection.query(`
      SELECT id, user_id, type, title, assignment_id, file_id, created_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (notifications.length > 0) {
      notifications.forEach(n => {
        console.log(`  #${n.id}: ${n.type} - "${n.title}" (user: ${n.user_id}, assignment: ${n.assignment_id || 'null'}, file: ${n.file_id || 'null'})`);
      });
    } else {
      console.log('  No notifications found');
    }

    console.log('\n' + '='.repeat(60));
    
    if (!hasAssignmentId || !hasFileIdNullable || !typeColumn.Type.includes('assignment')) {
      console.log('⚠️  DATABASE MIGRATION NEEDED!');
      console.log('\nRun this command to update:');
      console.log('  cd database');
      console.log('  node update-notifications-for-assignments.js');
    } else {
      console.log('✅ Database schema is ready for assignment notifications!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkNotificationsTable()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });

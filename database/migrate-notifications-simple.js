const mysql = require('mysql2/promise');

async function updateNotificationsTable() {
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
    console.log('\n🔧 Starting migration...\n');

    // Step 1: Check current state
    console.log('Step 1: Checking current table structure...');
    const [columns] = await connection.query('DESCRIBE notifications');
    const hasAssignmentId = columns.some(col => col.Field === 'assignment_id');
    const fileIdColumn = columns.find(col => col.Field === 'file_id');
    const typeColumn = columns.find(col => col.Field === 'type');
    
    // Step 2: Make file_id nullable
    if (fileIdColumn && fileIdColumn.Null === 'NO') {
      console.log('Step 2: Making file_id column nullable...');
      await connection.query('ALTER TABLE notifications MODIFY COLUMN file_id INT NULL');
      console.log('✅ file_id is now nullable');
    } else {
      console.log('Step 2: file_id is already nullable ✓');
    }

    // Step 3: Add assignment_id column
    if (!hasAssignmentId) {
      console.log('Step 3: Adding assignment_id column...');
      await connection.query('ALTER TABLE notifications ADD COLUMN assignment_id INT NULL AFTER file_id');
      console.log('✅ assignment_id column added');
      
      // Add foreign key
      console.log('Step 3b: Adding foreign key for assignment_id...');
      try {
        await connection.query(`
          ALTER TABLE notifications 
          ADD CONSTRAINT fk_notifications_assignment 
          FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
        `);
        console.log('✅ Foreign key added');
      } catch (fkError) {
        if (fkError.code === 'ER_DUP_KEYNAME') {
          console.log('⚠️  Foreign key already exists');
        } else {
          console.log('⚠️  Could not add foreign key:', fkError.message);
        }
      }
      
      // Add index
      console.log('Step 3c: Adding index for assignment_id...');
      try {
        await connection.query('CREATE INDEX idx_notifications_assignment_id ON notifications(assignment_id)');
        console.log('✅ Index added');
      } catch (idxError) {
        if (idxError.code === 'ER_DUP_KEYNAME') {
          console.log('⚠️  Index already exists');
        } else {
          console.log('⚠️  Could not add index:', idxError.message);
        }
      }
    } else {
      console.log('Step 3: assignment_id column already exists ✓');
    }

    // Step 4: Update type enum
    const hasAssignmentType = typeColumn.Type.includes('assignment');
    if (!hasAssignmentType) {
      console.log('Step 4: Adding \'assignment\' to type enum...');
      await connection.query(`
        ALTER TABLE notifications 
        MODIFY COLUMN type ENUM('comment', 'approval', 'rejection', 'final_approval', 'final_rejection', 'assignment') NOT NULL
      `);
      console.log('✅ Type enum updated');
    } else {
      console.log('Step 4: \'assignment\' type already in enum ✓');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(60));
    
    // Verify final state
    console.log('\n📋 Final table structure:');
    const [finalColumns] = await connection.query('DESCRIBE notifications');
    finalColumns.forEach(col => {
      if (['type', 'file_id', 'assignment_id'].includes(col.Field)) {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
updateNotificationsTable()
  .then(() => {
    console.log('\n✨ You can now restart your server and test assignment notifications!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed');
    process.exit(1);
  });

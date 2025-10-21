const { getPool, testConnection } = require('./config');

async function addPriorityFeatures() {
  console.log('🔄 Adding priority and due date columns to files table...');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Exiting...');
    process.exit(1);
  }
  
  const pool = getPool();
  
  try {
    // Add priority column (normal, high, urgent)
    try {
      await pool.execute(`
        ALTER TABLE files 
        ADD COLUMN priority VARCHAR(20) DEFAULT 'normal'
      `);
      console.log('✅ Priority column added successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Priority column already exists');
      } else {
        throw err;
      }
    }

    // Add due_date column
    try {
      await pool.execute(`
        ALTER TABLE files 
        ADD COLUMN due_date DATETIME NULL
      `);
      console.log('✅ Due date column added successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Due date column already exists');
      } else {
        throw err;
      }
    }

    // Create index for faster filtering on priority
    try {
      await pool.execute(`
        CREATE INDEX idx_files_priority ON files(priority)
      `);
      console.log('✅ Priority index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ Priority index already exists');
      } else {
        throw err;
      }
    }

    // Create index for faster filtering on due_date
    try {
      await pool.execute(`
        CREATE INDEX idx_files_due_date ON files(due_date)
      `);
      console.log('✅ Due date index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ Due date index already exists');
      } else {
        throw err;
      }
    }

    // Create composite index for stage and team (for faster team leader queries)
    try {
      await pool.execute(`
        CREATE INDEX idx_files_stage_team ON files(current_stage, user_team)
      `);
      console.log('✅ Stage and team index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('✅ Stage and team index already exists');
      } else {
        throw err;
      }
    }

    console.log('\n✅ Database migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - priority column: Added (VARCHAR(20), default: "normal")');
    console.log('   - due_date column: Added (DATETIME, nullable)');
    console.log('   - Indexes: Created for optimal query performance');
    console.log('\n🎯 You can now use:');
    console.log('   - Set file priority: normal, high, urgent');
    console.log('   - Set review due dates');
    console.log('   - Filter by priority and overdue status');
    console.log('   - Receive notifications for urgent/overdue files');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the migration
addPriorityFeatures();

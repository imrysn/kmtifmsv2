const { getPool, testConnection } = require('./config');

async function setupAssignmentSystem() {
  console.log('🔄 Setting up Assignment System (Google Classroom-style)...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Exiting...');
    process.exit(1);
  }
  
  const pool = getPool();
  
  try {
    // =========================================================================
    // 1. CREATE ASSIGNMENTS TABLE
    // =========================================================================
    console.log('📋 Creating assignments table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        team_leader_id INT NOT NULL,
        team_leader_username VARCHAR(100),
        team VARCHAR(50) NOT NULL,
        due_date DATETIME,
        file_type_required VARCHAR(100),
        assigned_to VARCHAR(10) DEFAULT 'all',
        max_file_size BIGINT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        INDEX idx_team_leader (team_leader_id),
        INDEX idx_team (team),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8
    `);
    console.log('✅ Assignments table created');

    // Create trigger to auto-update updated_at
    console.log('📋 Creating triggers for assignments.updated_at...');
    try {
      await pool.execute(`DROP TRIGGER IF EXISTS assignments_before_update`);
      await pool.execute(`
        CREATE TRIGGER assignments_before_update
        BEFORE UPDATE ON assignments
        FOR EACH ROW
        SET NEW.updated_at = NOW()
      `);
      console.log('✅ Update trigger created');
      
      await pool.execute(`DROP TRIGGER IF EXISTS assignments_before_insert`);
      await pool.execute(`
        CREATE TRIGGER assignments_before_insert
        BEFORE INSERT ON assignments
        FOR EACH ROW
        SET NEW.updated_at = NOW()
      `);
      console.log('✅ Insert trigger created');
    } catch (err) {
      console.log('⚠️  Could not create triggers:', err.message);
    }

    // =========================================================================
    // 2. CREATE ASSIGNMENT_MEMBERS TABLE
    // =========================================================================
    console.log('📋 Creating assignment_members table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS assignment_members (
        id INT PRIMARY KEY AUTO_INCREMENT,
        assignment_id INT NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at DATETIME,
        file_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_assignment (assignment_id),
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8
    `);
    console.log('✅ Assignment_members table created');

    // =========================================================================
    // 3. ADD COLUMNS TO FILES TABLE
    // =========================================================================
    console.log('📋 Adding assignment columns to files table...');
    
    try {
      await pool.execute(`
        ALTER TABLE files 
        ADD COLUMN assignment_id INT,
        ADD COLUMN submitted_for_assignment BOOLEAN DEFAULT 0,
        ADD INDEX idx_assignment_id (assignment_id)
      `);
      console.log('✅ Assignment columns added to files table');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Assignment columns already exist in files table');
      } else {
        throw err;
      }
    }

    // =========================================================================
    // 4. CREATE ASSIGNMENT_NOTIFICATIONS TABLE (for real-time updates)
    // =========================================================================
    console.log('📋 Creating assignment_notifications table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS assignment_notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        assignment_id INT NOT NULL,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        message TEXT,
        read_status BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_unread (user_id, read_status),
        INDEX idx_assignment (assignment_id),
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8
    `);
    console.log('✅ Assignment_notifications table created');

    console.log('\n✅ Assignment System Setup Complete!\n');
    console.log('📋 Summary:');
    console.log('   ✓ assignments table: Created');
    console.log('   ✓ assignment_members table: Created');
    console.log('   ✓ assignment_notifications table: Created');
    console.log('   ✓ files table: Updated with assignment columns');
    console.log('   ✓ Indexes: Created for optimal performance');
    console.log('\n🎯 Features now available:');
    console.log('   - Team Leaders can create assignments');
    console.log('   - Assign to all members or specific individuals');
    console.log('   - Set due dates and file requirements');
    console.log('   - Track submissions in real-time');
    console.log('   - Members receive assignment notifications');
    console.log('   - Automatic submission tracking');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the setup
setupAssignmentSystem();

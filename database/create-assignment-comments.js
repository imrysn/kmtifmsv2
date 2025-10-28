const { getPool, testConnection } = require('./config');

async function createAssignmentCommentsTable() {
  console.log('🔄 Creating assignment_comments table...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Exiting...');
    process.exit(1);
  }
  
  const pool = getPool();
  
  try {
    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assignment_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assignment_id INT NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        user_fullname VARCHAR(255),
        user_role ENUM('USER', 'TEAM_LEADER', 'ADMIN') NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        
        INDEX idx_assignment_comments_assignment_id (assignment_id),
        INDEX idx_assignment_comments_user_id (user_id),
        INDEX idx_assignment_comments_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await pool.execute(createTableSQL);
    
    console.log('✅ Assignment comments table created successfully!\n');
    console.log('📋 Table structure:');
    console.log('   - id: Auto-increment primary key');
    console.log('   - assignment_id: Reference to assignment');
    console.log('   - user_id: User who posted the comment');
    console.log('   - username: Username of commenter');
    console.log('   - user_fullname: Full name of commenter');
    console.log('   - user_role: Role of commenter');
    console.log('   - comment: The comment text');
    console.log('   - created_at: Timestamp\n');
    
    // Verify the table was created
    const [tables] = await pool.query("SHOW TABLES LIKE 'assignment_comments'");
    if (tables.length > 0) {
      console.log('✅ Table verified in database');
      
      // Show table structure
      const [columns] = await pool.query('DESCRIBE assignment_comments');
      console.log('\n📊 Table columns:');
      columns.forEach(col => {
        console.log(`   ${col.Field}: ${col.Type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
createAssignmentCommentsTable();

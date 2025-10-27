const { getPool, testConnection } = require('./config');
const fs = require('fs');
const path = require('path');

async function addAssignmentCommentsTable() {
  console.log('🔄 Adding assignment_comments table for Facebook-style comments...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Exiting...');
    process.exit(1);
  }
  
  const pool = getPool();
  
  try {
    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, 'sql', 'add-assignment-comments.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      await pool.execute(statement);
    }
    
    console.log('✅ Assignment comments table created successfully!\n');
    console.log('📋 Table structure:');
    console.log('   - id: Auto-increment primary key');
    console.log('   - assignment_id: Reference to assignment');
    console.log('   - user_id: User who posted the comment');
    console.log('   - username: Username of commenter');
    console.log('   - user_fullname: Full name of commenter');
    console.log('   - user_role: Role of commenter (USER/TEAM_LEADER/ADMIN)');
    console.log('   - comment: The comment text');
    console.log('   - created_at: Timestamp when comment was created');
    console.log('   - updated_at: Timestamp when comment was last updated\n');
    console.log('🎯 You can now:');
    console.log('   - Post comments on assignments');
    console.log('   - View all comments with user info');
    console.log('   - Display Facebook-style comment threads');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the migration
addAssignmentCommentsTable();

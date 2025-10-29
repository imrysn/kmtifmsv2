const mysql = require('mysql2/promise');

async function testNotificationSystem() {
  let connection;
  
  try {
    console.log('🧪 Testing Notification System\n');
    console.log('='.repeat(60));
    
    // Connect to database
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'kmtifms'
    });

    console.log('✅ Connected to database\n');

    // Test 1: Check table structure
    console.log('TEST 1: Database Schema');
    console.log('-'.repeat(60));
    const [columns] = await connection.query('DESCRIBE notifications');
    
    const hasAssignmentId = columns.some(col => col.Field === 'assignment_id');
    const fileIdColumn = columns.find(col => col.Field === 'file_id');
    const typeColumn = columns.find(col => col.Field === 'type');
    const hasAssignmentType = typeColumn?.Type.includes('assignment');
    const fileIdNullable = fileIdColumn?.Null === 'YES';
    
    console.log(`  assignment_id column: ${hasAssignmentId ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  file_id nullable: ${fileIdNullable ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  'assignment' in type enum: ${hasAssignmentType ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!hasAssignmentId || !fileIdNullable || !hasAssignmentType) {
      console.log('\n❌ DATABASE SCHEMA TEST FAILED');
      console.log('   Run: node migrate-notifications-simple.js');
      return false;
    }
    
    // Test 2: Try to insert a test notification
    console.log('\nTEST 2: Insert Test Notification');
    console.log('-'.repeat(60));
    
    try {
      // Get a test user
      const [users] = await connection.query('SELECT id, username FROM users WHERE role = ? LIMIT 1', ['USER']);
      const [teamLeaders] = await connection.query('SELECT id, username FROM users WHERE role = ? LIMIT 1', ['TEAM_LEADER']);
      
      if (users.length === 0 || teamLeaders.length === 0) {
        console.log('⚠️  No test users available. Skipping insert test.');
        return true;
      }
      
      const testUser = users[0];
      const testTL = teamLeaders[0];
      
      console.log(`  Test user: ${testUser.username} (ID: ${testUser.id})`);
      console.log(`  Test team leader: ${testTL.username} (ID: ${testTL.id})`);
      
      // Insert test notification
      const [result] = await connection.query(`
        INSERT INTO notifications (
          user_id,
          assignment_id,
          type,
          title,
          message,
          action_by_id,
          action_by_username,
          action_by_role
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `, [
        testUser.id,
        'assignment',
        'TEST: New Assignment',
        `${testTL.username} assigned you a test task`,
        testTL.id,
        testTL.username,
        'TEAM_LEADER'
      ]);
      
      console.log(`  ✅ Test notification inserted (ID: ${result.insertId})`);
      
      // Verify it was inserted
      const [inserted] = await connection.query(
        'SELECT * FROM notifications WHERE id = ?',
        [result.insertId]
      );
      
      if (inserted.length > 0) {
        console.log(`  ✅ Test notification verified in database`);
        
        // Clean up test notification
        await connection.query('DELETE FROM notifications WHERE id = ?', [result.insertId]);
        console.log(`  ✅ Test notification cleaned up`);
      }
      
    } catch (insertError) {
      console.log(`  ❌ FAIL: ${insertError.message}`);
      return false;
    }
    
    // Test 3: Check recent notifications
    console.log('\nTEST 3: Recent Notifications');
    console.log('-'.repeat(60));
    const [recent] = await connection.query(`
      SELECT id, user_id, type, title, assignment_id, created_at
      FROM notifications
      WHERE type = 'assignment'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    if (recent.length > 0) {
      console.log(`  Found ${recent.length} assignment notification(s):`);
      recent.forEach(n => {
        const ago = Math.floor((Date.now() - new Date(n.created_at)) / 1000 / 60);
        console.log(`    - #${n.id}: "${n.title}" (${ago} min ago)`);
      });
    } else {
      console.log(`  No assignment notifications found yet.`);
      console.log(`  This is normal if you haven't created any assignments.`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('  1. Restart your server: cd server && npm start');
    console.log('  2. Login as Team Leader');
    console.log('  3. Create a new assignment');
    console.log('  4. Login as User and check Notifications tab');
    
    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testNotificationSystem()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });

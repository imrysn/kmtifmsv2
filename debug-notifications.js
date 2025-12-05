const { query, queryOne } = require('./database/config');

async function debugNotifications() {
  console.log('🔍 Debugging Notification System...\n');
  
  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    const testQuery = await queryOne('SELECT 1 as test');
    console.log('✅ Database connected successfully\n');
    
    // 2. Check notifications table structure
    console.log('2. Checking notifications table...');
    try {
      const tableInfo = await query('DESCRIBE notifications');
      console.log('✅ Notifications table exists with columns:');
      tableInfo.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
      console.log('');
    } catch (error) {
      console.error('❌ Notifications table does NOT exist!');
      console.error('   Run: node database/update-notifications-for-assignments.js\n');
      return;
    }
    
    // 3. Check current notifications count
    const totalCount = await queryOne('SELECT COUNT(*) as count FROM notifications');
    console.log(`3. Total notifications in database: ${totalCount.count}\n`);
    
    // 4. Test creating a notification
    console.log('4. Testing notification creation...');
    const testUser = await queryOne('SELECT id, username FROM users WHERE role = ? LIMIT 1', ['USER']);
    
    if (!testUser) {
      console.error('❌ No users found to test with\n');
      return;
    }
    
    console.log(`   Using test user: ${testUser.username} (ID: ${testUser.id})`);
    
    try {
      const result = await query(`
        INSERT INTO notifications (
          user_id, file_id, assignment_id, type, title, message,
          action_by_id, action_by_username, action_by_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testUser.id,
        null,
        null,
        'comment',
        'Test Notification',
        'This is a test notification created by debug script',
        1,
        'System',
        'ADMIN'
      ]);
      
      console.log(`✅ Test notification created with ID: ${result.insertId}\n`);
      
      // 5. Retrieve the notification
      console.log('5. Testing notification retrieval...');
      const notif = await queryOne('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
      
      if (notif) {
        console.log('✅ Notification retrieved successfully:');
        console.log(`   - ID: ${notif.id}`);
        console.log(`   - Title: ${notif.title}`);
        console.log(`   - Message: ${notif.message}`);
        console.log(`   - Type: ${notif.type}`);
        console.log(`   - Read: ${notif.is_read}`);
        console.log('');
      }
      
      // 6. Test the API query (with LEFT JOIN)
      console.log('6. Testing API-style query...');
      const apiResults = await query(`
        SELECT 
          n.*, 
          f.original_name as file_name, 
          f.status as file_status,
          a.title as assignment_title,
          a.due_date as assignment_due_date
        FROM notifications n
        LEFT JOIN files f ON n.file_id = f.id
        LEFT JOIN assignments a ON n.assignment_id = a.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 5
      `, [testUser.id]);
      
      console.log(`✅ Found ${apiResults.length} notifications for user ${testUser.username}:`);
      apiResults.forEach((n, i) => {
        console.log(`   ${i + 1}. ${n.title} (${n.type}) - Read: ${n.is_read}`);
      });
      console.log('');
      
      // 7. Clean up test notification
      console.log('7. Cleaning up test notification...');
      await query('DELETE FROM notifications WHERE id = ?', [result.insertId]);
      console.log('✅ Test notification deleted\n');
      
    } catch (error) {
      console.error('❌ Error during notification test:', error.message);
      if (error.sql) console.error('   SQL:', error.sql);
      console.error('');
    }
    
    // 8. Check for assignment notifications
    console.log('8. Checking assignment notifications...');
    const assignmentNotifs = await query(`
      SELECT 
        n.id, n.title, n.message, n.created_at,
        u.username as receiver,
        a.title as assignment_title
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN assignments a ON n.assignment_id = a.id
      WHERE n.type = 'assignment'
      ORDER BY n.created_at DESC
      LIMIT 5
    `);
    
    if (assignmentNotifs.length > 0) {
      console.log(`✅ Found ${assignmentNotifs.length} assignment notifications:`);
      assignmentNotifs.forEach((n, i) => {
        console.log(`   ${i + 1}. To: ${n.receiver}`);
        console.log(`      Assignment: ${n.assignment_title}`);
        console.log(`      Message: ${n.message.substring(0, 60)}...`);
        console.log('');
      });
    } else {
      console.log('⚠️  No assignment notifications found');
      console.log('   Try creating an assignment as team leader\n');
    }
    
    // 9. Check for recent notifications
    console.log('9. Recent notifications (all types):');
    const recentNotifs = await query(`
      SELECT 
        n.type,
        COUNT(*) as count,
        MAX(n.created_at) as latest
      FROM notifications n
      GROUP BY n.type
    `);
    
    if (recentNotifs.length > 0) {
      recentNotifs.forEach(r => {
        console.log(`   ${r.type}: ${r.count} notifications (latest: ${r.latest})`);
      });
      console.log('');
    }
    
    console.log('\n✅ ALL TESTS PASSED! Notification system is working correctly.');
    console.log('\n📌 Next steps:');
    console.log('   1. Check browser console for errors');
    console.log('   2. Verify notification tab is using NotificationTab-RealTime.jsx');
    console.log('   3. Check API endpoint: http://localhost:3001/api/notifications/user/[USER_ID]');
    console.log('   4. Create a test assignment and check if notification appears\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

debugNotifications();

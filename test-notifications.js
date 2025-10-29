const { query, queryOne } = require('./database/config');

async function testNotifications() {
  try {
    console.log('🔍 Testing Notification System...\n');
    
    // 1. Check if notifications table exists
    console.log('1. Checking notifications table structure...');
    const tableInfo = await query('DESCRIBE notifications');
    console.log('✅ Notifications table columns:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('');
    
    // 2. Count total notifications
    const totalCount = await queryOne('SELECT COUNT(*) as count FROM notifications');
    console.log(`2. Total notifications in database: ${totalCount.count}\n`);
    
    // 3. Check assignment-related notifications
    const assignmentNotifs = await query(`
      SELECT 
        n.*,
        a.title as assignment_title,
        u.username as receiver_username
      FROM notifications n
      LEFT JOIN assignments a ON n.assignment_id = a.id
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.type = 'assignment'
      ORDER BY n.created_at DESC
      LIMIT 10
    `);
    
    console.log('3. Recent assignment notifications:');
    if (assignmentNotifs.length === 0) {
      console.log('   ⚠️  No assignment notifications found');
    } else {
      assignmentNotifs.forEach(notif => {
        console.log(`   📋 ${notif.title}`);
        console.log(`      To: ${notif.receiver_username} (ID: ${notif.user_id})`);
        console.log(`      Assignment: ${notif.assignment_title || 'N/A'}`);
        console.log(`      From: ${notif.action_by_username} (${notif.action_by_role})`);
        console.log(`      Message: ${notif.message}`);
        console.log(`      Created: ${notif.created_at}`);
        console.log(`      Read: ${notif.is_read ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
    // 4. Check notifications by type
    const notifsByType = await query(`
      SELECT type, COUNT(*) as count
      FROM notifications
      GROUP BY type
    `);
    
    console.log('4. Notifications by type:');
    notifsByType.forEach(row => {
      console.log(`   ${row.type}: ${row.count}`);
    });
    console.log('');
    
    // 5. Check unread notifications per user
    const unreadByUser = await query(`
      SELECT 
        u.username,
        u.fullName,
        COUNT(*) as unread_count
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE n.is_read = 0
      GROUP BY u.id
      ORDER BY unread_count DESC
    `);
    
    console.log('5. Unread notifications by user:');
    if (unreadByUser.length === 0) {
      console.log('   ✅ No unread notifications');
    } else {
      unreadByUser.forEach(row => {
        console.log(`   ${row.username} (${row.fullName}): ${row.unread_count} unread`);
      });
    }
    console.log('');
    
    // 6. Test notification query used by API
    console.log('6. Testing API query for user notifications...');
    const testUserId = await queryOne('SELECT id FROM users WHERE role = ? LIMIT 1', ['USER']);
    
    if (testUserId) {
      const apiQuery = await query(`
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
        LIMIT 10
      `, [testUserId.id]);
      
      console.log(`   Testing for user ID ${testUserId.id}:`);
      console.log(`   Found ${apiQuery.length} notifications`);
      
      if (apiQuery.length > 0) {
        console.log('\n   Sample notification:');
        const sample = apiQuery[0];
        console.log(`   - Type: ${sample.type}`);
        console.log(`   - Title: ${sample.title}`);
        console.log(`   - Message: ${sample.message}`);
        console.log(`   - File: ${sample.file_name || 'N/A'}`);
        console.log(`   - Assignment: ${sample.assignment_title || 'N/A'}`);
        console.log(`   - Due Date: ${sample.assignment_due_date || 'N/A'}`);
      }
    } else {
      console.log('   ⚠️  No regular users found to test');
    }
    
    console.log('\n✅ Notification system test completed!');
    
  } catch (error) {
    console.error('❌ Error testing notifications:', error);
    console.error('Error details:', error.message);
    if (error.sql) console.error('SQL:', error.sql);
  }
  
  process.exit(0);
}

testNotifications();

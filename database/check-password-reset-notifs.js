const { query } = require('./config');

async function checkNotifications() {
    try {
        console.log('🔍 Checking password reset notifications...\n');

        const notifications = await query(`
      SELECT 
        id, user_id, file_id, type, title, 
        action_by_id, action_by_username, action_by_role,
        created_at
      FROM notifications 
      WHERE type = 'password_reset_request' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        if (notifications.length === 0) {
            console.log('❌ No password reset notifications found in database');
            return;
        }

        console.log(`✅ Found ${notifications.length} password reset notification(s):\n`);

        notifications.forEach((n, index) => {
            console.log(`Notification #${index + 1}:`);
            console.log(`  ID: ${n.id}`);
            console.log(`  User ID (recipient): ${n.user_id}`);
            console.log(`  File ID: ${n.file_id}`);
            console.log(`  Type: ${n.type}`);
            console.log(`  Title: ${n.title}`);
            console.log(`  Action By ID: ${n.action_by_id} ${n.action_by_id ? '✅' : '❌ MISSING!'}`);
            console.log(`  Action By Username: ${n.action_by_username}`);
            console.log(`  Action By Role: ${n.action_by_role}`);
            console.log(`  Created: ${n.created_at}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

checkNotifications();

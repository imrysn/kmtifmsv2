const { query } = require('./config');

async function checkNotificationTypes() {
    try {
        console.log('🔍 Checking notification types in database...\n');

        const notifications = await query(`
      SELECT 
        id, user_id, type, title, 
        action_by_id, action_by_username, action_by_role,
        created_at
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

        if (notifications.length === 0) {
            console.log('❌ No notifications found in database');
            return;
        }

        console.log(`✅ Found ${notifications.length} notification(s):\n`);

        notifications.forEach((n, index) => {
            console.log(`Notification #${index + 1}:`);
            console.log(`  ID: ${n.id}`);
            console.log(`  User ID: ${n.user_id}`);
            console.log(`  Type: "${n.type}" ${n.type ? '✅' : '❌ EMPTY!'}`);
            console.log(`  Type length: ${n.type ? n.type.length : 0}`);
            console.log(`  Title: ${n.title}`);
            console.log(`  Action By ID: ${n.action_by_id}`);
            console.log(`  Action By Username: ${n.action_by_username}`);
            console.log(`  Created: ${n.created_at}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

checkNotificationTypes();

const { query } = require('./config');

async function checkSchema() {
    try {
        console.log('🔍 Checking notifications table schema...\n');

        const schema = await query('DESCRIBE notifications');

        console.log('Columns:');
        schema.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
        });

        console.log('\n🔍 Checking latest notification (ID 676)...\n');

        const notif = await query('SELECT * FROM notifications WHERE id = 676');

        if (notif.length > 0) {
            const n = notif[0];
            console.log('Notification #676:');
            Object.keys(n).forEach(key => {
                const value = n[key];
                console.log(`  ${key}: "${value}" (type: ${typeof value}, length: ${value ? String(value).length : 0})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

checkSchema();

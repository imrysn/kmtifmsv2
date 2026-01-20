const { query } = require('./config');

async function updateEnum() {
    try {
        console.log('🔧 Manually updating ENUM...\n');

        // Update the ENUM to include password_reset_request and password_reset_complete
        await query(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM(
        'comment', 
        'approval', 
        'rejection', 
        'final_approval', 
        'final_rejection', 
        'password_reset_request',
        'password_reset_complete',
        'assignment'
      ) NOT NULL
    `);

        console.log('✅ ENUM updated successfully!');

        // Verify
        const schema = await query('DESCRIBE notifications');
        const typeCol = schema.find(col => col.Field === 'type');
        console.log('\nVerification:');
        console.log('  Type column:', typeCol.Type);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

updateEnum();

const { query } = require('./config');
const fs = require('fs');
const path = require('path');

async function createResetTokensTable() {
    try {
        console.log('🔧 Creating password_reset_tokens table...\n');

        const sqlPath = path.join(__dirname, 'sql', 'create-password-reset-tokens.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                await query(statement);
            }
        }

        console.log('✅ Password reset tokens table created successfully!');

        // Verify table exists
        const tables = await query("SHOW TABLES LIKE 'password_reset_tokens'");
        if (tables.length > 0) {
            console.log('✅ Table verified in database');

            // Show table structure
            const structure = await query('DESCRIBE password_reset_tokens');
            console.log('\nTable structure:');
            structure.forEach(col => {
                console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        process.exit();
    }
}

createResetTokensTable();

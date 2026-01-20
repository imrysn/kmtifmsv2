const { query } = require('./config');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'sql', 'fix-password-reset-notifications.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');

        console.log('🔧 Running migration: fix-password-reset-notifications.sql');

        // Split SQL into individual statements (remove comments and empty lines)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        // Execute each statement
        for (const statement of statements) {
            if (statement.toLowerCase().includes('select')) {
                const result = await query(statement);
                console.log('✅', result[0]?.Message || 'Statement executed');
            } else {
                await query(statement);
                console.log('✅ Statement executed successfully');
            }
        }

        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

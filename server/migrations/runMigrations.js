/**
 * Migration Runner (MySQL Only)
 * Runs all database migrations in order
 */

const { query } = require('../../database/config');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function runMigrations() {
  try {
    console.log('🔄 Checking database migrations...');
    await ensureMigrationsTable();

    // List of migrations to run in order
    const migrations = [
      { name: '001-add-tag-column', run: require('./001-add-tag-column') },
      { name: '002-add-database-indexes', run: require('./002-add-database-indexes') },
      { name: '003-add-team-leaders-table', run: require('./003-add-team-leaders-table') },
      { name: '003b-add-folder-support', run: require('./003b-add-folder-support') },
      { name: '004-fix-schema-bugs', run: require('./004-fix-schema-bugs') },
      { name: '005-fix-tl-uploaded-files', run: require('./005-fix-tl-uploaded-files') },
      { name: '006-ensure-attachment-columns', run: require('./006-ensure-attachment-columns') }
    ];

    for (const migration of migrations) {
      const alreadyApplied = await query(`SELECT id FROM schema_migrations WHERE migration_name = ?`, [migration.name]);
      if (alreadyApplied.length > 0) {
        console.log(`⏭️  Skipping migration: ${migration.name} (already applied)`);
        continue;
      }

      console.log(`🚀 Running migration: ${migration.name}...`);

      // Support both function exports and object exports with up() method
      let runFn = migration.run;
      if (typeof runFn !== 'function' && runFn && typeof runFn.up === 'function') {
        runFn = runFn.up;
      }

      const success = await runFn();
      if (success || success === undefined) {
        await query(`INSERT INTO schema_migrations (migration_name) VALUES (?)`, [migration.name]);
        console.log(`✅ Migration successful: ${migration.name}`);
      } else {
        console.warn(`⚠️  Migration failed or skipped: ${migration.name}`);
      }
    }

    console.log('✅ All migrations check completed');
    return true;
  } catch (error) {
    console.error('❌ Migration runner error:', error);
    // Don't fail the server startup if migrations fail
    return false;
  }
}

module.exports = runMigrations;

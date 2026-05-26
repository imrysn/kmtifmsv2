/**
 * Migration Runner (MySQL Only)
 * Uses a schema_migrations table to track which migrations have already run.
 * Already-applied migrations are skipped instantly — no repeated ALTER/CREATE queries on every restart.
 */

async function runMigrations() {
  const { query } = require('../config/database');

  try {
    // Create the tracking table if it doesn't exist (one-time, fast)
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      { name: '001-add-tag-column',                run: require('./001-add-tag-column') },
      { name: '002-add-database-indexes',           run: require('./002-add-database-indexes') },
      { name: '003-add-team-leaders-table',         run: require('./003-add-team-leaders-table') },
      { name: '003-add-folder-support',             run: require('./003-add-folder-support') },
      { name: '004-fix-schema-bugs',                run: require('./004-fix-schema-bugs') },
      { name: '005-add-comments-parent-id',         run: require('./005-add-comments-parent-id') },
      { name: '006-fix-comments-schema',            run: require('./006-fix-comments-schema') },
      { name: '007-add-file-views',                 run: require('./007-add-file-views') },
      { name: '008-add-updated-at-to-files',        run: require('./008-add-updated-at-to-files') },
      { name: '009-add-performance-snapshots',      run: require('./009-add-performance-snapshots') },
      { name: '010-ensure-assignment-attachments',  run: require('./010-ensure-assignment-attachments') },
      { name: '011-add-checker-columns',             run: require('./011-add-checker-columns') },
      { name: '012-fix-files-status-column',          run: require('./012-fix-files-status-column') },
      { name: '013-fix-notifications-type-column',     run: require('./013-fix-notifications-type-column') },
      { name: '014-add-checked-by-to-files',             run: require('./014-add-checked-by-to-files') },
      { name: '016-add-due-date-edited',                  run: require('./016-add-due-date-edited') }
    ];

    // Fetch all already-applied migrations in one query
    const applied = await query('SELECT migration_name FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.migration_name));

    const pending = migrations.filter(m => !appliedSet.has(m.name));

    if (pending.length === 0) {
      console.log('✅ All migrations already applied — skipping.');
      return true;
    }

    console.log(`🔄 Running ${pending.length} pending migration(s)...`);

    for (const migration of pending) {
      try {
        console.log(`🚀 Running migration: ${migration.name}...`);

        let runFn = migration.run;
        if (typeof runFn !== 'function' && runFn && typeof runFn.up === 'function') {
          runFn = runFn.up;
        }

        await runFn();

        // Mark as applied
        await query(
          'INSERT IGNORE INTO schema_migrations (migration_name) VALUES (?)',
          [migration.name]
        );
        console.log(`✅ Migration applied: ${migration.name}`);
      } catch (err) {
        console.warn(`⚠️  Migration failed (skipping): ${migration.name} — ${err.message}`);
      }
    }

    console.log('✅ All migrations complete.');
    return true;
  } catch (error) {
    console.error('❌ Migration runner error:', error.message);
    return false;
  }
}

module.exports = runMigrations;

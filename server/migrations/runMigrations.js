/**
 * Migration Runner (MySQL Only)
 * Runs all database migrations in order
 */

async function runMigrations() {
  try {
    console.log('🔄 Checking database migrations...');

    // List of migrations to run in order
    const migrations = [
      { name: 'Add Tag Column', run: require('./001-add-tag-column') },
      { name: 'Add Database Indexes', run: require('./002-add-database-indexes') },
      { name: 'Add Team Leaders Table', run: require('./003-add-team-leaders-table') },
      { name: 'Add Folder Support', run: require('./003-add-folder-support') }
    ];

    for (const migration of migrations) {
      console.log(`🚀 Running migration: ${migration.name}...`);

      // Support both function exports and object exports with up() method
      let runFn = migration.run;
      if (typeof runFn !== 'function' && runFn && typeof runFn.up === 'function') {
        runFn = runFn.up;
      }

      const success = await runFn();
      if (success || success === undefined) {
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

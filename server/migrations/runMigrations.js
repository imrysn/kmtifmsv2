const { USE_MYSQL } = require('../config/database');

async function runMigrations() {
  try {
    console.log('🔄 Checking database migrations...');

    // List of migrations to run in order
    const migrations = [
      { name: 'Add Tag Column', run: require('./001-add-tag-column') },
      { name: 'Add Database Indexes', run: require('./002-add-database-indexes') }
    ];

    for (const migration of migrations) {
      console.log(`🚀 Running migration: ${migration.name}...`);

      // Support both function exports and object exports with up() method
      let runFn = migration.run;
      if (typeof runFn !== 'function' && runFn && typeof runFn.up === 'function') {
        runFn = runFn.up;
      }

      const success = await runFn();
      if (success) {
        console.log(`✅ Migration successful: ${migration.name}`);
      } else {
        console.warn(`⚠️ Migration failed or skipped: ${migration.name}`);
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

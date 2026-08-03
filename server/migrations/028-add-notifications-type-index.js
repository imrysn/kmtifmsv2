/**
 * Migration 028: Add composite index on notifications(user_id, type)
 *
 * The broadcast/message fetch does:
 *   WHERE user_id = ? AND type IN ('broadcast_reply', 'broadcast')
 *   ORDER BY created_at DESC
 *
 * A composite index on (user_id, type, created_at) lets MySQL satisfy
 * this query with index-only scans instead of a full table scan.
 */

async function run() {
  const { query } = require('../config/database');

  const indexes = [
    {
      name: 'idx_notifications_user_type',
      sql: 'CREATE INDEX idx_notifications_user_type ON notifications(user_id, type)'
    },
    {
      name: 'idx_notifications_user_type_created',
      sql: 'CREATE INDEX idx_notifications_user_type_created ON notifications(user_id, type, created_at)'
    },
    {
      name: 'idx_notifications_type',
      sql: 'CREATE INDEX idx_notifications_type ON notifications(type)'
    }
  ];

  for (const index of indexes) {
    try {
      const exists = await query(
        'SELECT COUNT(*) as count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
        ['notifications', index.name]
      );
      if (exists[0].count === 0) {
        await query(index.sql);
        console.log('Created index: ' + index.name);
      } else {
        console.log('Index already exists: ' + index.name);
      }
    } catch (err) {
      console.warn('Could not create index ' + index.name + ': ' + err.message);
    }
  }
}

module.exports = run;

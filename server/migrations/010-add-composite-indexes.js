/**
 * Migration 010 — Add composite indexes for dashboard and queue queries
 *
 * FIX #12 — The existing migration 002 adds single-column indexes, but the
 * most expensive dashboard/review-queue queries filter and sort on multiple
 * columns simultaneously. Without composite indexes MySQL falls back to a
 * full table scan + filesort for every dashboard load.
 *
 * Indexes added:
 *   files(user_team, current_stage, uploaded_at)  — team-leader queue, team dashboard
 *   files(user_id,   uploaded_at)                 — user file list, getUserFilesPaginated
 *   files(current_stage, uploaded_at)             — admin queue, summary counts
 *   files(status, uploaded_at)                    — approved/rejected counts
 *   files(folder_name)                            — watcher handleDirectoryDeletion
 *   assignment_attachments(folder_name)           — watcher handleDirectoryDeletion
 *   notifications(user_id, is_read, created_at)   — notification list queries
 */

async function up() {
  const { query } = require('../../database/config');

  const compositeIndexes = [
    {
      name:  'idx_files_team_stage_date',
      table: 'files',
      cols:  'user_team, current_stage, uploaded_at'
    },
    {
      name:  'idx_files_user_date',
      table: 'files',
      cols:  'user_id, uploaded_at'
    },
    {
      name:  'idx_files_stage_date',
      table: 'files',
      cols:  'current_stage, uploaded_at'
    },
    {
      name:  'idx_files_status_date',
      table: 'files',
      cols:  'status, uploaded_at'
    },
    {
      name:  'idx_files_folder_name',
      table: 'files',
      cols:  'folder_name'
    },
    {
      name:  'idx_aa_folder_name',
      table: 'assignment_attachments',
      cols:  'folder_name'
    },
    {
      name:  'idx_notifications_user_read_date',
      table: 'notifications',
      cols:  'user_id, is_read, created_at'
    }
  ];

  for (const idx of compositeIndexes) {
    try {
      // Check if index already exists to make the migration idempotent
      const existing = await query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name   = ?
           AND index_name   = ?`,
        [idx.table, idx.name]
      );

      if (existing[0]?.cnt > 0) {
        console.log(`  ↳ Index ${idx.name} already exists — skipping`);
        continue;
      }

      await query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.cols})`);
      console.log(`  ✅ Created index ${idx.name} on ${idx.table}(${idx.cols})`);
    } catch (err) {
      // Non-fatal: if a column doesn't exist yet (schema not migrated),
      // log and continue so the rest of the indexes are still attempted.
      console.warn(`  ⚠️  Could not create index ${idx.name}: ${err.message}`);
    }
  }
}

async function down() {
  const { query } = require('../../database/config');
  const names = [
    'idx_files_team_stage_date',
    'idx_files_user_date',
    'idx_files_stage_date',
    'idx_files_status_date',
    'idx_files_folder_name',
    'idx_aa_folder_name',
    'idx_notifications_user_read_date'
  ];
  for (const name of names) {
    try { await query(`DROP INDEX IF EXISTS ${name} ON files`); } catch (_) {}
  }
}

module.exports = { up, down };

/**
 * Migration 004: Fix critical schema bugs found in production logs
 *
 * 1. notifications.file_id   — must be NULL-able (password-reset notifs have no file)
 * 2. notifications.type      — widen to VARCHAR(100) to support all notification types
 * 3. notifications.assignment_id — add column if missing (older DBs)
 * 4. activity_logs.activity  — rename from 'action' if old column name still exists
 * 5. file_status_history.comment — rename from 'reason' if old column name still exists
 */

async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 004: Fix schema bugs...');

  // ── 1. Make notifications.file_id nullable ──────────────────────────────
  try {
    const cols = await query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'file_id'`
    );
    if (cols.length && cols[0].IS_NULLABLE === 'NO') {
      // Drop FK first so we can ALTER the column
      try {
        const fks = await query(
          `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
           AND COLUMN_NAME = 'file_id' AND REFERENCED_TABLE_NAME = 'files'`
        );
        for (const fk of fks) {
          await query(`ALTER TABLE notifications DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }
      } catch (_) { /* ignore if FK already gone */ }

      await query(`ALTER TABLE notifications MODIFY COLUMN file_id INT NULL`);

      // Re-add FK allowing NULL
      try {
        await query(
          `ALTER TABLE notifications ADD CONSTRAINT fk_notif_file
           FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE`
        );
      } catch (_) { /* ignore duplicate */ }

      console.log('  ✅ notifications.file_id is now nullable');
    } else {
      console.log('  ⏭️  notifications.file_id already nullable');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not fix notifications.file_id:', err.message);
  }

  // ── 2. Widen notifications.type to VARCHAR(100) ─────────────────────────
  try {
    const cols = await query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
    );
    if (cols.length) {
      const currentType = cols[0].COLUMN_TYPE.toLowerCase();
      if (!currentType.includes('varchar')) {
        await query(`ALTER TABLE notifications MODIFY COLUMN type VARCHAR(100) NOT NULL`);
        console.log('  ✅ notifications.type widened to VARCHAR(100)');
      } else {
        console.log('  ⏭️  notifications.type already VARCHAR');
      }
    }
  } catch (err) {
    console.warn('  ⚠️  Could not widen notifications.type:', err.message);
  }

  // ── 3. Add assignment_id to notifications if missing ────────────────────
  try {
    const cols = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'assignment_id'`
    );
    if (cols.length === 0) {
      await query(`ALTER TABLE notifications ADD COLUMN assignment_id INT NULL AFTER file_id`);
      try {
        await query(
          `ALTER TABLE notifications ADD CONSTRAINT fk_notif_assignment
           FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL`
        );
      } catch (_) { /* assignments table may not exist yet */ }
      console.log('  ✅ notifications.assignment_id column added');
    } else {
      console.log('  ⏭️  notifications.assignment_id already exists');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not add notifications.assignment_id:', err.message);
  }

  // ── 4. Fix activity_logs column: 'action' → 'activity' ─────────────────
  try {
    const actionCol = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_logs' AND COLUMN_NAME = 'action'`
    );
    const activityCol = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_logs' AND COLUMN_NAME = 'activity'`
    );

    if (actionCol.length > 0 && activityCol.length === 0) {
      // Old DB: has 'action' but not 'activity' — rename it
      await query("ALTER TABLE activity_logs CHANGE COLUMN `action` activity TEXT NOT NULL");
      console.log('  ✅ activity_logs.action renamed to activity');
    } else if (actionCol.length > 0 && activityCol.length > 0) {
      // Both columns exist — drop the old 'action' column
      await query("ALTER TABLE activity_logs DROP COLUMN `action`");
      console.log('  ✅ activity_logs.action (duplicate) dropped');
    } else {
      console.log('  ⏭️  activity_logs.activity column is correct');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not fix activity_logs column:', err.message);
  }

  // ── 5. Fix file_status_history column: 'reason' → 'comment' ───────────
  try {
    const reasonCol = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_status_history' AND COLUMN_NAME = 'reason'`
    );
    const commentCol = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_status_history' AND COLUMN_NAME = 'comment'`
    );

    if (reasonCol.length > 0 && commentCol.length === 0) {
      await query('ALTER TABLE file_status_history CHANGE COLUMN reason comment TEXT');
      console.log('  ✅ file_status_history.reason renamed to comment');
    } else {
      console.log('  ⏭️  file_status_history.comment column is correct');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not fix file_status_history column:', err.message);
  }

  console.log('✅ Migration 004 complete');
  return true;
}

module.exports = up;
module.exports.up = up;

/**
 * Migration 006: Fix assignment_comments schema issues
 *
 * 1. Drop the self-referencing FK (fk_comment_parent) — it causes
 *    ER_KEY_NOT_FOUND (Can't find record) on delete/insert operations.
 *    Reply integrity is enforced at the application level instead.
 *
 * 2. Add updated_at column (needed by editComment and getComments queries).
 */

async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 006: Fix assignment_comments schema...');

  // ── 1. Drop the self-referencing FK if it exists ─────────────────────────
  try {
    const fks = await query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_comments'
       AND COLUMN_NAME = 'parent_id' AND REFERENCED_TABLE_NAME = 'assignment_comments'`
    );
    if (fks.length > 0) {
      for (const fk of fks) {
        await query(`ALTER TABLE assignment_comments DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        console.log(`  ✅ Dropped FK: ${fk.CONSTRAINT_NAME}`);
      }
    } else {
      console.log('  ⏭️  No self-referencing FK to drop');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not drop self-referencing FK:', err.message);
  }

  // ── 2. Add updated_at column if missing ──────────────────────────────────
  try {
    const cols = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_comments' AND COLUMN_NAME = 'updated_at'`
    );
    if (cols.length === 0) {
      await query(
        `ALTER TABLE assignment_comments ADD COLUMN updated_at DATETIME NULL DEFAULT NULL`
      );
      console.log('  ✅ assignment_comments.updated_at column added');
    } else {
      console.log('  ⏭️  assignment_comments.updated_at already exists');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not add updated_at column:', err.message);
  }

  console.log('✅ Migration 006 complete');
  return true;
}

module.exports = up;
module.exports.up = up;

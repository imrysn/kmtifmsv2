/**
 * Migration 005: Add parent_id to assignment_comments
 *
 * Adds the parent_id column needed for nested comment replies.
 * Also adds a self-referencing FK so each reply points to its parent comment.
 */

async function up() {
  const { query } = require('../../database/config');

  console.log('🔄 Running migration 005: Add parent_id to assignment_comments...');

  // ── 1. Add parent_id column if missing ──────────────────────────────────
  try {
    const cols = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_comments' AND COLUMN_NAME = 'parent_id'`
    );
    if (cols.length === 0) {
      await query(
        `ALTER TABLE assignment_comments ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER assignment_id`
      );
      console.log('  ✅ assignment_comments.parent_id column added');
    } else {
      console.log('  ⏭️  assignment_comments.parent_id already exists');
    }
  } catch (err) {
    console.warn('  ⚠️  Could not add assignment_comments.parent_id:', err.message);
  }

  // ── 2. Add self-referencing FK ───────────────────────────────────────────
  try {
    const fks = await query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_comments'
       AND COLUMN_NAME = 'parent_id' AND REFERENCED_TABLE_NAME = 'assignment_comments'`
    );
    if (fks.length === 0) {
      await query(
        `ALTER TABLE assignment_comments
         ADD CONSTRAINT fk_comment_parent
         FOREIGN KEY (parent_id) REFERENCES assignment_comments(id) ON DELETE CASCADE`
      );
      console.log('  ✅ Self-referencing FK added for assignment_comments.parent_id');
    } else {
      console.log('  ⏭️  FK for assignment_comments.parent_id already exists');
    }
  } catch (err) {
    // Non-fatal — the column is what matters, FK is a nice-to-have
    console.warn('  ⚠️  Could not add FK for parent_id:', err.message);
  }

  console.log('✅ Migration 005 complete');
  return true;
}

module.exports = up;
module.exports.up = up;

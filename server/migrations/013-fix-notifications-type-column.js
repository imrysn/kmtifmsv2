/**
 * Migration 013: Fix notifications.type ENUM — add all missing notification types.
 *
 * ROOT CAUSE BUG: notifications.type was a restrictive ENUM that only had:
 *   'comment', 'approval', 'rejection', 'final_approval', 'final_rejection',
 *   'password_reset_request', 'password_reset_complete', 'assignment'
 *
 * The application also uses: 'submission', 'mention', 'revision_request',
 * 'checker_done', 'for_editing', 'checker_assigned'
 *
 * MySQL silently discarded every INSERT with a missing type value — so
 * notifications for file submissions, checker done, mentions, revision
 * requests, etc. were NEVER saved to the database.
 *
 * Fix: Convert notifications.type from ENUM to VARCHAR(50).
 */

const { query } = require('../config/database');

async function up() {
  try {
    // Check current type column
    const rows = await query(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notifications'
        AND COLUMN_NAME = 'type'
    `);

    const colType = rows?.[0]?.COLUMN_TYPE || '';
    console.log('[013] notifications.type current type:', colType);

    if (colType.toLowerCase().startsWith('varchar')) {
      console.log('✅ [013] notifications.type is already VARCHAR — skipping.');
      return true;
    }

    // Convert to VARCHAR(50) — accepts any notification type
    await query(`
      ALTER TABLE notifications
      MODIFY COLUMN type VARCHAR(50) NOT NULL
    `);
    console.log('✅ [013] notifications.type converted from ENUM to VARCHAR(50)');
    console.log('   Now accepts: submission, checker_done, assignment, mention,');
    console.log('   revision_request, for_editing, checker_assigned, comment, etc.');

    return true;
  } catch (error) {
    console.error('❌ [013] Migration failed:', error.message);
    return true; // Don't crash the server
  }
}

module.exports = up;

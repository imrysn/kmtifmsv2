/**
 * Migration 016: Add due_date_edited and original_due_date to assignments.
 *
 * When the Team Leader edits the due date of an existing assignment,
 * we record:
 *   - due_date_edited: TINYINT(1)  — 1 = due date has been changed at least once
 *   - original_due_date: DATETIME  — the original due date before first edit
 *
 * The UI uses due_date_edited to show a "Due Date Edited" badge.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'assignments'
        AND COLUMN_NAME IN ('due_date_edited', 'original_due_date')
    `);
    const existing = new Set((cols || []).map(r => r.COLUMN_NAME));

    if (!existing.has('due_date_edited')) {
      await query(`ALTER TABLE assignments ADD COLUMN due_date_edited TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('✅ [016] assignments.due_date_edited column added.');
    } else {
      console.log('✅ [016] assignments.due_date_edited already exists — skipping.');
    }

    if (!existing.has('original_due_date')) {
      await query(`ALTER TABLE assignments ADD COLUMN original_due_date DATETIME DEFAULT NULL`);
      console.log('✅ [016] assignments.original_due_date column added.');
    } else {
      console.log('✅ [016] assignments.original_due_date already exists — skipping.');
    }

    return true;
  } catch (error) {
    console.error('❌ [016] Migration failed:', error.message);
    return true; // Don't crash server on migration failure
  }
}

module.exports = up;

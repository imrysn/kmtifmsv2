/**
 * Migration 018 — Add ot_dates column to assignments table
 * Stores a JSON array of approved OT weekend date strings, e.g. ["2026-05-31","2026-06-07"]
 * These dates are counted as working days in the due-date countdown.
 */
async function run() {
  const { query } = require('../config/database');

  // Add ot_dates column if it doesn't already exist
  const columns = await query(`SHOW COLUMNS FROM assignments LIKE 'ot_dates'`);
  if (!columns || columns.length === 0) {
    await query(`ALTER TABLE assignments ADD COLUMN ot_dates TEXT NULL AFTER due_date`);
    console.log('✅ Migration 018: ot_dates column added to assignments table');
  } else {
    console.log('ℹ️  Migration 018: ot_dates column already exists — skipping');
  }
}

module.exports = run;

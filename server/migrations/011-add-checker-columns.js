/**
 * Migration 011: Add checker_ids and checker_names columns to assignments table.
 *
 * These columns support the "For Checking" feature where a team leader can assign
 * specific checkers to an assignment. The columns store JSON arrays.
 *
 * This migration is idempotent — safe to run on any database state.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const columns = await query(`SHOW COLUMNS FROM assignments LIKE 'checker_ids'`);
    if (!columns || columns.length === 0) {
      await query(`ALTER TABLE assignments ADD COLUMN checker_ids JSON DEFAULT NULL`);
      console.log('✅ Added checker_ids column to assignments');
    } else {
      console.log('ℹ️  checker_ids already exists — skipping');
    }

    const columns2 = await query(`SHOW COLUMNS FROM assignments LIKE 'checker_names'`);
    if (!columns2 || columns2.length === 0) {
      await query(`ALTER TABLE assignments ADD COLUMN checker_names JSON DEFAULT NULL`);
      console.log('✅ Added checker_names column to assignments');
    } else {
      console.log('ℹ️  checker_names already exists — skipping');
    }
  } catch (error) {
    console.error('❌ Migration 011 failed:', error.message);
    throw error;
  }
}

module.exports = up;

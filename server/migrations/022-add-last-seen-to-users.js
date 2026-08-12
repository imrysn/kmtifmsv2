/**
 * Migration 022: Add last_seen column to users table.
 *
 * Stores the UNIX timestamp (ms) of the user's last presence ping.
 * Solves the decentralized server issue where in-memory maps only saw
 * users connected to the same local instance.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'last_seen'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [022] users.last_seen already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE users
      ADD COLUMN last_seen BIGINT DEFAULT 0
    `);
    console.log('✅ [022] users.last_seen column added.');
    return true;
  } catch (error) {
    console.error('❌ [022] Migration failed:', error.message);
    return true; // non-fatal — don't block startup
  }
}

module.exports = up;

/**
 * Migration 021: Add profile_picture column to users table.
 *
 * Stores the relative URL of the user's uploaded profile picture.
 * Falls back to generated initials in the UI when NULL.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'profile_picture'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [021] users.profile_picture already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE users
      ADD COLUMN profile_picture VARCHAR(500) DEFAULT NULL
    `);
    console.log('✅ [021] users.profile_picture column added.');
    return true;
  } catch (error) {
    console.error('❌ [021] Migration failed:', error.message);
    return true; // non-fatal — don't block startup
  }
}

module.exports = up;

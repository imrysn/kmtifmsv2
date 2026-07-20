const { query } = require('../config/database');

/**
 * Migration 027 - Add panel_type to notifications
 *
 * The KMTI team leader uses ONE account that can log in as either a "user"
 * or as the "teamleader" panel.  Both panels share the same user_id, so
 * notifications stored without a panel qualifier show in BOTH views.
 *
 * panel_type values:
 *   NULL          → show in every panel (default, backwards compatible)
 *   'user'        → only shown in the user panel
 *   'teamleader'  → only shown in the team-leader panel
 */
async function up() {
  console.log('Running migration 027-add-panel-type-to-notifications...');

  try {
    await query("ALTER TABLE notifications ADD COLUMN panel_type VARCHAR(20) NULL DEFAULT NULL");
    console.log('Added panel_type column to notifications table');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    console.log('Column panel_type already exists on notifications table');
  }
}

async function down() {
  await query('ALTER TABLE notifications DROP COLUMN panel_type');
}

module.exports = { up, down };

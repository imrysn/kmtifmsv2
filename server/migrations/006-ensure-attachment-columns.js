const { query } = require('../../database/config');

async function up() {
  console.log('Running migration: 006-ensure-attachment-columns');
  const cols = [
    { name: 'status',            sql: `ALTER TABLE assignment_attachments ADD COLUMN status VARCHAR(50) DEFAULT 'team_leader_approved'` },
    { name: 'current_stage',     sql: `ALTER TABLE assignment_attachments ADD COLUMN current_stage VARCHAR(50) DEFAULT 'pending_admin'` },
    { name: 'admin_reviewed_at', sql: `ALTER TABLE assignment_attachments ADD COLUMN admin_reviewed_at DATETIME` },
    { name: 'admin_comments',    sql: `ALTER TABLE assignment_attachments ADD COLUMN admin_comments TEXT` },
    { name: 'public_network_url',sql: `ALTER TABLE assignment_attachments ADD COLUMN public_network_url TEXT` },
    { name: 'final_approved_at', sql: `ALTER TABLE assignment_attachments ADD COLUMN final_approved_at DATETIME` },
  ];
  let success = true;
  for (const col of cols) {
    try {
      const exists = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_attachments' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (!exists || exists.length === 0) {
        await query(col.sql);
        console.log(`✅ Added column assignment_attachments.${col.name}`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not add column ${col.name}:`, err.message);
      success = false;
    }
  }
  return success;
}

module.exports = { up };

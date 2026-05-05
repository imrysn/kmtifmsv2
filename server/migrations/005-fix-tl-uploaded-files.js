const { query } = require('../../database/config');

async function up() {
  console.log('Running migration: 005-fix-tl-uploaded-files');
  try {
    const result = await query(`
      UPDATE files f
      JOIN users u ON LOWER(f.username) = LOWER(u.username)
      SET f.status = 'team_leader_approved',
          f.current_stage = 'pending_admin'
      WHERE f.current_stage = 'pending_team_leader'
        AND f.status = 'uploaded'
        AND UPPER(u.role) LIKE '%TEAM_LEADER%'
    `);
    const affected = result && result.affectedRows ? result.affectedRows : 0;
    console.log(`✅ TL uploaded files fix applied — ${affected} row(s) updated`);
    return true;
  } catch (err) {
    console.warn('⚠️ TL uploaded files fix failed:', err.message);
    throw err;
  }
}

module.exports = { up };

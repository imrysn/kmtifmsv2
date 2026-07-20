const { query } = require('./server/config/database');

async function fix() {
  try {
    const sql = "UPDATE notifications SET panel_type = 'user' WHERE type IN ('overdue', 'due_soon', 'assignment', 'submission', 'for_editing', 'revision_request', 'checker_penalty', 'assignment_submission') AND (panel_type IS NULL OR panel_type = '')";
    const result = await query(sql);
    const affected = result.affectedRows || result.changes || 0;
    console.log('✅ Updated', affected, 'existing notifications with panel_type=user');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

fix();

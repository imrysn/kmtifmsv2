require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');

async function fix() {
  const notifs = await query("SELECT * FROM notifications WHERE type IN ('due_soon', 'overdue')");
  let deletedCount = 0;
  for (const n of notifs) {
    const subRow = await query(
      'SELECT id FROM assignment_submissions WHERE user_id = ? AND assignment_id = ? LIMIT 1',
      [n.user_id, n.assignment_id]
    );
    if (subRow && subRow.length > 0) {
      await query('DELETE FROM notifications WHERE id = ?', [n.id]);
      deletedCount++;
    }
  }
  console.log(`Deleted ${deletedCount} erroneous notifications for users who already submitted.`);
  process.exit(0);
}
fix();

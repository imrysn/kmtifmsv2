require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function fix() {
  await query(`
    DELETE n FROM notifications n
    JOIN assignments a ON n.assignment_id = a.id
    WHERE n.user_id = a.team_leader_id
      AND n.type IN ('due_soon', 'overdue')
  `);
  console.log("Deleted erroneous notifications for team leaders.");
  process.exit(0);
}
fix();

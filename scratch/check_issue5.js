require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const asgn = await query('SELECT id FROM assignments WHERE title = "Test For Add new checking"');
  if (!asgn[0]) return;
  const subs = await query('SELECT user_id, count(id) FROM assignment_submissions WHERE assignment_id = ? GROUP BY user_id', [asgn[0].id]);
  console.log("Submissions for 305:", subs);
  process.exit(0);
}
check();

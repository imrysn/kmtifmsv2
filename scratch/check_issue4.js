require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const asgn = await query('SELECT * FROM assignments WHERE title = "For test "');
  if (!asgn[0]) return;
  
  const subs = await query('SELECT user_id, count(id) FROM assignment_submissions WHERE assignment_id = ? GROUP BY user_id', [asgn[0].id]);
  console.log("Submissions for test:", subs);
  
  process.exit(0);
}
check();

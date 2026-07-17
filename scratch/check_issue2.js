require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const asgns = await query('SELECT id, title, status FROM assignments WHERE title = "Test For Add new checking"');
  console.log("Assignments:", asgns);
  process.exit(0);
}
check();

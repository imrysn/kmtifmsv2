require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const asgns = await query('SELECT id, title, assigned_to, status FROM assignments WHERE id = 305');
  console.log("Assignments:", asgns);
  process.exit(0);
}
check();

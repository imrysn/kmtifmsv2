require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const notifs = await query("SELECT * FROM notifications WHERE type = 'overdue'");
  console.log("Remaining overdue notifications:", notifs.length);
  process.exit(0);
}
check();

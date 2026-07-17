require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const notifs = await query("SELECT * FROM notifications WHERE type = 'overdue' AND user_id = 2");
  console.log("Remaining overdue notifications for user 2:", notifs);
  process.exit(0);
}
check();

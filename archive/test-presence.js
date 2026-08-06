const db = require('./server/config/database');
async function check() {
  try {
    const rows = await db.query("SELECT id, fullName, username, last_seen FROM users WHERE fullName LIKE '%Teoderic%'");
    console.log('Teoderic:', rows);
    const allActive = await db.query("SELECT id, fullName, username, last_seen FROM users WHERE last_seen > 0");
    console.log('All active:', allActive);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();

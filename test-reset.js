const db = require('./server/config/database');
async function resetTeoderic() {
  try {
    await db.query("UPDATE users SET last_seen = 0 WHERE id = 9");
    console.log('Reset Teoderic to offline');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
resetTeoderic();

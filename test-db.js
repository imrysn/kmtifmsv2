const db = require('./server/config/database');
async function clean() {
  try {
    const res = await db.query("DELETE FROM notifications WHERE type = 'BROADCAST'");
    console.log('Deleted all old broadcasts', res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
clean();

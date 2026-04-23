require('dotenv').config();
const mysqlConfig = require('./database/config.js');

async function test() {
  try {
    const results = await mysqlConfig.query(
      `SELECT * FROM activity_logs ORDER BY id DESC LIMIT 5`
    );
    console.log(results);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();

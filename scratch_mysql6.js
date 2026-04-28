require('dotenv').config();
const mysqlConfig = require('./database/config.js');

async function test() {
  try {
    const logs = await mysqlConfig.query(
      `SELECT * FROM activity_logs WHERE activity LIKE '%MD5P%' AND activity LIKE '%deleted%' ORDER BY id DESC LIMIT 20`
    );
    console.log(logs);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();

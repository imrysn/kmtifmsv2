require('dotenv').config();
const mysqlConfig = require('./database/config.js');

async function test() {
  try {
    const results = await mysqlConfig.query(
      `SELECT id, type, title, assignment_id, file_id, is_read FROM notifications ORDER BY id DESC LIMIT 20`
    );
    console.log(results);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();

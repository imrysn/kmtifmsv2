require('dotenv').config();
const mysqlConfig = require('./database/config.js');

async function test() {
  try {
    const results = await mysqlConfig.query(
      `SELECT * FROM files WHERE folder_name LIKE '%9321%WABC%' OR relative_path LIKE '%9321%WABC%'`
    );
    console.log(results);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();

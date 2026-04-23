require('dotenv').config();
const mysqlConfig = require('./database/config.js');

async function test() {
  try {
    const results = await mysqlConfig.query(
      `SELECT id, filename, original_name, file_path, public_network_url FROM files WHERE original_name LIKE '%MD5P107N01_WABC.icd%' OR file_path LIKE '%9321WABCOF%'`
    );
    console.log(results);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();

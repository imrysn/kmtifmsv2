const { query } = require('../database/config');
async function test() {
  try {
    const results = await query('DESCRIBE file_views');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(err.message);
  }
  process.exit(0);
}
test();

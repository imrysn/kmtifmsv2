require('dotenv').config({ path: './server/.env' });
const { query } = require('../server/config/database');
async function check() {
  const files = await query('SELECT id, original_name, uploaded_by FROM files WHERE uploaded_by = 4');
  console.log("Files by user 4:", files.length);
  process.exit(0);
}
check();

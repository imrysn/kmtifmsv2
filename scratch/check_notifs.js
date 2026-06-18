const { query } = require('../server/config/database');
async function run() {
  const notifs = await query('SELECT id, message, action_by_username, action_by_id FROM notifications ORDER BY id DESC LIMIT 5');
  console.log("NOTIFICATIONS:");
  console.log(notifs);
  const comments = await query('SELECT id, user_id, username, user_fullname FROM assignment_comments ORDER BY id DESC LIMIT 5');
  console.log("COMMENTS:");
  console.log(comments);
  process.exit(0);
}
run();

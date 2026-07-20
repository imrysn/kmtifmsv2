const { query } = require('./server/config/database');
async function test() {
  await query(
    `INSERT INTO notifications
       (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role, panel_type)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'SYSTEM', 'user')`,
    [2, 305, 'overdue', '⚠️ Task Overdue', 'Msg', 4, 'team.leader']
  );
  const res = await query('SELECT id, type, title, action_by_role, panel_type FROM notifications ORDER BY id DESC LIMIT 1');
  console.log(res);
  process.exit();
}
test();

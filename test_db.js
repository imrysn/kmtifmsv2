const db = require('./server/config/database');
async function check() {
  const users = await db.query('SELECT * FROM users');
  console.log('USERS:', users.map(u => ({id: u.id, username: u.username, role: u.role, team: u.team})));
  const tl = await db.query('SELECT tl.*, t.name FROM team_leaders tl JOIN teams t ON tl.team_id = t.id');
  console.log('TEAM LEADERS:', tl);
  process.exit(0);
}
check();

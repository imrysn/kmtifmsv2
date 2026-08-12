const { query } = require('../server/config/database');

async function check() {
  try {
    const rows = await query('SELECT id, title, team_leader_username, project_folder_path, status FROM assignments ORDER BY id DESC LIMIT 5');
    console.log('Assignments:', JSON.stringify(rows, null, 2));

    const migrations = await query('SELECT * FROM schema_migrations');
    console.log('Migrations:', JSON.stringify(migrations, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();

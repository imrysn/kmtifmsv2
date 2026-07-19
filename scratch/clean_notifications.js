const { query } = require('../server/config/database');

async function run() {
  try {
    const deleted = await query(`
      DELETE n FROM notifications n
      JOIN assignments a ON n.assignment_id = a.id
      WHERE n.type IN ('overdue', 'due_soon')
      AND a.status IN ('completed', 'checked', 'submitted', 'under_revision', 'revision')
    `);
    console.log('Cleaned up notifications:', deleted);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();

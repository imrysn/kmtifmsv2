const { query } = require('../config/database');

async function run() {
  try {
    console.log('🔄 Backfilling legacy submissions into assignment_submissions table...');
    
    // Insert any legacy submissions from assignment_members that are not yet in assignment_submissions
    const result = await query(`
      INSERT IGNORE INTO assignment_submissions (assignment_id, file_id, user_id, submitted_at)
      SELECT assignment_id, file_id, user_id, submitted_at
      FROM assignment_members
      WHERE file_id IS NOT NULL AND status = 'submitted'
    `);
    
    if (result && result.affectedRows > 0) {
      console.log(`✅ Successfully backfilled ${result.affectedRows} legacy submissions.`);
    } else {
      console.log('✅ No legacy submissions needed backfilling.');
    }
  } catch (error) {
    console.error('❌ Error backfilling legacy submissions:', error);
  }
}

module.exports = run;

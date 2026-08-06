const { query } = require('./server/config/database');
async function test() {
  try {
    const rows = await query(`
      SELECT 
        u.id, 
        u.username, 
        COUNT(f.id) as checking_assigned, 
        SUM(CASE WHEN f.checked_by IN (u.username, u.fullName) THEN COALESCE(f.checker_penalty_percentage, 0) ELSE 0 END) as total_checker_penalty 
      FROM users u 
      JOIN assignments a ON (
        a.checker_ids IS NOT NULL 
        AND a.checker_ids != '[]' 
        AND CONCAT(',', REPLACE(REPLACE(REPLACE(a.checker_ids,'[',''),']',''),'"',''), ',') LIKE CONCAT('%,', u.id, ',%')
      ) 
      JOIN assignment_submissions asub ON asub.assignment_id = a.id
      JOIN files f ON f.id = asub.file_id 
      GROUP BY u.id
    `);
    console.log(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
test();

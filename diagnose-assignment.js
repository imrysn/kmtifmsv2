const { query } = require('./database/config');

async function diagnoseAssignment(assignmentId) {
  console.log('='.repeat(80));
  console.log(`DIAGNOSING ASSIGNMENT ID: ${assignmentId}`);
  console.log('='.repeat(80));

  try {
    // 1. Get assignment details
    const assignment = await query(
      'SELECT * FROM assignments WHERE id = ?',
      [assignmentId]
    );

    if (!assignment || assignment.length === 0) {
      console.log('❌ Assignment not found!');
      return;
    }

    console.log('\n1. ASSIGNMENT DETAILS:');
    console.log(JSON.stringify(assignment[0], null, 2));

    // 2. Get assignment_members
    const members = await query(
      'SELECT * FROM assignment_members WHERE assignment_id = ?',
      [assignmentId]
    );

    console.log(`\n2. ASSIGNMENT_MEMBERS (${members.length} rows):`);
    if (members.length === 0) {
      console.log('  ⚠️  NO MEMBERS ASSIGNED!');
    } else {
      members.forEach((member, idx) => {
        console.log(`  [${idx + 1}] User ID: ${member.user_id}, File ID: ${member.file_id}, Status: ${member.status}, Submitted: ${member.submitted_at}`);
      });
    }

    // 3. Get members with their details
    const membersWithDetails = await query(`
      SELECT 
        am.*,
        u.username,
        u.fullName,
        u.role
      FROM assignment_members am
      JOIN users u ON am.user_id = u.id
      WHERE am.assignment_id = ?
    `, [assignmentId]);

    console.log(`\n3. MEMBERS WITH USER DETAILS (${membersWithDetails.length} rows):`);
    membersWithDetails.forEach((member, idx) => {
      console.log(`  [${idx + 1}] ${member.fullName || member.username} - File ID: ${member.file_id || 'NULL'} - Status: ${member.status || 'NULL'}`);
    });

    // 4. Get files that are linked to this assignment
    const filesInAssignment = await query(`
      SELECT 
        f.*,
        am.status as assignment_status,
        am.submitted_at,
        u.username,
        u.fullName
      FROM assignment_members am
      LEFT JOIN files f ON am.file_id = f.id
      LEFT JOIN users u ON am.user_id = u.id
      WHERE am.assignment_id = ?
    `, [assignmentId]);

    console.log(`\n4. FILES LINKED TO ASSIGNMENT (${filesInAssignment.length} rows):`);
    filesInAssignment.forEach((file, idx) => {
      console.log(`  [${idx + 1}] User: ${file.username || 'NULL'}`);
      console.log(`      File ID: ${file.id || 'NULL'}`);
      console.log(`      Filename: ${file.original_name || 'NULL'}`);
      console.log(`      Assignment Status: ${file.assignment_status || 'NULL'}`);
      console.log(`      Submitted At: ${file.submitted_at || 'NULL'}`);
      console.log('');
    });

    // 5. Try the actual query used in the API
    const apiQuery = await query(`
      SELECT 
        f.*,
        u.username,
        u.fullName,
        am.submitted_at,
        am.status as review_status,
        am.id as submission_id
      FROM assignment_members am
      JOIN files f ON am.file_id = f.id
      JOIN users u ON am.user_id = u.id
      WHERE am.assignment_id = ? AND am.file_id IS NOT NULL AND am.status = 'submitted'
      ORDER BY am.submitted_at DESC
    `, [assignmentId]);

    console.log(`5. API QUERY RESULT (${apiQuery.length} rows):`);
    if (apiQuery.length === 0) {
      console.log('  ⚠️  NO RESULTS FROM API QUERY!');
      console.log('\n  Checking conditions:');
      
      // Check each condition
      const withFileId = await query(
        'SELECT COUNT(*) as count FROM assignment_members WHERE assignment_id = ? AND file_id IS NOT NULL',
        [assignmentId]
      );
      console.log(`  - Records with file_id IS NOT NULL: ${withFileId[0].count}`);

      const withStatus = await query(
        'SELECT COUNT(*) as count FROM assignment_members WHERE assignment_id = ? AND status = "submitted"',
        [assignmentId]
      );
      console.log(`  - Records with status = 'submitted': ${withStatus[0].count}`);

      const withBoth = await query(
        'SELECT COUNT(*) as count FROM assignment_members WHERE assignment_id = ? AND file_id IS NOT NULL AND status = "submitted"',
        [assignmentId]
      );
      console.log(`  - Records with BOTH conditions: ${withBoth[0].count}`);

    } else {
      apiQuery.forEach((result, idx) => {
        console.log(`  [${idx + 1}] ${result.original_name} by ${result.fullName || result.username}`);
      });
    }

    // 6. Check all files in the database for this user/team
    const allFiles = await query(`
      SELECT f.*, u.username, u.team
      FROM files f
      JOIN users u ON f.user_id = u.id
      WHERE u.team = ?
      ORDER BY f.uploaded_at DESC
      LIMIT 10
    `, [assignment[0].team]);

    console.log(`\n6. RECENT FILES IN TEAM "${assignment[0].team}" (${allFiles.length} rows):`);
    allFiles.forEach((file, idx) => {
      console.log(`  [${idx + 1}] ID: ${file.id} - ${file.original_name} by ${file.username}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Get assignment ID from command line or use default
const assignmentId = process.argv[2] || 1;

console.log(`\nDiagnosing assignment ID: ${assignmentId}`);
console.log('Usage: node diagnose-assignment.js [assignmentId]\n');

diagnoseAssignment(assignmentId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nDiagnosis failed:', error);
    process.exit(1);
  });

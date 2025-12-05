const { query } = require('./database/config');

async function fixAssignmentMembers() {
  console.log('Starting assignment members fix...\n');

  try {
    // Find all assignments
    const assignments = await query(`
      SELECT * FROM assignments
    `);

    console.log(`Found ${assignments.length} assignments\n`);

    for (const assignment of assignments) {
      console.log(`\nProcessing Assignment ID ${assignment.id}: "${assignment.title}"`);
      console.log(`  Team: ${assignment.team}`);
      console.log(`  Assigned to: ${assignment.assigned_to}`);

      // Check current members
      const currentMembers = await query(
        'SELECT * FROM assignment_members WHERE assignment_id = ?',
        [assignment.id]
      );
      
      console.log(`  Current members in DB: ${currentMembers.length}`);

      if (assignment.assigned_to === 'all') {
        // Get all team members
        const teamMembers = await query(
          'SELECT id, username, fullName FROM users WHERE team = ? AND role = ?',
          [assignment.team, 'USER']
        );

        console.log(`  Team members found: ${teamMembers.length}`);

        if (teamMembers.length > 0 && currentMembers.length === 0) {
          console.log(`  ✓ Assigning all team members...`);
          
          // Insert members
          const memberValues = teamMembers.map(member => [assignment.id, member.id]);
          const placeholders = memberValues.map(() => '(?, ?)').join(', ');
          const flattenedValues = memberValues.flat();

          await query(
            `INSERT INTO assignment_members (assignment_id, user_id) VALUES ${placeholders}`,
            flattenedValues
          );

          console.log(`  ✓ Successfully assigned ${teamMembers.length} members`);

          // List the members
          teamMembers.forEach(member => {
            console.log(`    - ${member.fullName || member.username} (ID: ${member.id})`);
          });
        } else if (currentMembers.length > 0) {
          console.log(`  → Already has members assigned, skipping`);
        } else {
          console.log(`  ⚠ No team members found to assign`);
        }
      } else if (assignment.assigned_to === 'specific') {
        console.log(`  → Specific assignment (not fixing)`);
      }

      // Check for submissions
      const submissions = await query(`
        SELECT am.*, f.original_name, u.username
        FROM assignment_members am
        LEFT JOIN files f ON am.file_id = f.id
        LEFT JOIN users u ON am.user_id = u.id
        WHERE am.assignment_id = ? AND am.file_id IS NOT NULL
      `, [assignment.id]);

      if (submissions.length > 0) {
        console.log(`  📄 Submissions: ${submissions.length}`);
        submissions.forEach(sub => {
          console.log(`    - ${sub.original_name} by ${sub.username}`);
        });
      }
    }

    console.log('\n✅ Fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing assignment members:', error);
    throw error;
  }
}

// Run the fix
fixAssignmentMembers()
  .then(() => {
    console.log('\nDone! You can now refresh your browser to see the changes.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed to fix assignment members:', error);
    process.exit(1);
  });

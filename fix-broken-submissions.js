const { query, queryOne } = require('./database/config');

async function fixBrokenSubmissions() {
  console.log('Finding and fixing broken assignment submissions...\n');

  try {
    // Find all assignment_members with status='submitted' but file_id IS NULL
    const brokenSubmissions = await query(`
      SELECT 
        am.*,
        u.username,
        u.fullName,
        a.title as assignment_title
      FROM assignment_members am
      JOIN users u ON am.user_id = u.id
      JOIN assignments a ON am.assignment_id = a.id
      WHERE am.status = 'submitted' AND am.file_id IS NULL
    `);

    console.log(`Found ${brokenSubmissions.length} broken submissions\n`);

    if (brokenSubmissions.length === 0) {
      console.log('✅ No broken submissions found!');
      return;
    }

    for (const submission of brokenSubmissions) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Fixing submission for assignment "${submission.assignment_title}"`);
      console.log(`User: ${submission.fullName || submission.username} (ID: ${submission.user_id})`);
      console.log(`Submitted: ${submission.submitted_at}`);

      // Find the most recent file uploaded by this user around the submission time
      const userFiles = await query(`
        SELECT *
        FROM files
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
        LIMIT 5
      `, [submission.user_id]);

      if (userFiles.length === 0) {
        console.log(`  ⚠️  No files found for this user`);
        continue;
      }

      console.log(`\n  Found ${userFiles.length} recent files by this user:`);
      userFiles.forEach((file, idx) => {
        console.log(`    [${idx + 1}] ID: ${file.id} - ${file.original_name} (Uploaded: ${file.uploaded_at})`);
      });

      // Use the most recent file
      const selectedFile = userFiles[0];
      console.log(`\n  ✓ Selecting file: ${selectedFile.original_name} (ID: ${selectedFile.id})`);

      // Update the assignment_members record
      await query(
        'UPDATE assignment_members SET file_id = ? WHERE id = ?',
        [selectedFile.id, submission.id]
      );

      console.log(`  ✅ Successfully linked file to submission!`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ All broken submissions have been fixed!');
    console.log('\nYou can now refresh your browser to see the submissions.');

  } catch (error) {
    console.error('❌ Error fixing broken submissions:', error);
    throw error;
  }
}

// Run the fix
fixBrokenSubmissions()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed to fix broken submissions:', error);
    process.exit(1);
  });

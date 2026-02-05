const { db } = require('../config/database');

/**
 * Migration: Group ALL files in the same assignment under one folder
 */

async function groupFilesByAssignment() {
  console.log('🔄 Starting migration: Group files by assignment...');

  return new Promise((resolve, reject) => {
    // Get all assignment submissions
    db.all(`
      SELECT 
        asub.assignment_id,
        asub.file_id,
        f.original_name,
        f.folder_name,
        a.title as assignment_title
      FROM assignment_submissions asub
      JOIN files f ON asub.file_id = f.id
      JOIN assignments a ON asub.assignment_id = a.id
      ORDER BY asub.assignment_id, asub.submitted_at
    `, [], async (err, submissions) => {
      if (err) {
        console.error('❌ Error fetching submissions:', err);
        return reject(err);
      }

      console.log(`📊 Found ${submissions.length} total submissions`);

      // Group by assignment
      const groupedByAssignment = {};
      submissions.forEach(sub => {
        if (!groupedByAssignment[sub.assignment_id]) {
          groupedByAssignment[sub.assignment_id] = [];
        }
        groupedByAssignment[sub.assignment_id].push(sub);
      });

      console.log(`📋 Processing ${Object.keys(groupedByAssignment).length} assignments...`);

      let totalUpdated = 0;
      let totalFolders = 0;

      // Process each assignment
      for (const [assignmentId, files] of Object.entries(groupedByAssignment)) {
        if (files.length <= 1) {
          console.log(`⏭️  Assignment ${assignmentId} ("${files[0].assignment_title}") has only 1 file, skipping...`);
          continue;
        }

        // Use the assignment title as the folder name
        const folderName = files[0].assignment_title || `Assignment_${assignmentId}`;
        
        console.log(`📁 Creating folder "${folderName}" with ${files.length} files`);

        // Update all files in this assignment
        for (const file of files) {
          await new Promise((resolveUpdate, rejectUpdate) => {
            db.run(`
              UPDATE files 
              SET folder_name = ?, is_folder = 1 
              WHERE id = ?
            `, [folderName, file.file_id], (updateErr) => {
              if (updateErr) {
                console.error(`❌ Error updating file ${file.file_id}:`, updateErr);
                rejectUpdate(updateErr);
              } else {
                console.log(`   ✓ Updated: ${file.original_name}`);
                totalUpdated++;
                resolveUpdate();
              }
            });
          });
        }

        totalFolders++;
      }

      console.log('✅ Migration complete!');
      console.log(`📊 Stats:`);
      console.log(`   - ${totalFolders} folders created`);
      console.log(`   - ${totalUpdated} files updated`);

      resolve({ totalFolders, totalUpdated });
    });
  });
}

// Run migration if executed directly
if (require.main === module) {
  groupFilesByAssignment()
    .then(result => {
      console.log('✅ Migration completed successfully!', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { groupFilesByAssignment };

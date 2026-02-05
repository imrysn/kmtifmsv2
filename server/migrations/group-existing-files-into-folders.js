const { db } = require('../config/database');

/**
 * Migration: Group existing files into folders
 * 
 * This script identifies files that were uploaded together (within 1 minute)
 * to the same assignment and groups them under a folder name.
 */

async function groupExistingFilesIntoFolders() {
  console.log('🔄 Starting migration: Group existing files into folders...');

  return new Promise((resolve, reject) => {
    // Get all assignment submissions with their files
    db.all(`
      SELECT 
        asub.assignment_id,
        asub.file_id,
        asub.submitted_at,
        f.original_name,
        f.folder_name,
        f.user_id,
        a.title as assignment_title
      FROM assignment_submissions asub
      JOIN files f ON asub.file_id = f.id
      JOIN assignments a ON asub.assignment_id = a.id
      WHERE f.folder_name IS NULL
      ORDER BY asub.assignment_id, asub.submitted_at
    `, [], async (err, submissions) => {
      if (err) {
        console.error('❌ Error fetching submissions:', err);
        return reject(err);
      }

      console.log(`📊 Found ${submissions.length} files without folder_name`);

      // Group files by assignment
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
          console.log(`⏭️  Assignment ${assignmentId} has only 1 file, skipping...`);
          continue;
        }

        // Group files uploaded within 1 minute of each other
        const fileGroups = [];
        let currentGroup = [files[0]];
        
        for (let i = 1; i < files.length; i++) {
          const prevTime = new Date(files[i - 1].submitted_at).getTime();
          const currTime = new Date(files[i].submitted_at).getTime();
          const timeDiff = Math.abs(currTime - prevTime);

          // If uploaded within 60 seconds, group together
          if (timeDiff <= 60000) {
            currentGroup.push(files[i]);
          } else {
            if (currentGroup.length > 1) {
              fileGroups.push(currentGroup);
            }
            currentGroup = [files[i]];
          }
        }

        // Add the last group
        if (currentGroup.length > 1) {
          fileGroups.push(currentGroup);
        }

        // Update each group with a folder name
        for (let groupIndex = 0; groupIndex < fileGroups.length; groupIndex++) {
          const group = fileGroups[groupIndex];
          
          // Create a folder name based on the assignment title
          const folderName = `${files[0].assignment_title}_Group${groupIndex + 1}`;
          
          console.log(`📁 Creating folder "${folderName}" with ${group.length} files in assignment ${assignmentId}`);

          // Update all files in this group
          for (const file of group) {
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
                  totalUpdated++;
                  resolveUpdate();
                }
              });
            });
          }

          totalFolders++;
        }
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
  groupExistingFilesIntoFolders()
    .then(result => {
      console.log('✅ Migration completed successfully!', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { groupExistingFilesIntoFolders };

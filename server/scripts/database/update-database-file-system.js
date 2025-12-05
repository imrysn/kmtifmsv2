const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database:', dbPath);
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

function updateDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🔄 Starting database update for file approval system...\n');

      // Create files table
      db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        description TEXT,
        
        -- User Information
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        user_team TEXT NOT NULL,
        
        -- Workflow Status
        status TEXT NOT NULL DEFAULT 'uploaded',
        current_stage TEXT NOT NULL DEFAULT 'pending_team_leader',
        
        -- Team Leader Review
        team_leader_id INTEGER,
        team_leader_username TEXT,
        team_leader_reviewed_at DATETIME,
        team_leader_comments TEXT,
        
        -- Admin Review
        admin_id INTEGER,
        admin_username TEXT,
        admin_reviewed_at DATETIME,
        admin_comments TEXT,
        
        -- Public Network
        public_network_url TEXT,
        final_approved_at DATETIME,
        
        -- Rejection Information
        rejection_reason TEXT,
        rejected_by TEXT,
        rejected_at DATETIME,
        
        -- Timestamps
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (team_leader_id) REFERENCES users (id),
        FOREIGN KEY (admin_id) REFERENCES users (id)
      )`, (err) => {
        if (err) {
          console.error('❌ Error creating files table:', err);
          reject(err);
          return;
        }
        console.log('✅ Files table created/verified');

        // Create file_comments table for tracking all comments
        db.run(`CREATE TABLE IF NOT EXISTS file_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          user_role TEXT NOT NULL,
          comment TEXT NOT NULL,
          comment_type TEXT NOT NULL DEFAULT 'general',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating file_comments table:', err);
            reject(err);
            return;
          }
          console.log('✅ File comments table created/verified');

          // Create file_status_history table for audit trail
          db.run(`CREATE TABLE IF NOT EXISTS file_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            old_status TEXT,
            new_status TEXT NOT NULL,
            old_stage TEXT,
            new_stage TEXT NOT NULL,
            changed_by_id INTEGER,
            changed_by_username TEXT NOT NULL,
            changed_by_role TEXT NOT NULL,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
            FOREIGN KEY (changed_by_id) REFERENCES users (id)
          )`, (err) => {
            if (err) {
              console.error('❌ Error creating file_status_history table:', err);
              reject(err);
              return;
            }
            console.log('✅ File status history table created/verified');

            // Insert some sample files for testing
            insertSampleFiles(() => {
              console.log('\n✅ Database update completed successfully!');
              console.log('📁 File approval system tables created:');
              console.log('   - files: Main file storage and workflow tracking');
              console.log('   - file_comments: Comments and feedback system'); 
              console.log('   - file_status_history: Complete audit trail');
              console.log('   - uploads/: Physical file storage directory\n');
              resolve();
            });
          });
        });
      });
    });
  });
}

function insertSampleFiles(callback) {
  console.log('📝 Creating sample files for testing...');
  
  const sampleFiles = [
    {
      filename: 'project_proposal_2025.pdf',
      original_name: 'project_proposal_2025.pdf',
      file_path: '/uploads/sample_project_proposal_2025.pdf',
      file_size: 2621440, // 2.5 MB
      file_type: 'PDF Document',
      mime_type: 'application/pdf',
      description: 'Q1 2025 project proposal for new product development features',
      user_id: 1,
      username: 'john.user',
      user_team: 'Development',
      status: 'pending_team_leader',
      current_stage: 'pending_team_leader'
    },
    {
      filename: 'budget_analysis_q4.xlsx',
      original_name: 'budget_analysis_q4.xlsx', 
      file_path: '/uploads/sample_budget_analysis_q4.xlsx',
      file_size: 1887436, // 1.8 MB
      file_type: 'Excel Spreadsheet',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      description: 'Q4 budget analysis with cost projections and resource allocation',
      user_id: 4,
      username: 'test.user',
      user_team: 'QA Testing',
      status: 'team_leader_approved',
      current_stage: 'pending_admin',
      team_leader_id: 2,
      team_leader_username: 'sarah.leader',
      team_leader_reviewed_at: '2025-01-09 14:30:00',
      team_leader_comments: 'Budget figures look accurate. Approved for final admin review.'
    },
    {
      filename: 'design_mockups_mobile.zip',
      original_name: 'design_mockups_mobile.zip',
      file_path: '/uploads/sample_design_mockups_mobile.zip',
      file_size: 15728640, // 15 MB
      file_type: 'ZIP Archive',
      mime_type: 'application/zip',
      description: 'Mobile app UI/UX design mockups for the new user interface',
      user_id: 1,
      username: 'john.user', 
      user_team: 'Development',
      status: 'rejected',
      current_stage: 'rejected_by_team_leader',
      team_leader_id: 2,
      team_leader_username: 'sarah.leader',
      team_leader_reviewed_at: '2025-01-08 11:45:00',
      team_leader_comments: 'Design direction needs revision. Please update color scheme to match brand guidelines.',
      rejection_reason: 'Design does not align with current brand guidelines. Color scheme needs updating.',
      rejected_by: 'sarah.leader',
      rejected_at: '2025-01-08 11:45:00'
    },
    {
      filename: 'test_results_automation.pdf',
      original_name: 'test_results_automation.pdf',
      file_path: '/uploads/sample_test_results_automation.pdf', 
      file_size: 3145728, // 3 MB
      file_type: 'PDF Document',
      mime_type: 'application/pdf',
      description: 'Comprehensive automated testing results for release v2.1.0',
      user_id: 4,
      username: 'test.user',
      user_team: 'QA Testing',
      status: 'final_approved',
      current_stage: 'published_to_public',
      team_leader_id: 2,
      team_leader_username: 'sarah.leader',
      team_leader_reviewed_at: '2025-01-07 09:15:00',
      team_leader_comments: 'All tests passed successfully. Ready for final approval.',
      admin_id: 3,
      admin_username: 'admin',
      admin_reviewed_at: '2025-01-07 15:30:00',
      admin_comments: 'Excellent test coverage. Approved for public release.',
      public_network_url: 'https://public-network.example.com/files/test_results_automation_v2.1.0.pdf',
      final_approved_at: '2025-01-07 15:30:00'
    }
  ];

  let insertedCount = 0;
  const totalCount = sampleFiles.length;

  sampleFiles.forEach((file, index) => {
    db.run(`INSERT INTO files (
      filename, original_name, file_path, file_size, file_type, mime_type, description,
      user_id, username, user_team, status, current_stage,
      team_leader_id, team_leader_username, team_leader_reviewed_at, team_leader_comments,
      admin_id, admin_username, admin_reviewed_at, admin_comments,
      public_network_url, final_approved_at, rejection_reason, rejected_by, rejected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.filename, file.original_name, file.file_path, file.file_size, 
      file.file_type, file.mime_type, file.description,
      file.user_id, file.username, file.user_team, file.status, file.current_stage,
      file.team_leader_id || null, file.team_leader_username || null, 
      file.team_leader_reviewed_at || null, file.team_leader_comments || null,
      file.admin_id || null, file.admin_username || null,
      file.admin_reviewed_at || null, file.admin_comments || null,
      file.public_network_url || null, file.final_approved_at || null,
      file.rejection_reason || null, file.rejected_by || null, file.rejected_at || null
    ], function(err) {
      if (err) {
        console.error(`❌ Error inserting sample file ${file.filename}:`, err);
      } else {
        console.log(`✅ Sample file created: ${file.filename} (ID: ${this.lastID}, Status: ${file.status})`);
        
        // Add sample comments for some files
        if (index === 1) { // budget_analysis_q4.xlsx
          db.run(`INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
                  [this.lastID, 2, 'sarah.leader', 'TEAM LEADER', 'Budget allocation looks reasonable. Approved for admin review.', 'approval']);
        } else if (index === 3) { // test_results_automation.pdf
          db.run(`INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
                  [this.lastID, 2, 'sarah.leader', 'TEAM LEADER', 'Comprehensive test coverage. All critical paths verified.', 'approval']);
          db.run(`INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
                  [this.lastID, 3, 'admin', 'ADMIN', 'Outstanding work. Ready for public release.', 'final_approval']);
        }
      }
      
      insertedCount++;
      if (insertedCount === totalCount) {
        callback();
      }
    });
  });
}

// Run the database update
updateDatabase()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('🔐 Database connection closed.');
      }
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('❌ Database update failed:', error);
    process.exit(1);
  });

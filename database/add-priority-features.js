const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'filemanagement.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding priority and due date columns to files table...');

db.serialize(() => {
  // Add priority column (normal, high, urgent)
  db.run(`ALTER TABLE files ADD COLUMN priority TEXT DEFAULT 'normal'`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Priority column already exists');
      } else {
        console.error('❌ Error adding priority column:', err);
      }
    } else {
      console.log('✅ Priority column added successfully');
    }
  });

  // Add due_date column
  db.run(`ALTER TABLE files ADD COLUMN due_date TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Due date column already exists');
      } else {
        console.error('❌ Error adding due_date column:', err);
      }
    } else {
      console.log('✅ Due date column added successfully');
    }
  });

  // Create index for faster filtering
  db.run(`CREATE INDEX IF NOT EXISTS idx_files_priority ON files(priority)`, (err) => {
    if (err) {
      console.error('❌ Error creating priority index:', err);
    } else {
      console.log('✅ Priority index created');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_files_due_date ON files(due_date)`, (err) => {
    if (err) {
      console.error('❌ Error creating due_date index:', err);
    } else {
      console.log('✅ Due date index created');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_files_stage_team ON files(current_stage, user_team)`, (err) => {
    if (err) {
      console.error('❌ Error creating stage_team index:', err);
    } else {
      console.log('✅ Stage and team index created');
    }
    
    console.log('✅ Database migration completed!');
    db.close();
  });
});

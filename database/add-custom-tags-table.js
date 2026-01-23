const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'kmti_fms.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creating custom_tags table...');

db.serialize(() => {
  // Create custom_tags table
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_name TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating custom_tags table:', err);
    } else {
      console.log('✅ custom_tags table created successfully');
    }
  });

  // Create indexes
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_custom_tags_name ON custom_tags(tag_name)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating tag_name index:', err);
    } else {
      console.log('✅ tag_name index created');
    }
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_custom_tags_created_by ON custom_tags(created_by)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating created_by index:', err);
    } else {
      console.log('✅ created_by index created');
    }
  });

  // Verify table
  db.get(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='custom_tags'
  `, (err, row) => {
    if (err) {
      console.error('❌ Error verifying table:', err);
    } else if (row) {
      console.log('✅ custom_tags table verified');
      
      // Show table structure
      db.all(`PRAGMA table_info(custom_tags)`, (err, columns) => {
        if (!err) {
          console.log('\n📋 Table structure:');
          columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
          });
        }
      });
    } else {
      console.log('❌ Table verification failed');
    }
    
    db.close(() => {
      console.log('\n✅ Migration completed');
    });
  });
});

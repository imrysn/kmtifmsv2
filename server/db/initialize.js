const fs = require('fs').promises;
const { db, USE_MYSQL } = require('../config/database');
const { uploadsDir } = require('../config/middleware');
const fileIndexer = require('../services/fileIndexer');

// Async function to verify network uploads directory access
async function verifyUploadsDirectory() {
  try {
    await fs.access(uploadsDir);
    console.log('✅ Network uploads directory found:', uploadsDir);
  } catch (err) {
    console.log('⚠️ Network uploads directory not found, attempting to create:', uploadsDir);
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('✅ Created network uploads directory:', uploadsDir);
    } catch (mkdirErr) {
      console.error('❌ Failed to create network uploads directory:', mkdirErr.message);
      console.error('💡 Please ensure network path is accessible and has write permissions');
    }
  }
}

// Initialize database with async operations
async function initializeDatabase() {
  if (USE_MYSQL) {
    // ========================================================================
    // MySQL INITIALIZATION
    // ========================================================================
    console.log('🔧 Initializing MySQL database...');

    try {
      const mysqlConfig = require('../../database/config');

      // Test connection
      const connected = await mysqlConfig.testConnection();
      if (!connected) {
        console.error('❌ Could not establish MySQL connection after multiple retries');
        throw new Error('Failed to connect to MySQL database');
      }

      // Check if tables exist
      const tables = await mysqlConfig.query('SHOW TABLES');

      if (tables.length === 0) {
        console.log('⚠️  No tables found. Please run: npm run db:init');
        console.log('   This will create all required tables and initial data.');
      } else {
        console.log(`✅ Found ${tables.length} tables in database`);

        // Verify required tables exist
        const tableNames = tables.map(t => Object.values(t)[0]);
        const requiredTables = ['users', 'teams', 'files', 'file_comments',
          'file_status_history', 'activity_logs'];
        const missingTables = requiredTables.filter(t => !tableNames.includes(t));

        if (missingTables.length > 0) {
          console.log('⚠️  Missing tables:', missingTables.join(', '));
          console.log('   Run: npm run db:init');
        } else {
          console.log('✅ All required tables present');
        }
      }

      console.log('📁 File approval system ready (MySQL)');
      console.log('✅ Database initialized successfully');

      // Initialize file index table
      await fileIndexer.initializeIndexTable();

    } catch (error) {
      console.error('❌ MySQL initialization error:', error.message);
      console.error('\n💡 Please ensure:');
      console.error('   1. MySQL server (KMTI-NAS) is running and accessible');
      console.error('   2. Database credentials are correct in .env file');
      console.error('   3. Network connection to KMTI-NAS is stable');
      console.error('   4. Database has been initialized: npm run db:init');
      console.error('   5. Firewall allows MySQL port 3306');
      console.error('\n🔧 Debug information:');
      console.error('   Error:', error.stack || error.message);
      throw error;
    }

  } else {
    // ========================================================================
    // SQLITE INITIALIZATION
    // ========================================================================
    console.log('🔧 Initializing SQLite database...');

    return new Promise((resolve, reject) => {
      // Create users table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        team TEXT DEFAULT 'General',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
        console.log('✅ Users table created/verified');

        // Create activity_logs table
        db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT NOT NULL,
          role TEXT NOT NULL,
          team TEXT NOT NULL,
          activity TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) {
            console.error('Error creating activity_logs table:', err);
            reject(err);
            return;
          }
          console.log('✅ Activity logs table created/verified');

          // Create files table for file approval system
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
              console.error('Error creating files table:', err);
              reject(err);
              return;
            }
            console.log('✅ Files table created/verified');

            // Create file_comments table
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
                console.error('Error creating file_comments table:', err);
                reject(err);
                return;
              }
              console.log('✅ File comments table created/verified');

              // Create file_status_history table
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
                  console.error('Error creating file_status_history table:', err);
                  reject(err);
                  return;
                }
                console.log('✅ File status history table created/verified');

                // Create teams table
                db.run(`CREATE TABLE IF NOT EXISTS teams (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT UNIQUE NOT NULL,
                  description TEXT,
                  leader_id INTEGER,
                  leader_username TEXT,
                  color TEXT DEFAULT '#3B82F6',
                  is_active BOOLEAN DEFAULT 1,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (leader_id) REFERENCES users (id)
                )`, (err) => {
                  if (err) {
                    console.error('Error creating teams table:', err);
                    reject(err);
                    return;
                  }
                  console.log('✅ Teams table created/verified');

                  // Create assignments tables for Google Classroom-style functionality
                  db.run(`CREATE TABLE IF NOT EXISTS assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    due_date DATETIME,
                    file_type_required TEXT,
                    assigned_to TEXT DEFAULT 'all',
                    max_file_size INTEGER DEFAULT 10485760,
                    team_leader_id INTEGER NOT NULL,
                    team_leader_username TEXT NOT NULL,
                    team TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (team_leader_id) REFERENCES users (id)
                  )`, (err) => {
                    if (err) {
                      console.error('Error creating assignments table:', err);
                      reject(err);
                      return;
                    }
                    console.log('✅ Assignments table created/verified');

                    // Create assignment_members table
                    db.run(`CREATE TABLE IF NOT EXISTS assignment_members (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      assignment_id INTEGER NOT NULL,
                      user_id INTEGER NOT NULL,
                      status TEXT DEFAULT 'pending',
                      submitted_at DATETIME,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
                      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )`, (err) => {
                      if (err) {
                        console.error('Error creating assignment_members table:', err);
                        reject(err);
                        return;
                      }
                      console.log('✅ Assignment members table created/verified');

                      // Create assignment_submissions table
                      db.run(`CREATE TABLE IF NOT EXISTS assignment_submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        assignment_id INTEGER NOT NULL,
                        file_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
                        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                      )`, (err) => {
                        if (err) {
                          console.error('Error creating assignment_submissions table:', err);
                          reject(err);
                          return;
                        }
                        console.log('✅ Assignment submissions table created/verified');

                        // Add database indexes
                        addDatabaseIndexes();

                        // Initialize file index table (async)
                        fileIndexer.initializeIndexTable().then(() => {
                          console.log('✅ File index table initialized');
                        }).catch(err => {
                          console.error('⚠️  Error initializing file index table:', err);
                        });

                        // Handle user table migration
                        handleUserTableMigration(resolve, reject);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

// Add database indexes for frequently queried columns (SQLite only)
function addDatabaseIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_team ON users(team)',
    'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_user_team ON files(user_team)',
    'CREATE INDEX IF NOT EXISTS idx_files_current_stage ON files(current_stage)',
    'CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_comments_file_id ON file_comments(file_id)'
  ];

  indexes.forEach(sql => {
    db.run(sql, (err) => {
      if (err) {
        console.error('❌ Error creating index:', err);
      }
    });
  });
}

// Handle user table migration (SQLite only)
function handleUserTableMigration(resolve, reject) {
  // Check table structure and add missing columns if needed
  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (err) {
      console.error('Error getting table info:', err);
      reject(err);
      return;
    }
    const columnNames = columns.map(col => col.name);
    const hasFullName = columnNames.includes('fullName');
    const hasUsername = columnNames.includes('username');
    const hasRole = columnNames.includes('role');
    const hasTeam = columnNames.includes('team');

    // Add missing columns
    const alterPromises = [];
    if (!hasFullName) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN fullName TEXT DEFAULT "Unknown"', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Added fullName column'); resolve();
          }
        });
      }));
    }
    if (!hasUsername) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN username TEXT', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Added username column'); resolve();
          }
        });
      }));
    }
    if (!hasRole) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "USER"', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Added role column'); resolve();
          }
        });
      }));
    }
    if (!hasTeam) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN team TEXT DEFAULT "General"', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Added team column'); resolve();
          }
        });
      }));
    }

    Promise.all(alterPromises).then(() => {
      // Update existing records to have proper usernames if missing
      db.run(`UPDATE users SET username =
        CASE
          WHEN username IS NULL OR username = '' THEN
            SUBSTR(email, 1, INSTR(email, '@') - 1)
          ELSE username
        END
        WHERE username IS NULL OR username = ''`, (err) => {
        if (err) {
          console.error('Error updating usernames:', err);
        } else {
          console.log('✅ Updated usernames for existing records');
        }
        // Database initialization complete
        console.log('📁 File approval system ready (SQLite)');
        console.log('✅ Database initialized successfully');
        resolve();
      });
    }).catch(reject);
  });
}

module.exports = {
  initializeDatabase,
  verifyUploadsDirectory
};

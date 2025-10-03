const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Network Database and Uploads Configuration
const networkDataPath = '\\\\KMTI-NAS\\Shared\\data';
const dbPath = path.join(networkDataPath, 'database.sqlite');
const uploadsDir = path.join(networkDataPath, 'uploads');

// Database setup
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening network database:', err.message);
    console.error('💡 Make sure network path is accessible:', networkDataPath);
  } else {
    console.log('✅ Connected to network SQLite database:', dbPath);
  }
});

// Verify network uploads directory access
if (!fs.existsSync(uploadsDir)) {
  console.log('⚠️ Network uploads directory not found, attempting to create:', uploadsDir);
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created network uploads directory:', uploadsDir);
  } catch (err) {
    console.error('❌ Failed to create network uploads directory:', err.message);
    console.error('💡 Please ensure network path is accessible and has write permissions');
  }
} else {
  console.log('✅ Network uploads directory found:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'file://'], // Allow Vite dev server and Electron
  credentials: true
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
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
            category TEXT,
            tags TEXT,
            
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
                
                // Now handle user table migration
                handleUserTableMigration(resolve, reject);
              });
            });
            });
          });
        });
      });
    });
  });
}

// Handle user table migration and seeding
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
    
    console.log('Current columns:', columnNames);
    
    // Add missing columns
    const alterPromises = [];
    
    if (!hasFullName) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN fullName TEXT DEFAULT "Unknown"', (err) => {
          if (err) reject(err); else { console.log('✅ Added fullName column'); resolve(); }
        });
      }));
    }
    
    if (!hasUsername) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN username TEXT', (err) => {
          if (err) reject(err); else { console.log('✅ Added username column'); resolve(); }
        });
      }));
    }
    
    if (!hasRole) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "USER"', (err) => {
          if (err) reject(err); else { console.log('✅ Added role column'); resolve(); }
        });
      }));
    }
    
    if (!hasTeam) {
      alterPromises.push(new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN team TEXT DEFAULT "General"', (err) => {
          if (err) reject(err); else { console.log('✅ Added team column'); resolve(); }
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
        
        seedTestUsers(resolve, reject);
      });
    }).catch(reject);
  });
}

// Seed test users and sample files
function seedTestUsers(resolve, reject) {
  // Delete existing test users first to avoid conflicts
  const testEmails = ['user@example.com', 'teamleader@example.com', 'admin@example.com', 'test@example.com'];
  
  db.run(`DELETE FROM users WHERE email IN (${testEmails.map(() => '?').join(',')})`, testEmails, (err) => {
    if (err) {
      console.error('Error deleting existing test users:', err);
    } else {
      console.log('✅ Cleared existing test users');
    }
    
    // Create new test users
    const testUsers = [
      { 
        fullName: 'John User', 
        username: 'john.user', 
        email: 'user@example.com', 
        password: 'password123', 
        role: 'USER', 
        team: 'General' 
      },
      { 
        fullName: 'Sarah Team Leader', 
        username: 'sarah.leader', 
        email: 'teamleader@example.com', 
        password: 'password123', 
        role: 'TEAM LEADER', 
        team: 'General' 
      },
      { 
        fullName: 'Admin Administrator', 
        username: 'admin', 
        email: 'admin@example.com', 
        password: 'password123', 
        role: 'ADMIN', 
        team: 'General' 
      },
      { 
        fullName: 'Test User', 
        username: 'test.user', 
        email: 'test@example.com', 
        password: 'password123', 
        role: 'USER', 
        team: 'General' 
      }
    ];
    
    let completed = 0;
    const total = testUsers.length;
    
    // Create only the General team (required for test users)
    const now = new Date().toISOString();
    db.run(
      'INSERT OR IGNORE INTO teams (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ['General', 'Default team for all users', now, now],
      function(err) {
        if (err) {
          console.error('❌ Error creating General team:', err);
        } else {
          console.log('✅ General team ensured in database');
        }
        
        // Now create users
        createTestUsers();
      }
    );
    
    function createTestUsers() {
      testUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        db.run(
          'INSERT INTO users (fullName, username, email, password, role, team) VALUES (?, ?, ?, ?, ?, ?)', 
          [user.fullName, user.username, user.email, hashedPassword, user.role, user.team], 
          function(err) {
            if (err) {
              console.error(`Error creating ${user.role} user:`, err);
            } else {
              console.log(`✅ ${user.role} user created: ${user.username} (${user.email}) - Team: ${user.team}`);
            }
            
            completed++;
            if (completed === total) {
              // Complete user creation process
              completeUserCreation();
            }
          }
        );
      });
    }
    
    function completeUserCreation() {
      console.log('\n👤 Available test accounts:');
      console.log('  USER: user@example.com / password123 (John User)');
      console.log('  TEAM LEADER: teamleader@example.com / password123 (Sarah Team Leader)');
      console.log('  ADMIN: admin@example.com / password123 (Admin Administrator)');
      console.log('  Legacy USER: test@example.com / password123 (Test User)\n');
      
      // Add sample files and activity logs
      seedSampleData(resolve, reject);
    }
  });
}

// Seed sample data only on first run or when database is empty
function seedSampleData(resolve, reject) {
  // Check if sample data already exists to prevent duplication
  db.get('SELECT COUNT(*) as count FROM files', [], (err, result) => {
    if (err) {
      console.error('❌ Error checking existing files:', err);
      reject(err);
      return;
    }
    
    if (result.count > 0) {
      console.log('✅ Database already contains files, skipping sample data seeding');
      resolve();
      return;
    }
    
    console.log('📁 Database is empty, adding sample data for first-time setup...');
    
    // Add initial activity log
    logActivity(null, 'System', 'SYSTEM', 'System', 'File approval system initialized');
    
    console.log('\n📁 File approval system initialized without mock data');
    console.log('✅ Ready for real file uploads');
    resolve();
  });
}

// Activity logging function
function logActivity(userId, username, role, team, activity) {
  db.run(
    'INSERT INTO activity_logs (user_id, username, role, team, activity) VALUES (?, ?, ?, ?, ?)',
    [userId, username, role, team, activity],
    function(err) {
      if (err) {
        console.error('❌ Error logging activity:', err);
      } else {
        console.log(`📋 Activity logged: ${activity} by ${username}`);
      }
    }
  );
}

// File status history logging
function logFileStatusChange(fileId, oldStatus, newStatus, oldStage, newStage, changedById, changedByUsername, changedByRole, reason = null) {
  db.run(
    'INSERT INTO file_status_history (file_id, old_status, new_status, old_stage, new_stage, changed_by_id, changed_by_username, changed_by_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [fileId, oldStatus, newStatus, oldStage, newStage, changedById, changedByUsername, changedByRole, reason],
    function(err) {
      if (err) {
        console.error('❌ Error logging file status change:', err);
      } else {
        console.log(`📋 File status change logged: File ${fileId} ${oldStatus} -> ${newStatus}`);
      }
    }
  );
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.post('/api/auth/login', (req, res) => {
  console.log('🔐 Login attempt for:', req.body.email, 'via', req.body.loginType || 'user', 'window');
  const { email, password, loginType = 'user' } = req.body;
  
  // Basic validation
  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required' 
    });
  }
  
  if (!['user', 'admin'].includes(loginType)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid login type' 
    });
  }
  
  // Find user by email OR username
  const query = email.includes('@') 
    ? 'SELECT * FROM users WHERE email = ?'
    : 'SELECT * FROM users WHERE username = ?';
    
  db.get(query, [email], (err, user) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    console.log('✅ User found, verifying password...');
    
    // Verify password
    const isValidPassword = bcrypt.compareSync(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    console.log(`✅ Password verified for ${user.role}: ${email}`);
    
    // Role-based access control
    const userRole = user.role;
    
    if (loginType === 'user') {
      // User window: USER and TEAM LEADER can access
      if (userRole === 'ADMIN') {
        console.log('❌ ADMIN user trying to access user window');
        return res.status(403).json({ 
          success: false, 
          message: 'Admin accounts must use the Admin Login. Please switch to Admin Login to continue.' 
        });
      }
    } else if (loginType === 'admin') {
      // Admin window: TEAM LEADER and ADMIN can access
      if (userRole === 'USER') {
        console.log('❌ USER trying to access admin window');
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to access the Admin Login. Please use the User Login instead.' 
        });
      }
    }
    
    // Determine panel type based on role and login type
    let panelType;
    if (loginType === 'user') {
      panelType = 'user'; // Both USER and TEAM LEADER get user panel via user login
    } else if (loginType === 'admin') {
      if (userRole === 'TEAM LEADER') {
        panelType = 'teamleader';
      } else if (userRole === 'ADMIN') {
        panelType = 'admin';
      }
    }
    
    console.log(`✅ Login successful for ${userRole} -> ${panelType} panel`);
    
    // Log activity
    logActivity(
      user.id,
      user.username,
      user.role,
      user.team,
      `User logged in via ${loginType} portal`
    );
    
    // Remove password from user object before sending response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      success: true, 
      user: {
        ...userWithoutPassword,
        panelType
      },
      message: 'Login successful' 
    });
  });
});

// User Management Endpoints

// Get all users (Admin only)
app.get('/api/users', (req, res) => {
  console.log('📈 Getting all users...');
  
  db.all('SELECT id, fullName, username, email, role, team, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
    if (err) {
      console.error('❌ Database error getting users:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch users' 
      });
    }
    
    console.log(`✅ Retrieved ${users.length} users`);
    res.json({ 
      success: true, 
      users 
    });
  });
});

// Create new user (Admin only)
app.post('/api/users', (req, res) => {
  const { fullName, username, email, password, role = 'USER', team = 'General' } = req.body;
  
  console.log('👥 Creating new user:', { fullName, username, email, role, team });
  
  // Validation
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Full name, username, email, and password are required' 
    });
  }
  
  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (fullName, username, email, password, role, team) VALUES (?, ?, ?, ?, ?, ?)',
    [fullName, username, email, hashedPassword, role, team],
    function(err) {
      if (err) {
        console.error('❌ Error creating user:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ 
            success: false, 
            message: 'Username or email already exists' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create user' 
        });
      }
      
      console.log(`✅ User created with ID: ${this.lastID}`);
      
      // Log activity
      logActivity(
        this.lastID,
        username,
        role,
        team,
        `User account created by administrator`
      );
      
      res.status(201).json({ 
        success: true, 
        message: 'User created successfully',
        userId: this.lastID
      });
    }
  );
});

// Update user (Admin only)
app.put('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const { fullName, username, email, role, team } = req.body;
  
  console.log(`✏️ Updating user ${userId}:`, { fullName, username, email, role, team });
  
  // Validation
  if (!fullName || !username || !email || !role) {
    return res.status(400).json({ 
      success: false, 
      message: 'Full name, username, email, and role are required' 
    });
  }
  
  db.run(
    'UPDATE users SET fullName = ?, username = ?, email = ?, role = ?, team = ? WHERE id = ?',
    [fullName, username, email, role, team || 'General', userId],
    function(err) {
      if (err) {
        console.error('❌ Error updating user:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ 
            success: false, 
            message: 'Username or email already exists' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update user' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      console.log(`✅ User ${userId} updated successfully`);
      
      // Log activity
      logActivity(
        userId,
        username,
        role,
        team,
        `User profile updated by administrator (Name: ${fullName}, Role: ${role}, Team: ${team})`
      );
      
      res.json({ 
        success: true, 
        message: 'User updated successfully' 
      });
    }
  );
});

// Reset user password (Admin only)
app.put('/api/users/:id/password', (req, res) => {
  const userId = req.params.id;
  const { password } = req.body;
  
  console.log(`🔐 Resetting password for user ${userId}`);
  
  if (!password || password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 6 characters long' 
    });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, userId],
    function(err) {
      if (err) {
        console.error('❌ Error resetting password:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to reset password' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      console.log(`✅ Password reset for user ${userId}`);
      
      // Get user details for logging
      db.get('SELECT username, role, team FROM users WHERE id = ?', [userId], (err, userDetails) => {
        if (!err && userDetails) {
          logActivity(
            userId,
            userDetails.username,
            userDetails.role,
            userDetails.team,
            'Password reset by administrator'
          );
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Password reset successfully' 
      });
    }
  );
});

// Delete user (Admin only)
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  console.log(`🗑️ Deleting user ${userId}`);
  
  // First check if user exists and get their info
  db.get('SELECT fullName, email FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('❌ Error checking user:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete user' 
      });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Delete the user
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error('❌ Error deleting user:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete user' 
        });
      }
      
      console.log(`✅ User deleted: ${user.fullName} (${user.email})`);
      
      // Log activity (using user info before deletion)
      logActivity(
        null, // user_id is null since user is deleted
        'System',
        'ADMIN',
        'System',
        `User account deleted by administrator: ${user.fullName} (${user.email})`
      );
      
      res.json({ 
        success: true, 
        message: `User ${user.fullName} deleted successfully` 
      });
    });
  });
});

// Search users (Admin only)
app.get('/api/users/search', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Search query is required' 
    });
  }
  
  console.log(`🔍 Searching users with query: ${q}`);
  
  const searchPattern = `%${q}%`;
  
  db.all(
    `SELECT id, fullName, username, email, role, team, created_at 
     FROM users 
     WHERE fullName LIKE ? OR username LIKE ? OR email LIKE ? OR role LIKE ? OR team LIKE ?
     ORDER BY fullName`,
    [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern],
    (err, users) => {
      if (err) {
        console.error('❌ Error searching users:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Search failed' 
        });
      }
      
      console.log(`✅ Found ${users.length} users matching '${q}'`);
      res.json({ 
        success: true, 
        users 
      });
    }
  );
});

// TEAMS MANAGEMENT ENDPOINTS

// Get all teams (Admin only)
app.get('/api/teams', (req, res) => {
  console.log('🏢 Getting all teams...');
  
  db.all('SELECT * FROM teams ORDER BY created_at DESC', [], (err, teams) => {
    if (err) {
      console.error('❌ Database error getting teams:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch teams' 
      });
    }
    
    console.log(`✅ Retrieved ${teams.length} teams`);
    res.json({ 
      success: true, 
      teams 
    });
  });
});

// Create new team (Admin only)
app.post('/api/teams', (req, res) => {
  const { name, description, leaderId, leaderUsername, color = '#3B82F6' } = req.body;
  
  console.log('🏢 Creating new team:', { name, description, leaderId, leaderUsername, color });
  
  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Team name is required' 
    });
  }
  
  const now = new Date().toISOString();
  
  db.run(
    'INSERT INTO teams (name, description, leader_id, leader_username, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name.trim(), description || null, leaderId || null, leaderUsername || null, color, now, now],
    function(err) {
      if (err) {
        console.error('❌ Error creating team:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ 
            success: false, 
            message: 'Team name already exists' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create team' 
        });
      }
      
      console.log(`✅ Team created with ID: ${this.lastID}`);
      
      // Log activity
      logActivity(
        null,
        'System',
        'ADMIN',
        'System',
        `Team created: ${name} (ID: ${this.lastID})`
      );
      
      res.status(201).json({ 
        success: true, 
        message: 'Team created successfully',
        teamId: this.lastID,
        team: {
          id: this.lastID,
          name: name.trim(),
          description: description || null,
          leader_id: leaderId || null,
          leader_username: leaderUsername || null,
          color: color,
          is_active: 1,
          created_at: now,
          updated_at: now
        }
      });
    }
  );
});

// Update team (Admin only)
app.put('/api/teams/:id', (req, res) => {
  const teamId = req.params.id;
  const { name, description, leaderId, leaderUsername, color, isActive } = req.body;
  
  console.log(`✏️ Updating team ${teamId}:`, { name, description, leaderId, leaderUsername, color, isActive });
  
  // Validation
  if (!name || name.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Team name is required' 
    });
  }
  
  const now = new Date().toISOString();
  const activeStatus = isActive !== undefined ? (isActive ? 1 : 0) : 1;
  
  db.run(
    'UPDATE teams SET name = ?, description = ?, leader_id = ?, leader_username = ?, color = ?, is_active = ?, updated_at = ? WHERE id = ?',
    [name.trim(), description || null, leaderId || null, leaderUsername || null, color || '#3B82F6', activeStatus, now, teamId],
    function(err) {
      if (err) {
        console.error('❌ Error updating team:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ 
            success: false, 
            message: 'Team name already exists' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update team' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Team not found' 
        });
      }
      
      console.log(`✅ Team ${teamId} updated successfully`);
      
      // Log activity
      logActivity(
        null,
        'System',
        'ADMIN',
        'System',
        `Team updated: ${name} (ID: ${teamId})`
      );
      
      res.json({ 
        success: true, 
        message: 'Team updated successfully' 
      });
    }
  );
});

// Delete team (Admin only)
app.delete('/api/teams/:id', (req, res) => {
  const teamId = req.params.id;
  
  console.log(`🗑️ Deleting team ${teamId}`);
  
  // First check if team exists and get info
  db.get('SELECT name FROM teams WHERE id = ?', [teamId], (err, team) => {
    if (err) {
      console.error('❌ Error checking team:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete team' 
      });
    }
    
    if (!team) {
      return res.status(404).json({ 
        success: false, 
        message: 'Team not found' 
      });
    }
    
    // Check if team has users assigned
    db.get('SELECT COUNT(*) as count FROM users WHERE team = ?', [team.name], (err, result) => {
      if (err) {
        console.error('❌ Error checking team users:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete team' 
        });
      }
      
      if (result.count > 0) {
        return res.status(409).json({ 
          success: false, 
          message: `Cannot delete team '${team.name}' because it has ${result.count} user(s) assigned. Please reassign users to other teams first.` 
        });
      }
      
      // Delete the team
      db.run('DELETE FROM teams WHERE id = ?', [teamId], function(err) {
        if (err) {
          console.error('❌ Error deleting team:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to delete team' 
          });
        }
        
        console.log(`✅ Team deleted: ${team.name}`);
        
        // Log activity
        logActivity(
          null,
          'System',
          'ADMIN',
          'System',
          `Team deleted: ${team.name} (ID: ${teamId})`
        );
        
        res.json({ 
          success: true, 
          message: `Team '${team.name}' deleted successfully` 
        });
      });
    });
  });
});

// Get team by name (for user assignment validation)
app.get('/api/teams/name/:name', (req, res) => {
  const { name } = req.params;
  
  db.get('SELECT * FROM teams WHERE name = ? AND is_active = 1', [name], (err, team) => {
    if (err) {
      console.error('❌ Error getting team by name:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch team' 
      });
    }
    
    res.json({ 
      success: true, 
      team: team || null,
      exists: !!team
    });
  });
});

// Activity Logs Endpoints

// Get all activity logs (Admin only)
app.get('/api/activity-logs', (req, res) => {
  console.log('📋 Getting activity logs...');
  
  db.all(
    'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 1000',
    [],
    (err, logs) => {
      if (err) {
        console.error('❌ Database error getting activity logs:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch activity logs' 
        });
      }
      
      console.log(`✅ Retrieved ${logs.length} activity logs`);
      res.json({ 
        success: true, 
        logs 
      });
    }
  );
});

// Bulk delete activity logs (Admin only)
app.delete('/api/activity-logs/bulk-delete', (req, res) => {
  const { logIds } = req.body;
  
  console.log(`🗑️ Bulk deleting ${logIds?.length || 0} activity logs`);
  
  // Validation
  if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Log IDs array is required and must not be empty'
    });
  }
  
  // Create placeholders for the SQL IN clause
  const placeholders = logIds.map(() => '?').join(',');
  
  // Get log details for logging purposes before deletion
  db.all(
    `SELECT id, username, activity FROM activity_logs WHERE id IN (${placeholders})`,
    logIds,
    (err, logsToDelete) => {
      if (err) {
        console.error('❌ Error fetching logs for deletion:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch logs for deletion'
        });
      }
      
      if (logsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No logs found with the provided IDs'
        });
      }
      
      // Delete the logs
      db.run(
        `DELETE FROM activity_logs WHERE id IN (${placeholders})`,
        logIds,
        function(err) {
          if (err) {
            console.error('❌ Error deleting activity logs:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to delete activity logs'
            });
          }
          
          const deletedCount = this.changes;
          console.log(`✅ Successfully deleted ${deletedCount} activity logs`);
          
          // Log the bulk deletion activity
          logActivity(
            null,
            'System',
            'ADMIN',
            'System',
            `Bulk deletion: ${deletedCount} activity log(s) removed by administrator`
          );
          
          res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} activity log(s)`,
            deletedCount: deletedCount,
            requestedCount: logIds.length
          });
        }
      );
    }
  );
});

// FILE MANAGEMENT SYSTEM ENDPOINTS (Network Directory Browsing)

// Browse network project directory
app.get('/api/file-system/browse', (req, res) => {
  const requestPath = req.query.path || '/';
  
  // Network projects directory configuration
  const networkProjectsPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';
  
  console.log(`📁 Browsing network directory: ${requestPath}`);
  
  try {
    let fullPath;
    
    if (requestPath === '/') {
      fullPath = networkProjectsPath;
    } else {
      // Remove leading slash and join with network path
      const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
      fullPath = path.join(networkProjectsPath, relativePath);
    }
    
    console.log(`🔍 Reading directory: ${fullPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(fullPath)) {
      console.log('❌ Directory not found:', fullPath);
      return res.status(404).json({
        success: false,
        message: 'Directory not found',
        path: requestPath
      });
    }
    
    // Check if it's actually a directory
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: 'Path is not a directory',
        path: requestPath
      });
    }
    
    // Read directory contents
    const items = fs.readdirSync(fullPath);
    const fileSystemItems = [];
    
    // Function to truncate names to prevent UI misalignment
    const truncateName = (name, maxLength = 50) => {
      if (name.length <= maxLength) return name;
      const extension = path.extname(name);
      const nameWithoutExt = path.basename(name, extension);
      const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 3);
      return truncatedName + '...' + extension;
    };
    
    // Add parent directory if not at root
    if (requestPath !== '/') {
      fileSystemItems.push({
        id: 'parent',
        name: '..',
        displayName: '..',
        type: 'folder',
        path: getParentPath(requestPath),
        size: null,
        modified: null,
        isParent: true
      });
    }
    
    // Process each item in the directory
    items.forEach((item, index) => {
      try {
        const itemPath = path.join(fullPath, item);
        const itemStats = fs.statSync(itemPath);
        const isDirectory = itemStats.isDirectory();
        
        // Skip hidden files/folders
        if (item.startsWith('.')) return;
        
        const truncatedName = truncateName(item);
        const itemRequestPath = requestPath === '/' ? `/${item}` : `${requestPath}/${item}`;
        
        const fileSystemItem = {
          id: `${isDirectory ? 'folder' : 'file'}-${index}`,
          name: item,
          displayName: truncatedName,
          type: isDirectory ? 'folder' : 'file',
          path: itemRequestPath,
          size: isDirectory ? null : formatFileSize(itemStats.size),
          modified: itemStats.mtime,
          isParent: false
        };
        
        // Add file type for files
        if (!isDirectory) {
          const extension = path.extname(item).toLowerCase().slice(1);
          fileSystemItem.fileType = extension || 'unknown';
        }
        
        fileSystemItems.push(fileSystemItem);
      } catch (itemError) {
        console.error(`❌ Error processing item ${item}:`, itemError.message);
        // Skip items that can't be processed
      }
    });
    
    // Sort items: folders first, then files, alphabetically
    fileSystemItems.sort((a, b) => {
      if (a.isParent) return -1;
      if (b.isParent) return 1;
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    console.log(`✅ Found ${fileSystemItems.length} items in ${requestPath}`);
    
    res.json({
      success: true,
      items: fileSystemItems,
      path: requestPath,
      networkPath: fullPath
    });
    
  } catch (error) {
    console.error('❌ Error browsing network directory:', error);
    
    let errorMessage = 'Failed to browse directory';
    if (error.code === 'ENOENT') {
      errorMessage = 'Network directory not accessible. Please check VPN connection and permissions.';
    } else if (error.code === 'EACCES') {
      errorMessage = 'Access denied. Please check directory permissions.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      path: requestPath,
      error: error.code || error.message
    });
  }
});

// Helper function to get parent path
function getParentPath(currentPath) {
  const parts = currentPath.split('/').filter(p => p);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get network directory info
app.get('/api/file-system/info', (req, res) => {
  const networkProjectsPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';
  
  try {
    if (fs.existsSync(networkProjectsPath)) {
      const stats = fs.statSync(networkProjectsPath);
      res.json({
        success: true,
        accessible: true,
        path: networkProjectsPath,
        modified: stats.mtime,
        message: 'Network directory accessible'
      });
    } else {
      res.json({
        success: false,
        accessible: false,
        path: networkProjectsPath,
        message: 'Network directory not accessible'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      accessible: false,
      path: networkProjectsPath,
      message: 'Error accessing network directory',
      error: error.message
    });
  }
});

// Check for duplicate file names
app.post('/api/files/check-duplicate', (req, res) => {
  const { originalName, userId } = req.body;
  
  console.log(`🔍 Checking for duplicate file: ${originalName} by user ${userId}`);
  
  db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [originalName, userId], (err, existingFile) => {
    if (err) {
      console.error('❌ Error checking for duplicate file:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to check for duplicate files'
      });
    }
    
    res.json({
      success: true,
      isDuplicate: !!existingFile,
      existingFile: existingFile || null
    });
  });
});

// Upload file (User only)
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    const { description, category, tags, userId, username, userTeam, replaceExisting } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    console.log(`📁 File upload by ${username} from ${userTeam} team:`, req.file.originalname);
    
    // Get file type description based on mime type
    const getFileTypeDescription = (mimeType) => {
      const types = {
        'application/pdf': 'PDF Document',
        'application/msword': 'Word Document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
        'application/vnd.ms-excel': 'Excel Spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
        'text/plain': 'Text File',
        'image/jpeg': 'JPEG Image',
        'image/png': 'PNG Image',
        'application/zip': 'ZIP Archive'
      };
      return types[mimeType] || 'Unknown File Type';
    };
    
    // Check for duplicate file if replaceExisting is not explicitly set
    if (replaceExisting !== 'true') {
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], (err, existingFile) => {
        if (err) {
          console.error('❌ Error checking for duplicate:', err);
          fs.unlink(req.file.path, () => {});
          return res.status(500).json({
            success: false,
            message: 'Failed to check for duplicate files'
          });
        }
        
        if (existingFile) {
          // Delete the newly uploaded file since we found a duplicate
          fs.unlink(req.file.path, () => {});
          
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            message: 'File with this name already exists',
            existingFile: {
              id: existingFile.id,
              original_name: existingFile.original_name,
              uploaded_at: existingFile.uploaded_at,
              status: existingFile.status
            }
          });
        }
        
        // No duplicate found, proceed with upload
        insertFileRecord();
      });
    } else {
      // Replace existing file - first find and remove the old one
      db.get('SELECT * FROM files WHERE original_name = ? AND user_id = ?', [req.file.originalname, userId], (err, existingFile) => {
        if (existingFile) {
          // Delete old physical file
          const oldFilePath = path.join(uploadsDir, path.basename(existingFile.file_path));
          fs.unlink(oldFilePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('❌ Error deleting old file:', unlinkErr);
            } else {
              console.log('✅ Old file deleted:', oldFilePath);
            }
          });
          
          // Delete old database record
          db.run('DELETE FROM files WHERE id = ?', [existingFile.id], (deleteErr) => {
            if (deleteErr) {
              console.error('❌ Error deleting old file record:', deleteErr);
            } else {
              console.log('✅ Old file record deleted');
              logActivity(userId, username, 'USER', userTeam, `File replaced: ${req.file.originalname}`);
            }
          });
        }
        
        // Insert new file record
        insertFileRecord();
      });
    }
    
    function insertFileRecord() {
      // Insert file record into database
      db.run(`INSERT INTO files (
        filename, original_name, file_path, file_size, file_type, mime_type, description, category, tags,
        user_id, username, user_team, status, current_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        `/uploads/${req.file.filename}`,
        req.file.size,
        getFileTypeDescription(req.file.mimetype),
        req.file.mimetype,
        description || '',
        category || '',
        tags || '[]',
        userId,
        username,
        userTeam,
        'uploaded',
        'pending_team_leader'
      ], function(err) {
        if (err) {
          console.error('❌ Error saving file to database:', err);
          // Delete the uploaded file if database save fails
          fs.unlink(req.file.path, () => {});
          return res.status(500).json({
            success: false,
            message: 'Failed to save file information'
          });
        }
        
        const fileId = this.lastID;
        
        // Log the file upload
        const action = replaceExisting === 'true' ? 'replaced' : 'uploaded';
        logActivity(userId, username, 'USER', userTeam, `File ${action}: ${req.file.originalname}`);
        
        // Log status history
        logFileStatusChange(
          fileId, 
          null, 
          'uploaded', 
          null, 
          'pending_team_leader', 
          userId, 
          username, 
          'USER', 
          `File ${action} by user`
        );
        
        console.log(`✅ File ${action} successfully with ID: ${fileId}`);
        
        res.json({
          success: true,
          message: `File ${action} successfully`,
          file: {
            id: fileId,
            filename: req.file.filename,
            original_name: req.file.originalname,
            file_size: req.file.size,
            file_type: getFileTypeDescription(req.file.mimetype),
            description: description || '',
            status: 'uploaded',
            current_stage: 'pending_team_leader',
            uploaded_at: new Date()
          },
          replaced: replaceExisting === 'true'
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling file upload:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Get files for user (User only - their own files)
app.get('/api/files/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  console.log(`📁 Getting files for user ${userId}`);
  
  db.all(
    `SELECT f.*, fc.comment as latest_comment 
     FROM files f 
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     WHERE f.user_id = ? 
     ORDER BY f.uploaded_at DESC`,
    [userId],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting user files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch files'
        });
      }
      
      console.log(`✅ Retrieved ${files.length} files for user ${userId}`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Get pending files for user (files that are not final_approved)
app.get('/api/files/user/:userId/pending', (req, res) => {
  const { userId } = req.params;
  
  console.log(`📁 Getting pending files for user ${userId}`);
  
  db.all(
    `SELECT f.*, 
            GROUP_CONCAT(fc.comment, ' | ') as comments
     FROM files f 
     LEFT JOIN file_comments fc ON f.id = fc.file_id
     WHERE f.user_id = ? AND f.status != 'final_approved'
     GROUP BY f.id
     ORDER BY f.uploaded_at DESC`,
    [userId],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting user pending files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch pending files'
        });
      }
      
      // Process the files to include comments as an array
      const processedFiles = files.map(file => {
        const comments = file.comments ? 
          file.comments.split(' | ').map(comment => ({ comment })) : [];
        
        return {
          ...file,
          comments
        };
      });
      
      console.log(`✅ Retrieved ${processedFiles.length} pending files for user ${userId}`);
      res.json({
        success: true,
        files: processedFiles
      });
    }
  );
});

// Get files for team leader review (Team Leader only)
app.get('/api/files/team-leader/:team', (req, res) => {
  const { team } = req.params;
  
  console.log(`📁 Getting files for team leader review: ${team} team`);
  
  db.all(
    `SELECT f.*, fc.comment as latest_comment 
     FROM files f 
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     WHERE f.user_team = ? AND f.current_stage = 'pending_team_leader'
     ORDER BY f.uploaded_at DESC`,
    [team],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting team leader files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch files for review'
        });
      }
      
      console.log(`✅ Retrieved ${files.length} files for ${team} team leader review`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Get files for admin review (Admin only)
app.get('/api/files/admin', (req, res) => {
  console.log('📁 Getting files for admin review');
  
  db.all(
    `SELECT f.*, fc.comment as latest_comment 
     FROM files f 
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     WHERE f.current_stage = 'pending_admin'
     ORDER BY f.uploaded_at DESC`,
    [],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting admin files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch files for admin review'
        });
      }
      
      console.log(`✅ Retrieved ${files.length} files for admin review`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Get all files (Admin only - for comprehensive view)
app.get('/api/files/all', (req, res) => {
  console.log('📁 Getting all files (admin view)');
  
  db.all(
    `SELECT f.*, fc.comment as latest_comment 
     FROM files f 
     LEFT JOIN file_comments fc ON f.id = fc.file_id AND fc.id = (
       SELECT MAX(id) FROM file_comments WHERE file_id = f.id
     )
     ORDER BY f.uploaded_at DESC`,
    [],
    (err, files) => {
      if (err) {
        console.error('❌ Error getting all files:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch all files'
        });
      }
      
      console.log(`✅ Retrieved ${files.length} files (all files view)`);
      res.json({
        success: true,
        files
      });
    }
  );
});

// Team leader approve/reject file
app.post('/api/files/:fileId/team-leader-review', (req, res) => {
  const { fileId } = req.params;
  const { action, comments, teamLeaderId, teamLeaderUsername, teamLeaderRole, team } = req.body;
  
  console.log(`📋 Team leader ${action} for file ${fileId} by ${teamLeaderUsername}`);
  
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }
  
  // Get current file status
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    if (file.current_stage !== 'pending_team_leader') {
      return res.status(400).json({
        success: false,
        message: 'File is not in pending team leader review stage'
      });
    }
    
    const now = new Date().toISOString();
    let newStatus, newStage;
    
    if (action === 'approve') {
      newStatus = 'team_leader_approved';
      newStage = 'pending_admin';
    } else {
      newStatus = 'rejected_by_team_leader';
      newStage = 'rejected_by_team_leader';
    }
    
    // Update file status
    db.run(`UPDATE files SET 
      status = ?, 
      current_stage = ?, 
      team_leader_id = ?, 
      team_leader_username = ?, 
      team_leader_reviewed_at = ?, 
      team_leader_comments = ?,
      ${action === 'reject' ? 'rejection_reason = ?, rejected_by = ?, rejected_at = ?,' : ''}
      updated_at = ?
    WHERE id = ?`,
    action === 'reject' ? [
      newStatus, newStage, teamLeaderId, teamLeaderUsername, now, comments,
      comments, teamLeaderUsername, now, now, fileId
    ] : [
      newStatus, newStage, teamLeaderId, teamLeaderUsername, now, comments, now, fileId
    ], function(err) {
      if (err) {
        console.error('❌ Error updating file status:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update file status'
        });
      }
      
      // Add comment if provided
      if (comments) {
        db.run(
          'INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)',
          [fileId, teamLeaderId, teamLeaderUsername, teamLeaderRole, comments, action],
          (err) => {
            if (err) {
              console.error('❌ Error adding comment:', err);
            }
          }
        );
      }
      
      // Log activity
      logActivity(
        teamLeaderId, 
        teamLeaderUsername, 
        teamLeaderRole, 
        team, 
        `File ${action}d: ${file.filename} (Team Leader Review)`
      );
      
      // Log status history
      logFileStatusChange(
        fileId, 
        file.status, 
        newStatus, 
        file.current_stage, 
        newStage, 
        teamLeaderId, 
        teamLeaderUsername, 
        teamLeaderRole, 
        `Team leader ${action}: ${comments || 'No comments'}`
      );
      
      console.log(`✅ File ${action}d by team leader: ${file.filename}`);
      
      res.json({
        success: true,
        message: `File ${action}d successfully`,
        file: {
          ...file,
          status: newStatus,
          current_stage: newStage,
          team_leader_reviewed_at: now,
          team_leader_comments: comments
        }
      });
    });
  });
});

// Admin approve/reject file (Final approval)
app.post('/api/files/:fileId/admin-review', (req, res) => {
  const { fileId } = req.params;
  const { action, comments, adminId, adminUsername, adminRole, team } = req.body;
  
  console.log(`📋 Admin ${action} for file ${fileId} by ${adminUsername}`);
  
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }
  
  // Get current file status
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    if (file.current_stage !== 'pending_admin') {
      return res.status(400).json({
        success: false,
        message: 'File is not in pending admin review stage'
      });
    }
    
    const now = new Date().toISOString();
    let newStatus, newStage, publicNetworkUrl = null;
    
    if (action === 'approve') {
      newStatus = 'final_approved';
      newStage = 'published_to_public';
      // Simulate public network URL
      publicNetworkUrl = `https://public-network.example.com/files/${file.filename}`;
    } else {
      newStatus = 'rejected_by_admin';
      newStage = 'rejected_by_admin';
    }
    
    // Update file status
    db.run(`UPDATE files SET 
      status = ?, 
      current_stage = ?, 
      admin_id = ?, 
      admin_username = ?, 
      admin_reviewed_at = ?, 
      admin_comments = ?,
      ${action === 'approve' ? 'public_network_url = ?, final_approved_at = ?,' : ''}
      ${action === 'reject' ? 'rejection_reason = ?, rejected_by = ?, rejected_at = ?,' : ''}
      updated_at = ?
    WHERE id = ?`,
    action === 'approve' ? [
      newStatus, newStage, adminId, adminUsername, now, comments,
      publicNetworkUrl, now, now, fileId
    ] : action === 'reject' ? [
      newStatus, newStage, adminId, adminUsername, now, comments,
      comments, adminUsername, now, now, fileId
    ] : [
      newStatus, newStage, adminId, adminUsername, now, comments, now, fileId
    ], function(err) {
      if (err) {
        console.error('❌ Error updating file status:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update file status'
        });
      }
      
      // Add comment if provided
      if (comments) {
        db.run(
          'INSERT INTO file_comments (file_id, user_id, username, user_role, comment, comment_type) VALUES (?, ?, ?, ?, ?, ?)',
          [fileId, adminId, adminUsername, adminRole, comments, action === 'approve' ? 'final_approval' : 'final_rejection'],
          (err) => {
            if (err) {
              console.error('❌ Error adding comment:', err);
            }
          }
        );
      }
      
      // Log activity
      logActivity(
        adminId, 
        adminUsername, 
        adminRole, 
        team, 
        `File ${action}d: ${file.filename} (Admin Final Review)${action === 'approve' ? ' - Published to Public Network' : ''}`
      );
      
      // Log status history
      logFileStatusChange(
        fileId, 
        file.status, 
        newStatus, 
        file.current_stage, 
        newStage, 
        adminId, 
        adminUsername, 
        adminRole, 
        `Admin ${action}: ${comments || 'No comments'}${action === 'approve' ? ' - Published to Public Network' : ''}`
      );
      
      console.log(`✅ File ${action}d by admin: ${file.filename}${action === 'approve' ? ' - Published to Public Network' : ''}`);
      
      res.json({
        success: true,
        message: `File ${action}d successfully${action === 'approve' ? ' and published to Public Network' : ''}`,
        file: {
          ...file,
          status: newStatus,
          current_stage: newStage,
          admin_reviewed_at: now,
          admin_comments: comments,
          ...(action === 'approve' && { public_network_url: publicNetworkUrl, final_approved_at: now })
        }
      });
    });
  });
});

// Get file comments
app.get('/api/files/:fileId/comments', (req, res) => {
  const { fileId } = req.params;
  
  db.all(
    'SELECT * FROM file_comments WHERE file_id = ? ORDER BY created_at DESC',
    [fileId],
    (err, comments) => {
      if (err) {
        console.error('❌ Error getting file comments:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch comments'
        });
      }
      
      res.json({
        success: true,
        comments
      });
    }
  );
});

// Add comment to file
app.post('/api/files/:fileId/comments', (req, res) => {
  const { fileId } = req.params;
  const { comment, userId, username, userRole } = req.body;
  
  if (!comment || !comment.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Comment cannot be empty'
    });
  }
  
  db.run(
    'INSERT INTO file_comments (file_id, user_id, username, user_role, comment) VALUES (?, ?, ?, ?, ?)',
    [fileId, userId, username, userRole, comment.trim()],
    function(err) {
      if (err) {
        console.error('❌ Error adding comment:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to add comment'
        });
      }
      
      res.json({
        success: true,
        message: 'Comment added successfully',
        comment: {
          id: this.lastID,
          file_id: fileId,
          user_id: userId,
          username: username,
          user_role: userRole,
          comment: comment.trim(),
          created_at: new Date()
        }
      });
    }
  );
});

// Get file status history
app.get('/api/files/:fileId/history', (req, res) => {
  const { fileId } = req.params;
  
  db.all(
    'SELECT * FROM file_status_history WHERE file_id = ? ORDER BY created_at DESC',
    [fileId],
    (err, history) => {
      if (err) {
        console.error('❌ Error getting file history:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch file history'
        });
      }
      
      res.json({
        success: true,
        history
      });
    }
  );
});

// Delete file (Admin only)
app.delete('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { adminId, adminUsername, adminRole, team } = req.body;
  
  console.log(`🗑️ Deleting file ${fileId} by admin ${adminUsername}`);
  
  // Get file info first
  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete file from filesystem
    const filePath = path.join(uploadsDir, path.basename(file.file_path));
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('❌ Error deleting physical file:', unlinkErr);
      } else {
        console.log('✅ Physical file deleted:', filePath);
      }
    });
    
    // Delete file record from database
    db.run('DELETE FROM files WHERE id = ?', [fileId], function(err) {
      if (err) {
        console.error('❌ Error deleting file from database:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete file'
        });
      }
      
      // Log activity
      logActivity(
        adminId, 
        adminUsername, 
        adminRole, 
        team, 
        `File deleted: ${file.filename} (Admin Action)`
      );
      
      console.log(`✅ File deleted: ${file.filename}`);
      
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    });
  });
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Express server running on http://localhost:${PORT}`);
      console.log(`🌐 Network Database: ${dbPath}`);
      console.log(`🌐 Network Uploads: ${uploadsDir}`);
      console.log(`🔗 Network Data Path: ${networkDataPath}`);
      console.log(`\n🔄 File Approval Workflow:`);
      console.log(`   1. User uploads file → Pending Team Leader Review`);
      console.log(`   2. Team Leader approves → Pending Admin Review`);
      console.log(`   3. Admin approves → Published to Public Network`);
      console.log(`   ❌ Any stage can reject → Back to User with comments\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Server shutting down...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

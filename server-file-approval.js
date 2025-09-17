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

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
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
                
                // Now handle user table migration
                handleUserTableMigration(resolve, reject);
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
        team: 'Development' 
      },
      { 
        fullName: 'Sarah Team Leader', 
        username: 'sarah.leader', 
        email: 'teamleader@example.com', 
        password: 'password123', 
        role: 'TEAM LEADER', 
        team: 'Management' 
      },
      { 
        fullName: 'Admin Administrator', 
        username: 'admin', 
        email: 'admin@example.com', 
        password: 'password123', 
        role: 'ADMIN', 
        team: 'IT Administration' 
      },
      { 
        fullName: 'Test User', 
        username: 'test.user', 
        email: 'test@example.com', 
        password: 'password123', 
        role: 'USER', 
        team: 'QA Testing' 
      }
    ];
    
    let completed = 0;
    const total = testUsers.length;
    
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
            console.log('\\n👤 Available test accounts:');
            console.log('  USER: user@example.com / password123 (John User)');
            console.log('  TEAM LEADER: teamleader@example.com / password123 (Sarah Team Leader)');
            console.log('  ADMIN: admin@example.com / password123 (Admin Administrator)');
            console.log('  Legacy USER: test@example.com / password123 (Test User)\\n');
            
            // Add sample files and activity logs
            seedSampleData(resolve, reject);
          }
        }
      );
    });
  });
}

// Seed sample files and activity logs
function seedSampleData(resolve, reject) {
  // Add some sample activity logs
  const sampleActivities = [
    { username: 'admin', role: 'ADMIN', team: 'IT Administration', activity: 'System initialized and test users created' },
    { username: 'john.user', role: 'USER', team: 'Development', activity: 'User account created by administrator' },
    { username: 'sarah.leader', role: 'TEAM LEADER', team: 'Management', activity: 'User account created by administrator' },
    { username: 'test.user', role: 'USER', team: 'QA Testing', activity: 'User account created by administrator' }
  ];
  
  sampleActivities.forEach((activity, index) => {
    setTimeout(() => {
      logActivity(null, activity.username, activity.role, activity.team, activity.activity);
    }, index * 100);
  });
  
  // Add sample files for testing
  const sampleFiles = [
    {
      filename: 'project_proposal_2025.pdf',
      original_name: 'project_proposal_2025.pdf',
      file_path: '/sample/project_proposal_2025.pdf',
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
      file_path: '/sample/budget_analysis_q4.xlsx',
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
      file_path: '/sample/design_mockups_mobile.zip',
      file_size: 15728640, // 15 MB
      file_type: 'ZIP Archive',
      mime_type: 'application/zip',
      description: 'Mobile app UI/UX design mockups for the new user interface',
      user_id: 1,
      username: 'john.user',
      user_team: 'Development',
      status: 'rejected_by_team_leader',
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
      file_path: '/sample/test_results_automation.pdf',
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
  
  let fileCompleted = 0;
  sampleFiles.forEach(file => {
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
        console.log(`✅ Sample file created: ${file.filename} (Status: ${file.status})`);
      }
      
      fileCompleted++;
      if (fileCompleted === sampleFiles.length) {
        console.log('\\n📁 File approval system initialized with sample data');
        resolve();
      }
    });
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

// FILE APPROVAL SYSTEM ENDPOINTS

// Upload file (User only)
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    const { description, userId, username, userTeam } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    console.log(`📁 File upload by ${username} from ${userTeam} team:`, req.file.filename);
    
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
    
    // Insert file record into database
    db.run(`INSERT INTO files (
      filename, original_name, file_path, file_size, file_type, mime_type, description,
      user_id, username, user_team, status, current_stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.file.filename,
      req.file.originalname,
      `/uploads/${req.file.filename}`,
      req.file.size,
      getFileTypeDescription(req.file.mimetype),
      req.file.mimetype,
      description || '',
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
      logActivity(userId, username, 'USER', userTeam, `File uploaded: ${req.file.originalname}`);
      
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
        'File uploaded by user'
      );
      
      console.log(`✅ File uploaded successfully with ID: ${fileId}`);
      
      res.json({
        success: true,
        message: 'File uploaded successfully',
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
        }
      });
    });
    
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
      console.log(`📁 Database file: ${dbPath}`);
      console.log(`📂 Uploads directory: ${uploadsDir}`);
      console.log(`\\n🔄 File Approval Workflow:`);
      console.log(`   1. User uploads file → Pending Team Leader Review`);
      console.log(`   2. Team Leader approves → Pending Admin Review`);
      console.log(`   3. Admin approves → Published to Public Network`);
      console.log(`   ❌ Any stage can reject → Back to User with comments\\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Add multer dependency to package.json if not present
const packageJsonPath = path.join(__dirname, 'package.json');
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.dependencies.multer) {
    console.log('⚠️  Warning: multer dependency not found in package.json');
    console.log('   Please run: npm install multer');
    console.log('   Or add "multer": "^1.4.5-lts.1" to dependencies in package.json\\n');
  }
} catch (error) {
  console.error('Error checking package.json:', error.message);
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n⏹️  Server shutting down...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

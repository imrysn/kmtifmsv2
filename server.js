const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

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

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'file://'], // Allow Vite dev server and Electron
  credentials: true
}));
app.use(express.json());

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
        });
      });
    });
  });
}

// Seed test users
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
            console.log('\n👤 Available test accounts:');
            console.log('  USER: user@example.com / password123 (John User)');
            console.log('  TEAM LEADER: teamleader@example.com / password123 (Sarah Team Leader)');
            console.log('  ADMIN: admin@example.com / password123 (Admin Administrator)');
            console.log('  Legacy USER: test@example.com / password123 (Test User)\n');
            
            // Add some sample activity logs
            const sampleActivities = [
              { username: 'admin', role: 'ADMIN', team: 'IT Administration', activity: 'System initialized and test users created' },
              { username: 'john.user', role: 'USER', team: 'Development', activity: 'User account created by administrator' },
              { username: 'sarah.leader', role: 'TEAM LEADER', team: 'Management', activity: 'User account created by administrator' },
              { username: 'test.user', role: 'USER', team: 'QA Testing', activity: 'User account created by administrator' },
              { username: 'admin', role: 'ADMIN', team: 'IT Administration', activity: 'User logged in via admin portal' }
            ];
            
            sampleActivities.forEach((activity, index) => {
              setTimeout(() => {
                logActivity(null, activity.username, activity.role, activity.team, activity.activity);
              }, index * 100); // Stagger the logs slightly
            });
            
            resolve();
          }
        }
      );
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

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Express server running on http://localhost:${PORT}`);
      console.log(`📁 Database file: ${dbPath}`);
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

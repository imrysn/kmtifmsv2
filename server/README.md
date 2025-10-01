# Server Directory Structure

This directory contains all backend-related code for the KMTIFMS2 application, organized into modular components for better maintainability and scalability.

## 📁 Directory Structure

```
server/
├── config/              # Configuration modules
│   ├── database.js     # Database connection and path configuration
│   └── middleware.js   # Express middleware setup (CORS, body-parser, etc.)
│
├── db/                  # Database operations
│   └── initialize.js   # Database schema initialization and setup
│
├── routes/              # API route handlers
│   ├── activityLogs.js # Activity logging endpoints
│   ├── auth.js         # Authentication endpoints (login, logout)
│   ├── files.js        # File management endpoints (upload, approve, reject)
│   ├── fileSystem.js   # File system browsing endpoints
│   ├── teams.js        # Team management endpoints
│   └── users.js        # User management endpoints
│
├── utils/               # Utility functions
│   ├── cache.js        # In-memory caching for performance
│   ├── fileHelpers.js  # File operation helpers
│   └── logger.js       # Activity logging utilities
│
├── scripts/             # Utility scripts organized by category
│   ├── database/       # Database maintenance scripts
│   │   ├── check-db-tables.js              # Verify database schema
│   │   ├── reset-db.js                     # Reset database (with confirmation)
│   │   ├── reset-db-force.js               # Force reset database (no confirmation)
│   │   ├── reset-file-approval-db.js       # Reset file approval tables
│   │   └── update-database-file-system.js  # Update file system paths
│   │
│   ├── network/        # Network configuration scripts
│   │   ├── create-local-test-directory.js  # Create local test environment
│   │   ├── network-config-manager.js       # Manage network configuration
│   │   ├── restore-network-mode.js         # Restore network mode
│   │   ├── switch-to-local-test.js         # Switch to local test mode
│   │   └── verify-network-connection.js    # Verify network connectivity
│   │
│   └── testing/        # Testing and debugging scripts
│       ├── debug-file-management.js        # Debug file management issues
│       ├── test-delete-endpoint.js         # Test delete functionality
│       ├── test-file-management-api.js     # Test file management API
│       ├── test-team-delete.js             # Test team deletion
│       └── test-teams-api.js               # Test teams API
│
├── index.js            # Main server entry point
└── README.md           # This file
```

## 🚀 Entry Point

The main server entry point is `index.js`, which:
- Imports and configures Express
- Sets up middleware
- Registers all route handlers
- Initializes the database
- Starts the HTTP server on port 3001

The root-level `server.js` file simply imports and runs this modular server.

## 📝 NPM Scripts

All scripts have been updated to reflect the new directory structure:

### Database Scripts
```bash
npm run reset:db                    # Reset database (with confirmation)
npm run reset:db:force             # Force reset database
npm run reset:db:file-approval     # Reset file approval tables
npm run update:db:file-system      # Update file system paths
npm run check:db                   # Check database tables
```

### Network Scripts
```bash
npm run network:status             # Check network configuration status
npm run network:test               # Test network connectivity
npm run network:backup             # Backup local database
npm run network:verify             # Verify network connection
npm run network:switch-local       # Switch to local test mode
npm run network:restore            # Restore network mode
npm run network:create-test-dir    # Create local test directory
```

### Testing Scripts
```bash
npm run test:team-delete           # Test team deletion
npm run test:teams-api             # Test teams API
npm run test:delete-endpoint       # Test delete endpoint
npm run test:file-management       # Test file management API
npm run debug:file-management      # Debug file management
```

### Server Operation
```bash
npm run server:standalone          # Run server without Electron
npm run dev                        # Run full development environment
```

## 🔌 API Endpoints

The server exposes the following API routes:

- **Authentication**: `/api/auth/*`
  - POST `/login` - User login
  - POST `/logout` - User logout

- **Users**: `/api/users/*`
  - GET `/` - List all users
  - POST `/` - Create new user
  - PUT `/:id` - Update user
  - DELETE `/:id` - Delete user

- **Teams**: `/api/teams/*`
  - GET `/` - List all teams
  - POST `/` - Create new team
  - PUT `/:id` - Update team
  - DELETE `/:id` - Delete team

- **File System**: `/api/file-system/*`
  - GET `/browse` - Browse directory contents
  - GET `/project-info` - Get project information

- **Files**: `/api/files/*`
  - POST `/upload` - Upload file
  - GET `/pending` - Get pending files (by role)
  - PUT `/:id/approve` - Approve file
  - PUT `/:id/reject` - Reject file
  - DELETE `/:id` - Delete file

- **Activity Logs**: `/api/activity-logs/*`
  - GET `/` - Get activity logs
  - GET `/stats` - Get activity statistics

## 🗄️ Database

The application uses SQLite with the following features:
- **WAL Mode**: Write-Ahead Logging for better concurrency
- **In-Memory Caching**: Frequently accessed data is cached
- **Network/Local Support**: Can operate on network paths or locally

### Network Mode
- Database: `\\KMTI-NAS\Shared\data\filemanagement.db`
- Projects: `\\KMTI-NAS\Shared\Public\PROJECTS`

### Local Test Mode
- Database: `./local-test/data/filemanagement.db`
- Projects: `./local-test/PROJECTS`

## 🔄 File Approval Workflow

The system implements a two-tier approval process:

1. **User Upload** → Status: `pending_team_leader_review`
2. **Team Leader Review** → Status: `pending_admin_review`
3. **Admin Approval** → Status: `published`

Any step can result in rejection, returning the file to the user with comments.

## 🛠️ Development

### Adding New Routes
1. Create route file in `server/routes/`
2. Import and register in `server/index.js`
3. Follow existing patterns for consistency

### Adding Utility Scripts
1. Determine category (database/network/testing)
2. Place in appropriate `server/scripts/` subdirectory
3. Add npm script in `package.json` for easy access

### Configuration Changes
- Database paths: `server/config/database.js`
- Middleware setup: `server/config/middleware.js`

## 📊 Performance Optimizations

Recent optimizations include:
- SQLite WAL mode for better concurrency
- In-memory caching for frequently accessed data
- Connection pooling and prepared statements
- Lazy loading of large datasets

## 🔐 Security

- Passwords hashed with bcryptjs
- Role-based access control (USER, TEAM_LEADER, ADMIN)
- SQL injection prevention via parameterized queries
- CORS configuration for controlled API access

## 📚 Further Reading

- Express.js Documentation: https://expressjs.com/
- SQLite Documentation: https://www.sqlite.org/docs.html
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

# Electron React Desktop Application

A desktop application built with React (Vite), Electron, Express, and SQLite featuring secure user authentication.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express (runs inside Electron main process)
- **Framework**: Electron
- **Database**: SQLite (local file)
- **Authentication**: bcryptjs for password hashing
- **Routing**: React Router DOM

## Features

- ✅ **Role-Based Authentication System** with USER, TEAM LEADER, and ADMIN roles
- ✅ **Dual Login Portals** with toggle between User Login and Admin Login
- ✅ **Access Control** preventing unauthorized portal access
- ✅ **Multiple Dashboard Types** tailored for each role and access method
- ✅ Secure login system with bcrypt password hashing
- ✅ SQLite database with automatic initialization
- ✅ Electron desktop application
- ✅ React frontend with Vite hot reload
- ✅ Express API server running in Electron main process
- ✅ Client-side validation and error handling
- ✅ Responsive design

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

## Setup Instructions

1. **Clone/Download the project**
   ```bash
   # If you have the project files, navigate to the project directory
   cd electron-react-app
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (Electron, Express, etc.)
   npm install
   
   # Install client dependencies (React, Vite, etc.)
   cd client && npm install && cd ..
   ```

## Quick Start

### Setup
1. **Install dependencies**:
   ```bash
   # Run setup script
   ./setup.sh   # Linux/macOS
   setup.bat    # Windows
   
   # Or manual install
   npm install && cd client && npm install && cd ..
   ```

2. **Reset database** (recommended for clean start):
   ```bash
   npm run reset:db
   ```

3. **Start development**:
   ```bash
   npm run dev
   ```

### Admin Panel Access

**🚨 IMPORTANT**: The admin panel features a complete user management system!

1. **Switch to Admin Login** (👨‍💼 Admin Login tab)
2. **Use Admin Credentials**: `admin@example.com` / `password123`
3. **Explore Admin Features**:
   - **📊 Dashboard**: User statistics and overview
   - **👥 User Management**: Full CRUD operations for users
     - Search users by any field
     - Add new users with complete forms
     - Edit existing user information
     - Reset user passwords
     - Delete users with confirmation

## Role-Based Authentication System

The application features a comprehensive role-based authentication system with three user roles:

### User Roles & Access

1. **USER Role**
   - ✅ Can login via **User Portal** only
   - ❌ Cannot access Admin Portal (receives friendly error message)
   - ➡️ Accesses: User Dashboard

2. **TEAM LEADER Role**
   - ✅ Can login via **User Portal** → User Dashboard
   - ✅ Can login via **Admin Portal** → Team Leader Panel
   - ➡️ Dual access for different responsibilities

3. **ADMIN Role**
   - ❌ Cannot access User Portal (receives friendly error message)
   - ✅ Can login via **Admin Portal** only → Admin Panel
   - ➡️ Full administrative access

### Login Portal Toggle

The login page features a toggle button to switch between:
- **👤 User Login**: For USER and TEAM LEADER roles
- **👨‍💼 Admin Login**: For TEAM LEADER and ADMIN roles

## Test Credentials

The application comes with pre-seeded test users for all roles:

### User Portal Access
- **USER**: `user@example.com` / `password123`
- **TEAM LEADER**: `teamleader@example.com` / `password123`
- **Legacy USER**: `test@example.com` / `password123`

### Admin Portal Access
- **TEAM LEADER**: `teamleader@example.com` / `password123` → Team Leader Panel
- **ADMIN**: `admin@example.com` / `password123` → Admin Panel

### Access Control Testing

Try these scenarios to see the access control in action:
- Login as `user@example.com` in Admin Portal → Access denied
- Login as `admin@example.com` in User Portal → Access denied
- Login as `teamleader@example.com` in both portals → Different dashboards

## Project Structure

```
electron-react-app/
├── main.js                 # Electron main process
├── server.js              # Express API server
├── package.json           # Root package.json
├── database.sqlite        # SQLite database (auto-created)
├── client/                # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Login.css
│   │   │   ├── Dashboard.jsx
│   │   │   └── Dashboard.css
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

### Authentication

- **POST** `/api/auth/login`
  - Body: 
    ```json
    {
      "email": "string",
      "password": "string",
      "loginType": "user" | "admin"  // defaults to "user"
    }
    ```
  - Success: 
    ```json
    {
      "success": true,
      "user": {
        "id": 1,
        "email": "user@example.com",
        "role": "USER",
        "panelType": "user",
        "created_at": "2024-01-01T00:00:00.000Z"
      },
      "message": "Login successful"
    }
    ```
  - Error: 
    ```json
    {
      "success": false,
      "message": "Error message (e.g., access denied, invalid credentials)"
    }
    ```

### Health Check

- **GET** `/api/health`
  - Response: `{ "status": "OK", "message": "Server is running" }`

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  team TEXT DEFAULT 'General',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Supported Roles
- `USER`: Standard user access
- `TEAM LEADER`: Dual access to user and team management features
- `ADMIN`: Full administrative access with user management capabilities

### Pre-Seeded Test Users

| Full Name | Username | Email | Role | Team |
|-----------|----------|--------|------|------|
| John User | john.user | user@example.com | USER | Development |
| Sarah Team Leader | sarah.leader | teamleader@example.com | TEAM LEADER | Management |
| Admin Administrator | admin | admin@example.com | ADMIN | IT Administration |
| Test User | test.user | test@example.com | USER | QA Testing |

All users have the password: `password123`

## Security Features

- **Electron Security**: 
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `enableRemoteModule: false`
- **Password Hashing**: bcryptjs with salt rounds
- **Input Validation**: Client-side and server-side validation
- **CORS Protection**: Configured for development origins

## Building for Production

### Build React App

```bash
npm run client:build
```

### Package Electron App

```bash
npm run build
```

This will create distributable packages in the `dist/` directory for your platform.

### Platform-specific builds

The `electron-builder` configuration in `package.json` supports:
- **Windows**: NSIS installer
- **macOS**: DMG file
- **Linux**: AppImage

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start full development environment
npm run client:dev       # Start only React dev server
npm run electron:dev     # Start only Electron (requires React dev server)

# Database Management
npm run reset:db         # Delete and recreate database with fresh test users

# Testing
npm run test:api         # Test API endpoints with role-based scenarios
npm run server:standalone # Run Express server standalone

# Building
npm run client:build     # Build React app for production
npm run build           # Build complete application
npm run electron:pack   # Package Electron app
```

### Development Process

1. **Initial Setup**:
   ```bash
   npm install && cd client && npm install && cd ..
   npm run reset:db  # Creates fresh database with test users
   ```

2. **Daily Development**:
   ```bash
   npm run dev  # Starts everything you need
   ```

3. **Database Changes**:
   - If you modify the database schema, run `npm run reset:db`
   - This will recreate the database with the new schema and test users

4. **Testing API Changes**:
   ```bash
   npm run test:api  # Test all endpoints and role-based access control
   ```

### Admin Panel Development

The admin panel (`AdminDashboard.jsx`) includes:
- **Sidebar Navigation**: Dashboard and User Management tabs
- **User Management**: Full CRUD operations with modals
- **Search Functionality**: Real-time user search
- **Responsive Design**: Works on desktop and mobile
- **Professional UI**: Modern design with animations

### Key Development Notes

1. The React app will hot reload for component changes
2. Electron main process changes require restart
3. Database changes persist in `database.sqlite`
4. All passwords are automatically hashed with bcrypt
5. API endpoints include comprehensive error handling

## Troubleshooting

### Login Form Not Working / Window Not Opening

If the login form refreshes instead of navigating to dashboard or the Electron window doesn't open:

1. **Check if all services are running**:
   ```bash
   # Test the API server
   npm run test:api
   
   # Run server standalone to see logs
   npm run server:standalone
   ```

2. **Check browser console** (when Electron window opens):
   - Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)
   - Look for error messages in Console tab
   - Check Network tab for failed API calls

3. **Verify test credentials**:
   - Email: `test@example.com`
   - Password: `password123`

4. **Manual step-by-step startup** (if concurrent startup fails):
   ```bash
   # Terminal 1: Start React dev server
   cd client && npm run dev
   
   # Terminal 2: Start Electron (wait for React to be ready)
   npm run electron:dev
   ```

### Port Conflicts

If ports 3001 or 5173 are already in use:

1. **For API Server (3001)**: Update `PORT` in `server.js`
2. **For Vite Dev Server (5173)**: Update port in `client/vite.config.js`

### Database Issues

If you encounter database issues:

```bash
# Delete the database file to reset
rm database.sqlite

# Restart the application to recreate the database
npm run dev
```

### Electron Build Issues

If you encounter native module compilation issues:

```bash
# Clear node_modules and reinstall
rm -rf node_modules client/node_modules
npm install
cd client && npm install
```

### Debugging Steps

1. **Check logs**: The console will show detailed logs for each step
2. **Verify API**: Use `npm run test:api` to test the login endpoint
3. **Check file permissions**: Ensure the app can create `database.sqlite`
4. **Restart completely**: Close all terminals and restart with `npm run dev`

## Adding New Features

### Adding New API Routes

1. Add routes in `server.js`
2. Follow the existing pattern for error handling
3. Update this README with new endpoints

### Adding New React Components

1. Create components in `client/src/components/`
2. Add corresponding CSS files
3. Update routing in `App.jsx` if needed

### Database Migrations

For schema changes:
1. Update the table creation SQL in `server.js`
2. Handle existing data appropriately
3. Consider versioning your database schema

## Notes

- The Express server runs inside the Electron main process
- Database file is created in the root directory
- User sessions are stored in localStorage
- Hot reload works for React components but not for Electron main process
- CORS is configured to allow the Vite dev server origin

## License

This project is for demonstration purposes.

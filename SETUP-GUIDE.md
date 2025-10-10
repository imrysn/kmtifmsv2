# 🚀 KMTIFMS2 - Complete Setup & Deployment Guide

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Detailed Setup](#detailed-setup)
3. [Database Configuration](#database-configuration)
4. [Testing](#testing)
5. [Network Deployment](#network-deployment)
6. [Troubleshooting](#troubleshooting)
7. [NPM Commands Reference](#npm-commands-reference)

---

## 🎯 Quick Start

### For Development (Local Testing)

```bash
# 1. Install dependencies
npm install

# 2. Run health check
npm run health

# 3. Configure database (interactive)
npm run db:switch
# Choose option 2 for SQLite (development)

# 4. Start the server
npm run server:standalone

# 5. Or run full app with Electron
npm run dev
```

### For Production (Network Deployment)

```bash
# 1. Install dependencies
npm install

# 2. Run health check
npm run health

# 3. Configure MySQL
npm run db:switch
# Choose option 1 for MySQL
# Enter: KMTI-NAS, 3306, kmtifms, kmtifms_user, [password]

# 4. Initialize MySQL database
npm run db:init

# 5. Test connection
npm run db:test

# 6. Migrate from SQLite (if applicable)
npm run db:migrate

# 7. Start the server
npm run server:standalone
```

---

## 🔧 Detailed Setup

### Step 1: System Requirements

**Required:**
- Node.js 14+ (Check: `node --version`)
- npm 6+ (Check: `npm --version`)

**For MySQL (Production):**
- MySQL Server 8.0+ installed on KMTI-NAS or dedicated server
- Network access to MySQL server (port 3306)

**For SQLite (Development):**
- No additional requirements (uses bundled sqlite3)

### Step 2: Install Dependencies

```bash
# Navigate to project directory
cd D:\RAYSAN\kmtifmsv2\kmtifmsv2

# Install all dependencies
npm install

# This installs:
# - mysql2 (MySQL driver)
# - sqlite3 (SQLite driver)
# - express (web server)
# - bcryptjs (password hashing)
# - multer (file uploads)
# - And more...
```

### Step 3: Run System Health Check

```bash
npm run health
```

This will check:
- ✅ Node.js version
- ✅ Required packages installed
- ✅ Directory structure
- ✅ Critical files present
- ✅ Database connectivity
- ✅ Network access

**Expected Output:**
```
🏥 KMTIFMS2 System Health Check
============================================================
📋 Environment Check
✅ Node.js v18.17.0 (>=14 required)
✅ mysql2 package installed
✅ sqlite3 package installed
...
📊 Health Check Summary
✅ Passed: 15
⚠️  Warnings: 2
❌ Failed: 0
✨ System health check passed! Ready to deploy.
```

---

## 🗄️ Database Configuration

### Option 1: MySQL (Recommended for Production)

#### A. Install MySQL on KMTI-NAS

1. **Download MySQL**
   - Visit: https://dev.mysql.com/downloads/installer/
   - Download MySQL Installer for Windows
   - Version: 8.0 or higher

2. **Install MySQL**
   - Run installer
   - Choose "Server only" or "Developer Default"
   - Set root password (remember this!)
   - Use default port: 3306

3. **Configure Windows Firewall**
   ```powershell
   # Open PowerShell as Administrator
   New-NetFirewallRule -DisplayName "MySQL" -Direction Inbound -Protocol TCP -LocalPort 3306 -Action Allow
   ```

4. **Verify MySQL is Running**
   ```cmd
   # Check service status
   sc query MySQL80
   
   # Expected: STATE : 4 RUNNING
   ```

#### B. Create Database and User

```bash
# Connect to MySQL as root
mysql -u root -p
# Enter root password
```

```sql
-- Create database
CREATE DATABASE kmtifms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (CHANGE PASSWORD!)
CREATE USER 'kmtifms_user'@'%' IDENTIFIED BY 'YourSecurePassword123!';

-- Grant permissions
GRANT ALL PRIVILEGES ON kmtifms.* TO 'kmtifms_user'@'%';
FLUSH PRIVILEGES;

-- Verify
SELECT user, host FROM mysql.user WHERE user = 'kmtifms_user';

-- Exit
EXIT;
```

#### C. Configure Application

**Option 1: Interactive (Recommended)**
```bash
npm run db:switch
# Choose option 1 (MySQL)
# Enter connection details
```

**Option 2: Manual**
```bash
# Copy example file
copy .env.example .env

# Edit .env file
notepad .env
```

Update with your values:
```env
USE_MYSQL=true
DB_HOST=KMTI-NAS
DB_PORT=3306
DB_NAME=kmtifms
DB_USER=kmtifms_user
DB_PASSWORD=YourSecurePassword123!
NODE_ENV=production
```

#### D. Initialize Database

```bash
# Test connection first
npm run db:test

# Initialize schema (creates tables, indexes, procedures)
npm run db:init

# Verify
npm run db:test
```

**Expected Output:**
```
✅ MySQL connection successful
MySQL Version: 8.0.35
Current Database: kmtifms
Tables Found: 6

📊 Database Tables:
   ✓ users
   ✓ teams
   ✓ files
   ✓ file_comments
   ✓ file_status_history
   ✓ activity_logs
```

#### E. Migrate Data (if from SQLite)

```bash
npm run db:migrate
```

This will:
- Read all data from SQLite
- Transfer to MySQL
- Preserve all relationships
- Show migration statistics

### Option 2: SQLite (Development Only)

```bash
# Configure for SQLite
npm run db:switch
# Choose option 2

# Start server (database created automatically)
npm run server:standalone
```

**⚠️ Warning**: SQLite is NOT recommended for production with multiple users!

---

## 🧪 Testing

### Test Database Connection

```bash
npm run db:test
```

### Test Server

```bash
# Start server
npm run server:standalone

# In browser, visit:
http://localhost:3001
```

### Test from Multiple PCs

1. **PC 1**: Start application
   ```bash
   npm run dev
   ```

2. **PC 2**: Start application simultaneously
   ```bash
   npm run dev
   ```

3. **Test Operations**:
   - Login on both PCs
   - Upload files on PC 1
   - View files on PC 2
   - Approve/reject files
   - Verify no errors or corruption

### Run Health Check

```bash
npm run health
```

---

## 🌐 Network Deployment

### Pre-Deployment Checklist

- [ ] MySQL installed on KMTI-NAS
- [ ] Database and user created
- [ ] Firewall configured (port 3306)
- [ ] Application tested locally
- [ ] All health checks passing
- [ ] Data migrated (if applicable)
- [ ] Backup created

### Deploy to Network

#### Step 1: Copy Database Configuration

```bash
# Copy database folder to network
xcopy /E /I database \\KMTI-NAS\Shared\data\database
```

#### Step 2: Update Application on All PCs

1. **Copy updated application** to each PC
2. **Install dependencies** on each PC:
   ```bash
   npm install
   ```
3. **Configure .env** on each PC:
   ```bash
   npm run db:switch
   # Choose MySQL, enter KMTI-NAS details
   ```

#### Step 3: Test Each PC

```bash
# On each PC:
npm run health
npm run db:test
npm run server:standalone
```

#### Step 4: Deploy to All Users

1. Notify users of upgrade
2. Schedule during off-hours if possible
3. Have rollback plan ready (SQLite backup)
4. Monitor for 24-48 hours

### Post-Deployment

#### Monitor System

```bash
# Check database connection
npm run db:test

# Check system health
npm run health

# Monitor server logs
npm run server:standalone
```

#### Setup Backup Schedule

**Windows Task Scheduler**:
1. Open Task Scheduler
2. Create Basic Task
3. Name: "KMTIFMS2 MySQL Backup"
4. Trigger: Daily at 2:00 AM
5. Action: Start Program
   - Program: `node`
   - Arguments: `database/backup-mysql.js`
   - Start in: `D:\RAYSAN\kmtifmsv2\kmtifmsv2`
6. Save and test

**Or create a batch file**:
```batch
@echo off
cd D:\RAYSAN\kmtifmsv2\kmtifmsv2
node database/backup-mysql.js
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Cannot Connect to MySQL

**Error**: `ECONNREFUSED` or `Connection failed`

**Solutions**:
```bash
# Check MySQL is running
sc query MySQL80

# Test network connectivity
ping KMTI-NAS
telnet KMTI-NAS 3306

# Verify firewall
netsh advfirewall firewall show rule name=MySQL

# Check credentials
npm run db:test
```

#### 2. Access Denied

**Error**: `Access denied for user 'kmtifms_user'@'hostname'`

**Solutions**:
```sql
-- Reconnect to MySQL as root
mysql -u root -p

-- Check user
SELECT user, host FROM mysql.user WHERE user = 'kmtifms_user';

-- Recreate if needed
DROP USER 'kmtifms_user'@'%';
CREATE USER 'kmtifms_user'@'%' IDENTIFIED BY 'YourPassword';
GRANT ALL PRIVILEGES ON kmtifms.* TO 'kmtifms_user'@'%';
FLUSH PRIVILEGES;
```

#### 3. Missing Tables

**Error**: `Table doesn't exist`

**Solution**:
```bash
npm run db:init
```

#### 4. Migration Fails

**Error**: Various migration errors

**Solutions**:
```bash
# Check SQLite path
# Edit database/migrate-from-sqlite.js
# Update SQLITE_DB_PATH

# Re-run migration
npm run db:migrate
```

#### 5. Server Won't Start

**Error**: Various startup errors

**Solutions**:
```bash
# Run full health check
npm run health

# Check logs for specific errors
npm run server:standalone

# Verify .env configuration
type .env
```

### Get Detailed Diagnostics

```bash
# Full system health check
npm run health

# Database connection test
npm run db:test

# Network verification
npm run network:verify
```

---

## 📋 NPM Commands Reference

### Database Commands

```bash
npm run db:init          # Initialize MySQL database
npm run db:test          # Test MySQL connection
npm run db:migrate       # Migrate from SQLite to MySQL
npm run db:backup        # Backup MySQL database
npm run db:switch        # Switch between MySQL/SQLite
```

### Server Commands

```bash
npm run server:standalone    # Start server only
npm run dev                  # Start full app (server + Electron + client)
npm run client:dev           # Start React dev server
npm run electron:dev         # Start Electron
```

### System Commands

```bash
npm run health              # Run system health check
npm run build               # Build for production
```

### Network Commands

```bash
npm run network:verify          # Verify network connection
npm run network:status          # Check network configuration
npm run network:switch-local    # Switch to local mode
npm run network:restore         # Restore network mode
```

### Testing Commands

```bash
npm run test:file-management    # Test file management API
npm run test:teams-api          # Test teams API
npm run debug:file-management   # Debug file management
```

### Database Maintenance

```bash
npm run reset:db                # Reset database (with confirmation)
npm run reset:db:force          # Force reset database
npm run check:db                # Check database tables
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client PCs (Multiple)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PC 1        │  │  PC 2        │  │  PC 3        │     │
│  │  Electron    │  │  Electron    │  │  Electron    │     │
│  │  + React     │  │  + React     │  │  + React     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                   TCP/IP (HTTP/3001)
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                    KMTI-NAS Server                           │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────┐         │
│  │           Express Server (Node.js)             │         │
│  │  • Authentication API                          │         │
│  │  • File Management API                         │         │
│  │  • User Management API                         │         │
│  │  • Activity Logging                            │         │
│  └────────────────────────┬───────────────────────┘         │
│                           │                                  │
│                  MySQL Protocol (3306)                       │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────┐         │
│  │            MySQL Database Server                │         │
│  │  • Users & Authentication                       │         │
│  │  • Files & Approvals                            │         │
│  │  • Teams & Roles                                │         │
│  │  • Activity Logs                                │         │
│  │  • Connection Pooling (10 connections)          │         │
│  └─────────────────────────────────────────────────┘         │
│                                                              │
│  ┌───────────────────────────────────────────────┐          │
│  │        File Storage (Network Share)            │          │
│  │  \\KMTI-NAS\Shared\Public\PROJECTS            │          │
│  │  • Pending files (team leader review)          │          │
│  │  • Approved files (admin review)               │          │
│  │  • Published files (public access)             │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features Summary

### Multi-User Support
- ✅ 10+ concurrent users
- ✅ No database corruption
- ✅ ACID compliant transactions
- ✅ Connection pooling

### File Approval Workflow
- ✅ User uploads → Team Leader reviews → Admin approves
- ✅ Comments at each stage
- ✅ Rejection with feedback
- ✅ Complete audit trail

### Security
- ✅ Password hashing (bcrypt)
- ✅ Role-based access (USER, TEAM_LEADER, ADMIN)
- ✅ SQL injection prevention
- ✅ Session management

### Performance
- ✅ Database indexes
- ✅ Connection pooling
- ✅ Query optimization
- ✅ Caching layer

### Monitoring
- ✅ Activity logging
- ✅ System health checks
- ✅ Database diagnostics
- ✅ Error tracking

---

## 📞 Support & Resources

### Documentation
- **Main README**: `README.md`
- **MySQL Migration**: `MYSQL-MIGRATION-GUIDE.md`
- **Database Docs**: `database/README.md`
- **Server Docs**: `server/README.md`
- **Quick Reference**: `DATABASE-QUICK-REFERENCE.md`

### Health Checks
```bash
npm run health          # Full system check
npm run db:test         # Database check
npm run network:verify  # Network check
```

### Community
- Project Repository: [Link to repo]
- Issue Tracker: [Link to issues]
- Documentation: [Link to docs]

---

## 🎯 Success Criteria

System is ready when:
- ✅ Health check passes
- ✅ Database connection works
- ✅ Multiple PCs can connect
- ✅ File operations work
- ✅ No corruption errors
- ✅ Activity logs recording
- ✅ Backups functioning

---

**Version**: 2.0.0  
**Last Updated**: January 2025  
**Status**: Production Ready  

🎉 **Congratulations! Your KMTIFMS2 system is ready for deployment!**

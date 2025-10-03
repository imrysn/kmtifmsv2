# ⚠️ IMPORTANT: Database Folder Location

## What Happened?

You moved the entire `database/` folder to `\\KMTI-NAS\Shared\data\`, but this folder contains **JavaScript configuration and utility scripts** that need to stay in your project directory.

## Correct Setup

### What Should Be Where:

```
Your Project (D:\RAYSAN\kmtifmsv2\kmtifmsv2\)
├── database/                    ← THIS FOLDER STAYS HERE!
│   ├── config.js               ← JavaScript config files
│   ├── switch-database-mode.js ← Utility scripts
│   ├── test-connection.js      ← Testing scripts
│   └── ... (all .js files)
│
└── .env                        ← Database credentials file

\\KMTI-NAS\Shared\data\
└── (Only the MySQL database itself, managed by MySQL Server)
   NOT the database/ folder!
```

## Why This Matters

### The `database/` folder contains:
1. **JavaScript configuration files** - Node.js needs these
2. **NPM scripts** - Used by `npm run db:*` commands
3. **Utility tools** - Connection testing, migration, etc.
4. **Documentation** - Setup guides

### The MySQL database itself:
- Lives **inside MySQL Server** on KMTI-NAS
- Managed by MySQL (not file-based like SQLite)
- Accessed via network protocol (TCP/IP port 3306)
- **NOT a folder you copy manually**

## Key Difference: SQLite vs MySQL

### SQLite (Old System)
```
\\KMTI-NAS\Shared\data\
└── filemanagement.db  ← Single file database
```
**Problem**: File locking over network causes corruption

### MySQL (New System)
```
KMTI-NAS Server:
├── MySQL Server Service (running)
└── Data Directory (managed by MySQL)
    └── kmtifms database (managed internally)
```
**Benefit**: Client-server architecture, no file locking issues

## What To Do Now

### Step 1: Keep Database Folder in Project ✅

The `database/` folder should remain at:
```
D:\RAYSAN\kmtifmsv2\kmtifmsv2\database\
```

I've already recreated the essential files for you!

### Step 2: Configure MySQL Connection

Run the configuration wizard:
```bash
npm run db:switch
```

Choose option 1 (MySQL) and enter:
- **Host**: KMTI-NAS
- **Port**: 3306
- **Database**: kmtifms
- **User**: kmtifms_user
- **Password**: (your MySQL password)

This creates a `.env` file with your connection settings.

### Step 3: MySQL Server Setup

The MySQL database needs to be created **in MySQL Server** on KMTI-NAS:

```sql
-- Connect to MySQL on KMTI-NAS
mysql -h KMTI-NAS -u root -p

-- Create database
CREATE DATABASE kmtifms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'kmtifms_user'@'%' IDENTIFIED BY 'YourSecurePassword';

-- Grant permissions
GRANT ALL PRIVILEGES ON kmtifms.* TO 'kmtifms_user'@'%';
FLUSH PRIVILEGES;

EXIT;
```

### Step 4: Initialize Database Schema

From your project directory:
```bash
npm run db:init
```

This creates all the tables inside the MySQL database on KMTI-NAS.

### Step 5: Test Connection

```bash
npm run db:test
```

You should see:
```
✅ MySQL connection successful
MySQL Version: 8.0.xx
Current Database: kmtifms
Tables Found: 6
```

## Quick Reference

### Files That Stay in Project
```
database/config.js              ← Connection settings
database/switch-database-mode.js ← Configuration wizard
database/test-connection.js     ← Connection tester
database/init-mysql.js          ← Database initializer
database/migrate-from-sqlite.js ← Migration tool
database/backup-mysql.js        ← Backup tool
database/sql/schema.sql         ← Database schema
```

### Files on Network (None!)
```
(The MySQL database is NOT a file you manually place on the network.
 It's managed by MySQL Server itself.)
```

## NPM Commands

```bash
npm run db:switch    # Configure MySQL or SQLite
npm run db:test      # Test MySQL connection
npm run db:init      # Initialize MySQL database
npm run db:migrate   # Migrate from SQLite (if applicable)
npm run health       # Full system check
```

## Troubleshooting

### "Cannot find module 'database/config.js'"
**Solution**: The `database/` folder must be in your project directory.
Status: ✅ Fixed - Files recreated

### "Cannot connect to MySQL"
**Possible causes**:
1. MySQL Server not running on KMTI-NAS
2. Firewall blocking port 3306
3. Incorrect credentials in `.env`
4. Database not created yet

**Check**:
```bash
# Test network connection
ping KMTI-NAS

# Test MySQL port
telnet KMTI-NAS 3306

# Verify configuration
npm run db:test
```

### "Table doesn't exist"
**Solution**: Initialize the database
```bash
npm run db:init
```

## Summary

✅ **DO THIS**: Keep `database/` folder in your project  
✅ **DO THIS**: Use `.env` file for MySQL credentials  
✅ **DO THIS**: Initialize database with `npm run db:init`  

❌ **DON'T**: Copy `database/` folder to network  
❌ **DON'T**: Manually copy MySQL database files  
❌ **DON'T**: Try to access MySQL database as a file  

---

## Need Help?

1. Run system diagnostics: `npm run health`
2. Test MySQL connection: `npm run db:test`
3. Read setup guide: `SETUP-GUIDE.md`
4. Check migration guide: `MYSQL-MIGRATION-GUIDE.md`

---

**Current Status**: ✅ Database folder recreated in project  
**Next Step**: Run `npm run db:switch` to configure MySQL

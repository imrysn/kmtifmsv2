# 🎯 Quick Setup Guide

## ✅ Files Restored!

I've recreated all essential database files in your project directory.

---

## 📂 Current Status

```
D:\RAYSAN\kmtifmsv2\kmtifmsv2\database\     ✅ RECREATED
├── config.js                                ✅ MySQL configuration
├── switch-database-mode.js                  ✅ Configuration wizard
├── test-connection.js                       ✅ Connection tester
├── init-mysql.js                            ✅ Database initializer
├── README-SETUP.md                          ✅ Setup instructions
└── sql/
    └── schema.sql                           ✅ Database schema
```

---

## 🚀 Next Steps

### Step 1: Configure MySQL Connection

Run the interactive wizard:

```bash
npm run db:switch
```

**Choose option 1 (MySQL)** and enter:
- Host: **KMTI-NAS**
- Port: **3306** (press Enter for default)
- Database: **kmtifms** (press Enter for default)
- User: **kmtifms_user** (press Enter for default)
- Password: **[enter your MySQL password]**

This creates a `.env` file with your connection settings.

### Step 2: Initialize Database

```bash
npm run db:init
```

This creates all tables in the MySQL database on KMTI-NAS.

### Step 3: Test Connection

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

### Step 4: Start the Server

```bash
npm run server:standalone
```

Or run the full application:
```bash
npm run dev
```

---

## ❓ Common Questions

### Q: Where is the MySQL database stored?
**A:** Inside MySQL Server on KMTI-NAS (not a file you copy manually)

### Q: Why keep database folder in project?
**A:** These are JavaScript configuration files, not the database itself

### Q: What about the files I moved to the network?
**A:** You can delete them - they're now back in your project where they belong

### Q: How do I create the MySQL database?
**A:** Connect to MySQL and run:
```sql
CREATE DATABASE kmtifms;
CREATE USER 'kmtifms_user'@'%' IDENTIFIED BY 'YourPassword';
GRANT ALL PRIVILEGES ON kmtifms.* TO 'kmtifms_user'@'%';
FLUSH PRIVILEGES;
```

---

## 🔍 Verify Setup

Run the health check:
```bash
npm run health
```

This will verify:
- ✅ Node.js version
- ✅ Required packages
- ✅ Database configuration
- ✅ MySQL connection
- ✅ File structure

---

## 📚 Documentation

Full guides available:
- **SETUP-GUIDE.md** - Complete setup instructions
- **MYSQL-MIGRATION-GUIDE.md** - Migration from SQLite
- **DATABASE-QUICK-REFERENCE.md** - Quick commands
- **database/README-SETUP.md** - This guide explained in detail

---

## 🆘 Troubleshooting

### Cannot connect to MySQL
```bash
# Check MySQL is running
# On KMTI-NAS: sc query MySQL80

# Test network
ping KMTI-NAS

# Verify .env file exists
type .env
```

### Tables not found
```bash
# Initialize database
npm run db:init
```

### Need to reconfigure
```bash
# Run wizard again
npm run db:switch
```

---

## ✨ You're Ready!

Your database folder is now correctly set up in your project directory.

**Next command to run:**
```bash
npm run db:switch
```

Then follow the on-screen instructions! 🚀

# 🚀 SQLite to MySQL Migration Guide

## Overview

KMTIFMS2 has been upgraded from SQLite to MySQL to solve database corruption issues when multiple PCs access the system simultaneously over the network.

## ⚠️ Important: Why This Migration is Necessary

### The Problem with SQLite
- **Network File Locking Issues**: SQLite uses file-based locking that doesn't work reliably over network shares (SMB/CIFS)
- **Corruption Risk**: When 2+ PCs access the database simultaneously, SQLite can become corrupted
- **Data Loss**: Corrupted databases can lead to lost data and system downtime
- **Performance**: SQLite isn't optimized for concurrent multi-user access

### The Solution: MySQL
- ✅ **Designed for Multi-User Access**: Handles concurrent connections properly
- ✅ **Network Optimized**: Uses TCP/IP protocol designed for network communication
- ✅ **ACID Compliant**: Proper transaction handling prevents data corruption
- ✅ **Better Performance**: Connection pooling and optimized for concurrent access
- ✅ **Enterprise Ready**: Proven solution for multi-user desktop applications

## 📋 Migration Checklist

### Phase 1: Preparation (Before Migration)

- [ ] **Backup SQLite Database**
  ```bash
  # Copy the current database file
  copy \\KMTI-NAS\Shared\data\filemanagement.db \\KMTI-NAS\Shared\data\filemanagement.db.backup
  ```

- [ ] **Install MySQL Server on KMTI-NAS** (or dedicated server)
  - Download MySQL 8.0+ from [mysql.com](https://dev.mysql.com/downloads/installer/)
  - Install with default settings
  - Remember the root password!

- [ ] **Configure Windows Firewall** (on KMTI-NAS)
  ```powershell
  # Allow MySQL port
  New-NetFirewallRule -DisplayName "MySQL" -Direction Inbound -Protocol TCP -LocalPort 3306 -Action Allow
  ```

- [ ] **Test MySQL Service**
  ```cmd
  # On KMTI-NAS, verify MySQL is running
  sc query MySQL80
  ```

### Phase 2: Database Setup

- [ ] **Install Node.js Dependencies**
  ```bash
  npm install mysql2
  ```

- [ ] **Create MySQL Database and User**
  
  Connect to MySQL as root:
  ```bash
  mysql -u root -p
  ```
  
  Run these SQL commands:
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
  SHOW GRANTS FOR 'kmtifms_user'@'%';
  
  -- Exit
  EXIT;
  ```

- [ ] **Configure Database Connection**
  
  Edit `database/config.js`:
  ```javascript
  production: {
    host: 'KMTI-NAS',              // MySQL server hostname
    port: 3306,
    user: 'kmtifms_user',
    password: 'YourSecurePassword123!',  // Match the password above
    database: 'kmtifms',
    connectionLimit: 10
  }
  ```

- [ ] **Test Database Connection**
  ```bash
  npm run db:test
  ```
  
  Expected output:
  ```
  ✅ MySQL connection successful
  MySQL Version: 8.0.xx
  Current Database: kmtifms
  ```

### Phase 3: Schema Initialization

- [ ] **Initialize MySQL Schema**
  ```bash
  npm run db:init
  ```
  
  This will:
  - Create all tables
  - Set up indexes
  - Create stored procedures
  - Create views
  - Insert default admin user

- [ ] **Verify Tables Created**
  ```bash
  npm run db:test
  ```
  
  Should show:
  ```
  📊 Database contains 6 tables:
     ✓ users
     ✓ teams
     ✓ files
     ✓ file_comments
     ✓ file_status_history
     ✓ activity_logs
  ```

### Phase 4: Data Migration

- [ ] **Migrate Data from SQLite to MySQL**
  ```bash
  npm run db:migrate
  ```
  
  This script will:
  - Read all data from SQLite
  - Transfer to MySQL
  - Preserve all relationships
  - Show migration statistics

- [ ] **Verify Migrated Data**
  ```bash
  npm run db:test
  ```
  
  Check record counts match your SQLite database.

- [ ] **Manual Verification** (Connect to MySQL):
  ```bash
  mysql -u kmtifms_user -p kmtifms
  ```
  
  Run verification queries:
  ```sql
  -- Check user count
  SELECT COUNT(*) FROM users;
  
  -- Check files count
  SELECT COUNT(*) FROM files;
  
  -- Check recent activity
  SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10;
  
  -- Check file workflow stages
  SELECT current_stage, COUNT(*) FROM files GROUP BY current_stage;
  ```

### Phase 5: Server Update

- [ ] **Update Server Configuration**
  
  The server now automatically uses MySQL. Verify by checking the startup logs:
  ```bash
  npm run server:standalone
  ```
  
  Expected output:
  ```
  🗄️  Database Type: MySQL
  📊 Database: kmtifms @ KMTI-NAS:3306
  ✅ MySQL pool created for PRODUCTION
  🚀 Express server running on http://localhost:3001
  ```

- [ ] **Update Electron main.js** (if needed)
  
  Verify the server starts correctly when running the full app:
  ```bash
  npm run dev
  ```

### Phase 6: Testing

- [ ] **Test All User Roles**
  - [ ] Login as USER
  - [ ] Login as TEAM_LEADER
  - [ ] Login as ADMIN

- [ ] **Test File Operations**
  - [ ] Upload file
  - [ ] View uploaded files
  - [ ] Approve file (Team Leader)
  - [ ] Approve file (Admin)
  - [ ] Reject file
  - [ ] Delete file

- [ ] **Test Concurrent Access**
  - [ ] Open application on PC 1
  - [ ] Open application on PC 2
  - [ ] Perform operations simultaneously
  - [ ] Verify no corruption or errors

- [ ] **Test User Management** (Admin)
  - [ ] Create user
  - [ ] Edit user
  - [ ] Delete user
  - [ ] View activity logs

- [ ] **Test Team Management** (Admin)
  - [ ] Create team
  - [ ] Edit team
  - [ ] Assign team leader
  - [ ] Delete team

### Phase 7: Deployment

- [ ] **Copy Database Folder to Network**
  ```bash
  # Copy database/ folder to KMTI-NAS
  xcopy /E /I database \\KMTI-NAS\Shared\data\database
  ```

- [ ] **Create Backup Schedule**
  
  Set up Windows Task Scheduler to run daily backups:
  ```bash
  # Task: Daily MySQL Backup
  # Action: Run npm run db:backup
  # Schedule: Daily at 2:00 AM
  ```

- [ ] **Document Credentials**
  - Store database credentials securely
  - Update IT documentation
  - Train team on new backup procedures

- [ ] **Update All Client PCs**
  - Install updated application on all PCs
  - Verify each PC can connect to MySQL
  - Test file operations from each PC

### Phase 8: Cleanup

- [ ] **Backup Old SQLite Database**
  ```bash
  # Keep the backup for 30 days
  move \\KMTI-NAS\Shared\data\filemanagement.db \\KMTI-NAS\Shared\data\backup\filemanagement.db.old
  ```

- [ ] **Monitor for Issues**
  - Watch for connection errors
  - Monitor database performance
  - Check backup success

- [ ] **Remove SQLite Dependency** (After 30 days of stable operation)
  ```bash
  npm uninstall sqlite3
  ```

## 🔧 Troubleshooting

### Connection Failed

**Error**: `ECONNREFUSED` or `Cannot connect to MySQL`

**Solutions**:
1. Verify MySQL service is running on KMTI-NAS
2. Check firewall allows port 3306
3. Test with telnet: `telnet KMTI-NAS 3306`
4. Verify credentials in `database/config.js`

### Access Denied

**Error**: `Access denied for user 'kmtifms_user'@'hostname'`

**Solutions**:
1. Verify password in config matches MySQL user password
2. Check user has proper permissions:
   ```sql
   SHOW GRANTS FOR 'kmtifms_user'@'%';
   ```
3. Recreate user if needed

### Migration Fails

**Error**: Various errors during migration

**Solutions**:
1. Check SQLite database path is correct
2. Verify MySQL tables are created (run `npm run db:init`)
3. Check for sufficient disk space
4. Review error messages for specific issues

### Slow Performance

**Issue**: Application feels slower than before

**Solutions**:
1. Add indexes (already included in schema)
2. Increase connection pool size in config
3. Check network latency to MySQL server
4. Consider moving MySQL to dedicated server

## 📊 Performance Comparison

| Metric | SQLite (Network) | MySQL (Network) |
|--------|------------------|-----------------|
| Concurrent Users | ❌ Corrupt at 2+ | ✅ Handles 10+ |
| Data Integrity | ❌ High Risk | ✅ ACID Compliant |
| File Operations | ~500ms | ~100ms |
| Corruption Risk | High | Very Low |
| Backup/Restore | File Copy | mysqldump |
| Network Optimized | ❌ No | ✅ Yes |

## 🎯 Success Criteria

Migration is successful when:

- ✅ All PCs can connect to MySQL
- ✅ All data migrated correctly
- ✅ Multiple users can work simultaneously
- ✅ No database corruption errors
- ✅ File approval workflow works correctly
- ✅ Activity logs are being recorded
- ✅ Backups run successfully

## 📚 Additional Resources

- [MySQL Installation Guide](https://dev.mysql.com/doc/refman/8.0/en/installing.html)
- [MySQL Security Guide](https://dev.mysql.com/doc/refman/8.0/en/security-guidelines.html)
- [Connection Pooling](https://github.com/sidorares/node-mysql2#using-connection-pools)
- [Database README](./database/README.md)

## 🆘 Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review `database/README.md` for detailed documentation
3. Run `npm run db:test` to diagnose connection issues
4. Check MySQL error logs on KMTI-NAS
5. Verify network connectivity and firewall rules

## 📝 Migration Timeline

**Estimated Time**: 2-4 hours

- Phase 1-2: 30 minutes (Preparation and MySQL setup)
- Phase 3-4: 30 minutes (Schema and data migration)
- Phase 5-6: 1-2 hours (Testing and verification)
- Phase 7-8: 1 hour (Deployment and cleanup)

**Recommended Schedule**:
- Perform during off-hours or weekend
- Notify all users in advance
- Have rollback plan ready (SQLite backup)
- Monitor for 24-48 hours after migration

---

**Version**: 2.0.0  
**Last Updated**: January 2025  
**Migration Status**: Ready for deployment

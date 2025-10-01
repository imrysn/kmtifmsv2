# 📊 MySQL Database Quick Reference

## Essential Commands

### Setup & Initialization

```bash
# Install MySQL dependency
npm install mysql2

# Initialize MySQL database (create tables, indexes, procedures)
npm run db:init

# Test MySQL connection
npm run db:test

# Migrate data from SQLite to MySQL
npm run db:migrate

# Backup MySQL database
npm run db:backup
```

### Daily Operations

```bash
# Start server with MySQL
npm run server:standalone

# Run full development environment
npm run dev

# Check database connection and stats
npm run db:test
```

### Database Configuration

**File**: `database/config.js`

```javascript
// Production (KMTI-NAS)
production: {
  host: 'KMTI-NAS',
  port: 3306,
  user: 'kmtifms_user',
  password: 'your-secure-password',
  database: 'kmtifms',
  connectionLimit: 10
}

// Development (Local)
development: {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'kmtifms_dev',
  connectionLimit: 5
}
```

## MySQL Commands

### Connect to Database

```bash
# From Windows command line
mysql -h KMTI-NAS -u kmtifms_user -p kmtifms

# From local machine
mysql -u root -p
```

### Useful SQL Queries

```sql
-- Show all tables
SHOW TABLES;

-- Check record counts
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'files', COUNT(*) FROM files
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs;

-- Check pending files
SELECT current_stage, COUNT(*) 
FROM files 
GROUP BY current_stage;

-- Recent activity
SELECT username, activity, timestamp 
FROM activity_logs 
ORDER BY timestamp DESC 
LIMIT 10;

-- User statistics
SELECT u.username, u.role, u.team, COUNT(f.id) as files_uploaded
FROM users u
LEFT JOIN files f ON u.id = f.user_id
GROUP BY u.id
ORDER BY files_uploaded DESC;

-- Files awaiting approval
SELECT f.id, f.filename, f.username, f.current_stage, 
       TIMESTAMPDIFF(HOUR, f.uploaded_at, NOW()) as hours_waiting
FROM files f
WHERE f.current_stage IN ('pending_team_leader', 'pending_admin')
ORDER BY f.uploaded_at ASC;
```

### Backup & Restore

```bash
# Backup database
mysqldump -u kmtifms_user -p kmtifms > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u kmtifms_user -p kmtifms < backup_20250101.sql

# Backup specific table
mysqldump -u kmtifms_user -p kmtifms files > files_backup.sql
```

## Troubleshooting

### Problem: Cannot Connect

```bash
# 1. Check MySQL service is running
sc query MySQL80

# 2. Test network connectivity
ping KMTI-NAS
telnet KMTI-NAS 3306

# 3. Verify credentials
npm run db:test
```

### Problem: Access Denied

```sql
-- Check user permissions
SHOW GRANTS FOR 'kmtifms_user'@'%';

-- Reset password if needed
ALTER USER 'kmtifms_user'@'%' IDENTIFIED BY 'new-password';
FLUSH PRIVILEGES;
```

### Problem: Slow Performance

```sql
-- Check for slow queries
SHOW FULL PROCESSLIST;

-- Analyze query performance
EXPLAIN SELECT * FROM files WHERE user_id = 1;

-- Check index usage
SHOW INDEX FROM files;
```

## Database Maintenance

### Weekly Tasks

```bash
# Backup database
npm run db:backup

# Check connection health
npm run db:test
```

### Monthly Tasks

```sql
-- Analyze tables for optimization
ANALYZE TABLE users, teams, files, activity_logs;

-- Check table sizes
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
FROM information_schema.TABLES
WHERE table_schema = 'kmtifms'
ORDER BY (data_length + index_length) DESC;

-- Archive old activity logs (older than 6 months)
DELETE FROM activity_logs 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 6 MONTH);
```

## Environment Variables

**File**: `.env`

```bash
# Database Configuration
DB_HOST=KMTI-NAS
DB_PORT=3306
DB_USER=kmtifms_user
DB_PASSWORD=your-secure-password
DB_NAME=kmtifms

# Node Environment
NODE_ENV=production
```

## Connection Pool Settings

```javascript
// Adjust in database/config.js

connectionLimit: 10,      // Max concurrent connections
waitForConnections: true, // Queue when pool is full
queueLimit: 0,           // No limit on queue size
enableKeepAlive: true,   // Maintain connections
keepAliveInitialDelay: 0
```

## Security Checklist

- [ ] Strong password for database user (16+ chars)
- [ ] Firewall configured to allow MySQL port
- [ ] User permissions limited to specific database
- [ ] Regular backups scheduled
- [ ] .env file added to .gitignore
- [ ] SSL/TLS enabled (for production)
- [ ] MySQL root account secured

## Performance Tips

1. **Use Indexes**: Already configured for common queries
2. **Connection Pooling**: Configured automatically
3. **Query Optimization**: Use EXPLAIN for slow queries
4. **Regular Maintenance**: Run ANALYZE TABLE monthly
5. **Archive Old Data**: Move old logs to archive tables

## Quick Diagnostics

```bash
# Full system check
npm run db:test

# Expected output:
# ✅ MySQL connection successful
# MySQL Version: 8.0.xx
# Current Database: kmtifms
# Active Connections: 1
# Tables Found: 6
# 
# 📊 Database Tables:
#    ✓ users
#    ✓ teams
#    ✓ files
#    ✓ file_comments
#    ✓ file_status_history
#    ✓ activity_logs
```

## Support Resources

- **Database Documentation**: `database/README.md`
- **Migration Guide**: `MYSQL-MIGRATION-GUIDE.md`
- **MySQL Docs**: https://dev.mysql.com/doc/
- **Node MySQL2**: https://github.com/sidorares/node-mysql2

---

**Keep this handy for quick reference!** 🚀

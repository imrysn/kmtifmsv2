# KMTIFMSV2 Network Database Deployment Guide

## Overview
The KMTIFMSV2 system has been configured to use a centralized network database and uploads directory located at `\\KMTI-NAS\Shared\data`. This allows multiple team members to access the same data and provides centralized storage for all files and database operations.

## Network Configuration

### Current Setup
- **Network Path**: `\\KMTI-NAS\Shared\data`
- **Database Location**: `\\KMTI-NAS\Shared\data\database.sqlite`
- **Uploads Directory**: `\\KMTI-NAS\Shared\data\uploads\`

### What Changed
1. **Database Path**: Moved from local `./database.sqlite` to network location
2. **File Uploads**: All uploaded files now stored on network share
3. **Centralized Access**: All team members access the same database and files

## Prerequisites

### Network Access
- Ensure you have access to the KMTI-NAS server
- Verify you can browse to `\\KMTI-NAS\Shared\data`
- Confirm you have read/write permissions on the network share
- VPN connection may be required if working remotely

### File Permissions
The system requires:
- **Read access** to the database file
- **Write access** to create/modify database records
- **Write access** to the uploads directory for file storage

## Verification Steps

### 1. Test Network Connection
Run the network verification script:
```bash
npm run verify:network
```

This will check:
- Network path accessibility
- Database file presence and connectivity
- Uploads directory access
- Database table integrity
- Current data counts

### 2. Manual Verification
You can also manually check:
1. Browse to `\\KMTI-NAS\Shared\data` in Windows Explorer
2. Verify `database.sqlite` file exists
3. Check if `uploads` folder exists and is accessible

## Starting the System

### Standard Startup
```bash
# Verify network connection first
npm run verify:network

# Start the application
npm run dev
```

### Troubleshooting Startup
If you encounter network issues:

1. **Check VPN Connection** (if remote)
2. **Verify Network Permissions**
3. **Test Manual Access** to `\\KMTI-NAS\Shared\data`

## Migration Status

### Completed
✅ Database moved to network location  
✅ Server configured for network paths  
✅ Upload system updated  
✅ Network verification script created  

### Data Preserved
All existing data is preserved in the network database:
- User accounts and authentication
- Team configurations
- Activity logs (all development history)
- File approval records
- File uploads and metadata

## Team Access

### Multi-User Benefits
- **Centralized Data**: All team members see the same information
- **Real-time Collaboration**: Changes are immediately visible to all users
- **Unified File Storage**: All uploaded files in one location
- **Complete Activity History**: All development activities tracked

### Access Control
The existing role-based system remains unchanged:
- **USER**: File upload and personal dashboard access
- **TEAM LEADER**: File review and team management
- **ADMIN**: Full system administration

## Monitoring & Maintenance

### Regular Checks
1. **Network Connectivity**: Ensure KMTI-NAS accessibility
2. **Database Backup**: Consider regular backups of `database.sqlite`
3. **Storage Space**: Monitor available space on network share
4. **Access Permissions**: Verify team member access rights

### Database Health
Use the existing database check script:
```bash
npm run check:db
```

This validates:
- Table structure integrity
- Data consistency
- Team configurations
- User accounts

## Backup Strategy

### Recommended Approach
1. **Database Backup**: Regular copies of `database.sqlite`
2. **File Backup**: Backup the entire `uploads` folder
3. **Version Control**: Consider versioned backups

### Backup Locations
- Local backup: Copy to development machine
- Secondary network location: Alternative network path
- Cloud storage: For off-site backup

## Security Considerations

### Network Security
- Database contains user passwords (hashed with bcrypt)
- File uploads may contain sensitive documents
- Ensure network share has appropriate access controls
- Consider encryption for highly sensitive data

### Access Monitoring
The system logs all activities including:
- User login/logout events
- File upload/approval actions
- Administrative changes
- System access attempts

## Troubleshooting

### Common Issues

#### "Network path not accessible"
- Check VPN connection
- Verify network share permissions
- Test manual access to `\\KMTI-NAS\Shared\data`

#### "Database connection failed"
- Ensure database file exists at network location
- Check file permissions (read/write required)
- Verify no other process is locking the database

#### "Upload directory not found"
- Directory will be created automatically on first upload
- Ensure write permissions to network share
- Manually create `uploads` folder if needed

#### "Slow performance"
- Network latency may affect response times
- Consider local database copy for development
- Optimize network connection quality

### Recovery Procedures

#### Network Unavailable
If network access is lost:
1. Copy database locally for emergency access
2. Update server configuration temporarily
3. Restore network configuration when available

#### Database Corruption
1. Stop all applications accessing the database
2. Restore from latest backup
3. Verify data integrity
4. Resume operations

## Development vs Production

### Current Configuration
The system is now configured for **shared team access** using the network database.

### Alternative Configurations
- **Local Development**: Use local database copy for isolated development
- **Hybrid Mode**: Local development with network sync
- **Full Production**: Dedicated database server (future consideration)

## Contact & Support

For network access issues or database problems:
1. Check this deployment guide first
2. Run `npm run verify:network` for diagnostics
3. Contact system administrator for network/permission issues
4. Refer to application logs for detailed error information

---

**Last Updated**: January 2025  
**Configuration**: Network Database on KMTI-NAS  
**Version**: KMTIFMSV2 Network Deployment  

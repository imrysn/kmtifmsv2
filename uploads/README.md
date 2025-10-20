# Uploads Directory

This folder stores uploaded files when using **local storage mode**.

## Current Mode: LOCAL STORAGE ✅

Files uploaded through the "My Files" feature are saved here, organized by username:

```
uploads/
├── [username1]/
│   ├── file1.pdf
│   ├── file2.docx
│   └── ...
├── [username2]/
│   ├── file3.xlsx
│   └── ...
└── README.md (this file)
```

## Important Notes

### Local Storage (Current Mode)
- **Active when:** `USE_LOCAL_STORAGE=true` in `.env` file
- **Location:** This folder (local computer)
- **Access:** Only accessible from this computer
- **Use case:** Testing, development, single-user setups

### Network Storage (Production Mode)
- **Active when:** `USE_LOCAL_STORAGE=false` in `.env` file
- **Location:** `\\KMTI-NAS\Shared\data\uploads`
- **Access:** Accessible by all users on the network
- **Use case:** Production, multi-user environments

## File Organization

Each user has their own subfolder:
- Automatically created when user uploads first file
- Named after the username
- Keeps files organized and separates user data

## Web Access

Files are accessible via HTTP:
- URL pattern: `http://localhost:3001/uploads/[username]/[filename]`
- Example: `http://localhost:3001/uploads/john.doe/report.pdf`

## Switching to Network Storage

When ready for production:

1. Ensure network path is accessible: `\\KMTI-NAS\Shared\data`
2. Create `uploads` folder on the NAS if it doesn't exist
3. Set proper permissions (Full Control)
4. Edit `.env` file: Set `USE_LOCAL_STORAGE=false` or comment it out
5. Restart the server
6. Files will be saved to network instead

See `UPLOAD-ERROR-FIX.md` for detailed instructions.

## Backup

### Local Storage
- Back up this folder regularly
- Or enable network storage for automatic NAS backup

### Network Storage  
- NAS should handle backups automatically
- Check with your IT administrator

## Troubleshooting

### Can't upload files
1. Check if this folder exists
2. Verify write permissions
3. Check server console for errors
4. Run: `node diagnose-uploads.js`

### Files not appearing
1. Check username subfolder exists
2. Verify file was uploaded successfully
3. Check MySQL database `files` table for record
4. Check file_path column matches actual location

---

**Created:** October 20, 2025  
**Mode:** Local Storage (Temporary)  
**Purpose:** Testing/Development

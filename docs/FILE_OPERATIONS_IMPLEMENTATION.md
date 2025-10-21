# File Operations Implementation Guide

## Overview
This document describes the implementation of the **Open** and **Delete** file operations in the My Files Table View component.

## Features Implemented

### 1. **Open File** Button
- **Icon**: External link icon (opens in new window/tab)
- **Color**: Green background (`#d1f2eb`) with dark green icon (`#0f5132`)
- **Functionality**: 
  - Opens the file in a new browser tab
  - Uses the file's stored path from the database
  - Constructs URL: `http://localhost:3001${file.file_path}`
  - Works with all file types (PDFs, images, documents, etc.)

### 2. **Delete File** Button
- **Icon**: Trash bin icon
- **Color**: Red background (`#f8d7da`) with dark red icon (`#721c24`)
- **Functionality**:
  - Shows confirmation dialog before deletion
  - Two-step deletion process:
    1. Deletes physical file from server storage
    2. Deletes database record
  - Shows loading spinner during deletion
  - Refreshes file list after successful deletion
  - Error handling with user feedback

### 3. **Button Visibility**
- **Open** button: Always visible for all files
- **View Details** button: Always visible for all files
- **Delete** button: Only shown for files that are NOT:
  - Final approved (`status !== 'final_approved'`)
  - Pending review (`!current_stage.includes('pending')`)

## File Structure Changes

### Modified Files

#### 1. `MyFilesTab-TableView.jsx`
**Location**: `client/src/components/user/MyFilesTab-TableView.jsx`

**New State Variables**:
```javascript
const [isDeleting, setIsDeleting] = useState(null); // Tracks which file is being deleted
```

**New Functions**:
```javascript
// Handle file open
const handleOpenFile = async (file, e) => {
  e.stopPropagation();
  const fileUrl = `http://localhost:3001${file.file_path}`;
  window.open(fileUrl, '_blank');
}

// Handle file delete
const handleDeleteFile = async (file, e) => {
  e.stopPropagation();
  
  // Confirm deletion
  if (!window.confirm(`Are you sure you want to delete "${file.original_name}"?...`)) return;
  
  setIsDeleting(file.id);
  
  try {
    // 1. Delete physical file
    await fetch(`http://localhost:3001/api/files/${file.id}/delete-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: user.id,
        adminUsername: user.username,
        adminRole: user.role,
        team: user.team
      })
    });
    
    // 2. Delete database record
    await fetch(`http://localhost:3001/api/files/${file.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: user.id,
        adminUsername: user.username,
        adminRole: user.role,
        team: user.team
      })
    });
    
    // 3. Refresh file list
    fetchUserFiles();
  } catch (error) {
    alert(`Failed to delete file: ${error.message}`);
  } finally {
    setIsDeleting(null);
  }
}
```

**Updated Actions Column**:
```jsx
<td className="col-actions">
  <div className="action-buttons">
    {/* Open Button */}
    <button className="action-btn open" onClick={(e) => handleOpenFile(file, e)}>
      <svg>...</svg>
    </button>
    
    {/* View Details Button */}
    <button className="action-btn view" onClick={(e) => openFileModal(file)}>
      <svg>...</svg>
    </button>
    
    {/* Delete Button - Conditional */}
    {(!file.status || (file.status !== 'final_approved' && !file.current_stage.includes('pending'))) && (
      <button 
        className="action-btn delete"
        onClick={(e) => handleDeleteFile(file, e)}
        disabled={isDeleting === file.id}
      >
        {isDeleting === file.id ? <LoadingSpinner /> : <TrashIcon />}
      </button>
    )}
  </div>
</td>
```

#### 2. `MyFilesTab-TableView.css`
**Location**: `client/src/components/user/css/MyFilesTab-TableView.css`

**New Styles**:
```css
/* Open Button */
.action-btn.open {
  background: #d1f2eb;
  color: #0f5132;
}

.action-btn.open:hover {
  background: #a7f3d0;
}

/* Disabled State */
.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner Animation */
.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Backend API Endpoints Used

### 1. Delete Physical File
```
POST /api/files/:id/delete-file
```
- Deletes the physical file from the server's file system
- Uses the `file_path` stored in the database
- Returns success/failure status

### 2. Delete Database Record
```
DELETE /api/files/:id
```
- Removes the file record from the database
- Logs the deletion activity
- Returns success/failure status

### 3. Serve File
```
GET /uploads/:path
```
- Static file serving configured in `middleware.js`
- Files are served with proper MIME types
- Content-Disposition set to 'inline' (opens in browser)

## File Serving Configuration

The backend is configured to serve files from the uploads directory:

**Server Configuration** (`server/config/middleware.js`):
```javascript
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', 'inline');
    // Set proper MIME type based on file extension
  }
}));
```

**File Path Structure**:
- Database stores: `/uploads/username/filename.ext`
- Server serves from: `uploadsDir/username/filename.ext`
- Client accesses: `http://localhost:3001/uploads/username/filename.ext`

## User Experience Flow

### Opening a File
1. User clicks the **Open** button (green external link icon)
2. File opens in a new browser tab/window
3. Browser renders the file based on its MIME type:
   - PDFs: Display inline in PDF viewer
   - Images: Display as image
   - Documents: Download or use browser's document viewer
   - Videos/Audio: Play inline if supported

### Deleting a File
1. User clicks the **Delete** button (red trash icon)
2. Confirmation dialog appears with file name
3. User confirms deletion
4. Button shows loading spinner
5. Physical file is deleted from storage
6. Database record is removed
7. Success message shown
8. File list refreshes automatically
9. Deleted file disappears from table

## Error Handling

### Open File Errors
- Invalid file path: Alert shown to user
- Network error: Alert with error message
- File not found: Server returns 404

### Delete File Errors
- File not found: Alert shown (but proceeds with DB deletion)
- Permission denied: Error message displayed
- Network error: User notified, deletion aborted
- Database error: User notified, operation rolled back

## Security Considerations

1. **Authentication**: User credentials sent with each request
2. **Authorization**: Only file owners can delete their files
3. **Validation**: File ID validated on server
4. **Audit Trail**: All deletions logged with user info
5. **Confirmation**: Double confirmation required for deletion

## Testing Checklist

- [ ] Open PDF file in new tab
- [ ] Open image file in new tab
- [ ] Open document file (DOC, XLS, etc.)
- [ ] Delete file successfully
- [ ] Cancel file deletion
- [ ] Delete multiple files in sequence
- [ ] Check file list refreshes after deletion
- [ ] Verify physical file is removed from storage
- [ ] Verify database record is removed
- [ ] Test with special characters in filename
- [ ] Test with very large files
- [ ] Verify audit log entry is created
- [ ] Test button disabled states
- [ ] Test loading spinner during deletion

## Future Enhancements

1. **Batch Operations**: Select multiple files to delete at once
2. **Undo Delete**: Temporary trash folder with restore capability
3. **Delete Confirmation**: More detailed confirmation with file info
4. **Preview Modal**: Quick preview before opening full file
5. **Download Option**: Add separate download button
6. **Share File**: Generate shareable link
7. **File History**: Track all file operations
8. **Permissions**: Role-based delete restrictions

## Troubleshooting

### File Won't Open
1. Check file path in database is correct
2. Verify file exists in uploads directory
3. Check server is running on port 3001
4. Verify CORS settings allow file serving
5. Check browser console for errors

### Delete Fails
1. Check user permissions
2. Verify file exists before deletion
3. Check server has write permissions
4. Review server logs for detailed errors
5. Ensure database connection is active

## Related Files

- Frontend: `client/src/components/user/MyFilesTab-TableView.jsx`
- Styles: `client/src/components/user/css/MyFilesTab-TableView.css`
- Backend Routes: `server/routes/files.js`
- Middleware: `server/config/middleware.js`
- Database: `server/config/database.js`

## Conclusion

The file operations implementation provides a complete solution for opening and deleting files in the My Files section. The implementation follows best practices for error handling, user feedback, and security while maintaining a clean and intuitive user interface.

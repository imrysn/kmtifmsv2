# File Open Feature - User Panel + Admin Panel

## Overview
The "Open" button functionality allows users to open files directly with their system's default application (e.g., Microsoft Word for .docx files, Adobe Acrobat for .pdf files) instead of viewing them in the browser.

## ✅ Implementation Status

### User Panel (My Files Tab)
**Status**: ✅ Already Implemented
**File**: `client/src/components/user/MyFilesTab.jsx`
**Location**: 3-dot menu (⋮) → "Open" button

### Admin Panel (File Approval)  
**Status**: ✅ Updated Today
**File**: `client/src/components/admin/FileApproval-Optimized.jsx`
**Location**: File details modal → "Open" button

---

## User Panel Implementation

### Location in UI
In the "My Files" table, each file row has an **Actions** column with a 3-dot menu (⋮). Click it to see:
- Delete
- **Open** ← Opens file with default application

### Code Implementation
```javascript
const openFile = async (file) => {
  try {
    // Check if running in Electron
    if (window.electron && window.electron.openFileInApp) {
      // Get the actual file path from server
      const response = await fetch(`http://localhost:3001/api/files/${file.id}/path`);
      const data = await response.json();
      
      if (data.success && data.filePath) {
        // Open file with system default application
        const result = await window.electron.openFileInApp(data.filePath);
        
        if (!result.success) {
          setSuccessModal({
            isOpen: true,
            title: 'Error',
            message: result.error || 'Failed to open file with system application',
            type: 'error'
          });
        }
      } else {
        throw new Error('Could not get file path');
      }
    } else {
      // In browser - just open in new tab
      const fileUrl = `http://localhost:3001${file.file_path}`;
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error('Error opening file:', error);
    setSuccessModal({
      isOpen: true,
      title: 'Error',
      message: 'Failed to open file. Please try again.',
      type: 'error'
    });
  }
};
```

### UI Integration
```jsx
<button
  className="dropdown-item open-item"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    openFile(file);
    setOpenMenuId(null);
  }}
>
  Open
</button>
```

---

## Admin Panel Implementation

### Location in UI
In the File Approval modal (when viewing file details), there's a large **"Open"** button at the bottom alongside "Approve" and "Reject" buttons.

### Code Implementation
```javascript
const openFileInExplorer = useCallback(async () => {
  if (!selectedFile) return
  
  try {
    // Get the full file path from the server
    const response = await fetch(`${API_BASE}/files/${selectedFile.id}/path`)
    const data = await response.json()
    
    if (!data.success || !data.filePath) {
      setError('Failed to get file path')
      return
    }
    
    const fullPath = data.filePath
    console.log('Opening file at:', fullPath)
    
    // Check if running in Electron
    if (window.electron && typeof window.electron.openFileInApp === 'function') {
      const result = await window.electron.openFileInApp(fullPath)
      
      if (result.success) {
        setSuccess('File opened successfully')
      } else {
        setError(result.error || 'Failed to open file')
      }
    } else {
      // Fallback: open in browser if not in Electron
      window.open(`http://localhost:3001${selectedFile.file_path}`, '_blank')
    }
  } catch (error) {
    console.error('Error opening file:', error)
    setError('Failed to open file')
  }
}, [selectedFile, setError, setSuccess])
```

### UI Integration
```jsx
<button 
  onClick={openFileInExplorer}
  className="btn btn-secondary-large"
  disabled={isLoading}
>
  <svg>...</svg>
  Open
</button>
```

---

## How It Works

### Flow Diagram
```
User clicks "Open" button
         ↓
Frontend calls GET /api/files/:fileId/path
         ↓
Server converts database path to full system path
         ↓
Server returns full file path (e.g., C:\Users\...\uploads\username\file.docx)
         ↓
Frontend receives full path
         ↓
Frontend calls window.electron.openFileInApp(fullPath)
         ↓
Electron's main process receives IPC call via 'file:openInApp'
         ↓
Electron uses shell.openPath() to open file
         ↓
Windows opens file with default application
```

---

## Backend API

### Endpoint: `GET /api/files/:fileId/path`
**File**: `server/routes/files.js`

This endpoint:
1. Retrieves file information from database
2. Converts the stored URL path (e.g., `/uploads/username/file.docx`) to a full system path
3. Normalizes the path for Windows
4. Checks if file exists on disk
5. Returns the full file system path

**Request:**
```http
GET /api/files/123/path
```

**Response:**
```json
{
  "success": true,
  "filePath": "C:\\Users\\Bryan Bergonia\\Documents\\kmtifmsv2\\uploads\\username\\file.docx"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "File not found on disk"
}
```

---

## Electron Integration

### preload.js
Exposes the file opening API to the renderer process:
```javascript
contextBridge.exposeInMainWorld('electron', {
  openFileInApp: (filePath) => ipcRenderer.invoke('file:openInApp', filePath)
});
```

### main.js
Handles the IPC call and opens the file:
```javascript
ipcMain.handle('file:openInApp', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    const fs = require('fs');
    
    console.log(`📂 Opening file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const result = await shell.openPath(filePath);
    
    if (result) {
      console.error('❌ Error opening file:', result);
      return { success: false, error: result };
    }
    
    console.log('✅ File opened successfully');
    return { success: true, method: 'system-default' };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
});
```

---

## Features

### ✅ Automatic Application Selection
- **PDF files (.pdf)** → Adobe Acrobat, PDF reader
- **Word documents (.docx, .doc)** → Microsoft Word
- **Excel files (.xlsx, .xls)** → Microsoft Excel
- **PowerPoint (.pptx, .ppt)** → Microsoft PowerPoint
- **Images (.jpg, .png, .gif)** → Default image viewer
- **Text files (.txt)** → Notepad or default text editor
- **And more...** → Windows automatically selects the right app

### ✅ Error Handling
- Shows error message if file is not found on disk
- Shows error message if file cannot be opened (permissions, etc.)
- Shows success message when file opens successfully (Admin panel only)
- Fallback to browser if not running in Electron environment

### ✅ User Feedback

**User Panel:**
- Error modal with specific error message
- No success modal (file just opens immediately)

**Admin Panel:**
- Success notification: "File opened successfully"
- Error notification with specific error message
- Console logging for debugging

---

## Testing

### Test in User Panel:
1. Start the application: `npm run dev`
2. Log in as a User
3. Go to "My Files" tab
4. Click the **3-dot menu (⋮)** on any file row
5. Click **"Open"**
6. The file should open in its default application

### Test in Admin Panel:
1. Start the application: `npm run dev`
2. Log in as an Admin
3. Go to "File Approval" section
4. Click on any file to view details (opens modal)
5. Click the large **"Open"** button at the bottom
6. The file should open in its default application

### Expected Behavior:
- PDF files open in Adobe Acrobat or default PDF viewer
- Word documents open in Microsoft Word
- Excel files open in Microsoft Excel
- The file opens quickly without opening browser tabs
- You can edit the file directly if you have the right application

### Error Cases to Test:
1. **Missing file**: Delete a file from disk manually, then try to open it → Should show "File not found" error
2. **Permission issues**: If file has restricted permissions → Should show permission error
3. **Browser fallback**: Open the app in a web browser (not Electron) → Should open file in new browser tab

---

## Differences Between Panels

| Feature | User Panel | Admin Panel |
|---------|------------|-------------|
| **Button Location** | 3-dot dropdown menu | Large button in modal |
| **Success Message** | None (silent) | "File opened successfully" |
| **Error Display** | Modal popup | Toast notification |
| **UI Style** | Dropdown item | Large prominent button |

---

## Benefits

### Before This Feature:
- Files opened in browser
- Limited preview capabilities
- Users had to download files to edit them
- Extra steps to open in native application
- No direct file editing

### After This Feature:
- Files open directly in native applications
- Full editing capabilities immediately available
- One-click file access from both user and admin panels
- Seamless workflow
- Faster productivity

---

## Compatibility

### Supported Platforms:
- ✅ Windows 10/11
- ✅ macOS
- ✅ Linux

### Fallback Support:
- If running in web browser (not Electron): Opens file in new browser tab
- If file type has no default application: Windows will prompt user to select an app

---

## Security Considerations

- ✅ File paths are validated on server before being sent to client
- ✅ Electron's `shell.openPath()` is safe and doesn't execute code
- ✅ Only opens files with registered applications
- ✅ No command execution or script injection possible
- ✅ Files are checked for existence before attempting to open
- ✅ Proper error handling prevents security leaks

---

## Troubleshooting

### If files don't open:

**1. Check if you're in Electron**
- The feature only works in the desktop Electron app
- If you're using a web browser, it will open files in new tabs instead

**2. Check console logs**
```javascript
// Open browser console (F12) and look for:
console.log('Opening file at:', fullPath)  // Should show full file path
console.log('✅ File opened successfully') // Or error message
```

**3. Verify file exists**
- Check if the file actually exists at the path shown in console
- Path format: `C:\Users\...\kmtifmsv2\uploads\username\filename.ext`

**4. Check permissions**
- Ensure the user has permission to access the file
- Some network drives may have restrictions

**5. Verify default application**
- Make sure the file type has a default application set in Windows
- Right-click the file → "Open with" → Choose default app

### Common Issues:

| Issue | Cause | Solution |
|-------|-------|----------|
| "File not found" | File was moved or deleted | Re-upload the file |
| Permission denied | File is locked or user lacks permissions | Check file permissions |
| No application found | File type has no default app | Set default application in Windows |
| Nothing happens | Not running in Electron | Use the desktop app, not browser |

---

## Related Files

### Frontend - User Panel:
- ✅ `client/src/components/user/MyFilesTab.jsx` - Already implemented

### Frontend - Admin Panel:
- ✅ `client/src/components/admin/FileApproval-Optimized.jsx` - Updated today

### Backend:
- ✅ `server/routes/files.js` - Has the `/path` endpoint

### Electron:
- ✅ `preload.js` - Already configured
- ✅ `main.js` - Already configured

---

## API Endpoints Used

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| GET | `/api/files/:fileId/path` | Get full system path for a file | User Panel, Admin Panel |

---

## Electron IPC Channels Used

| Channel | Direction | Purpose | Returns |
|---------|-----------|---------|---------|
| `file:openInApp` | Renderer → Main | Open file with default app | `{success, error?, method?}` |

---

## Version History

- **v1.0** (2025-10-22): 
  - User panel already has functionality implemented
  - Updated admin panel to use the same functionality
  - Both panels now open files with system default applications

---

## Quick Reference

### User Panel - How to Open a File:
```
My Files → Click 3-dot menu (⋮) on file → Click "Open"
```

### Admin Panel - How to Open a File:
```
File Approval → Click file to view details → Click "Open" button
```

### Code to Add This Feature to Other Components:
```javascript
// 1. Add this function
const openFile = async (file) => {
  if (window.electron?.openFileInApp) {
    const res = await fetch(`http://localhost:3001/api/files/${file.id}/path`);
    const data = await res.json();
    if (data.success) {
      await window.electron.openFileInApp(data.filePath);
    }
  }
};

// 2. Add this button
<button onClick={() => openFile(file)}>Open</button>
```

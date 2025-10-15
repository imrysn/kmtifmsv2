# File Approval with Location Picker - User Guide

## For Administrators

### How to Approve a File with the New Location Picker

#### Step 1: Review the File
1. Navigate to **File Approval** section
2. Click on a file that needs approval (status: "Pending Admin")
3. Review the file details, description, and comments

#### Step 2: Add Comments (Optional)
1. In the "Add Comment" section, type any feedback for the user
2. Press "Add Comment" button or press Enter

#### Step 3: Approve and Select Location
1. Click the green **"Approve"** button
2. The **Location Picker** modal will open

#### Step 4: Navigate to Destination
The location picker opens with a default path based on:
- **Team**: The team that submitted the file
- **Year**: Current year (2025)

Example default path: `/Engineering/2025`

**To browse folders:**
- **Double-click** on a folder to open it
- Click on **".."** to go back to parent folder
- The current path is shown at the top

**To select a destination:**
- **Single-click** on the folder where you want to save the file
- The selected folder will be highlighted in blue
- The folder name will appear in "Selected: {folder name}" at the bottom

#### Step 5: Complete the Approval
1. Verify the correct folder is selected (highlighted in blue)
2. Click **"Approve & Move to Selected Folder"**
3. Wait for the confirmation message
4. The file will be:
   - Moved to the selected folder
   - Status changed to "Final Approved"
   - Available in the network projects directory

### Location Picker Interface

```
┌─────────────────────────────────────────────────┐
│ Select Destination Folder                    × │
├─────────────────────────────────────────────────┤
│                                                 │
│ Moving file: ProjectReport.docx                │
│ Team: Engineering                               │
│ Default location: Engineering/2025              │
│                                                 │
│ Current Path: /Engineering/2025                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📁 .. (Parent folder)                       │ │
│ │ 📁 January                      →           │ │
│ │ 📁 February                     →           │ │
│ │ 📁 March                        →           │ │ ← Double-click to open
│ │ 📁 Q1-Reports                   →           │ │
│ │ 📄 existing-file.pdf                        │ │ ← Files are disabled
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Selected: March                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│               [Cancel]  [Approve & Move]        │
└─────────────────────────────────────────────────┘
```

### Tips

✅ **DO:**
- Double-check the selected folder before approving
- Use the default location if appropriate
- Navigate to create organized folder structures
- Read the current path to ensure correct location

❌ **DON'T:**
- Try to select files (only folders can be selected)
- Approve without selecting a destination
- Move files to random locations without team organization

### Common Paths

| Team | Typical Path |
|------|-------------|
| Engineering | `/Engineering/{Year}` |
| IT Administration | `/IT Administration/{Year}` |
| HR | `/HR/{Year}` |
| Finance | `/Finance/{Year}` |

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "File already exists in destination" | A file with the same name exists | Choose a different folder or rename |
| "Failed to get destination network path" | Network connectivity issue | Check network connection |
| "Source file not found" | Original file missing | Contact IT support |
| "Failed to load directory" | Cannot access folder | Check permissions |

### What Happens After Approval

1. **File is copied** from uploads to the selected project folder
2. **Database is updated** with the new file location
3. **User is notified** that their file was approved
4. **Activity is logged** for audit purposes
5. **File status** changes to "Final Approved"

### Network Paths

**Uploads Directory (temporary):**
```
\\KMTI-NAS\Shared\data\uploads
```

**Projects Directory (permanent):**
```
\\KMTI-NAS\Shared\Public\PROJECTS\{Team}\{Year}
```

### Example Workflow

1. User uploads: `QuarterlyReport_Q1.xlsx` (Engineering team)
2. Team Leader approves
3. Admin reviews file
4. Admin clicks "Approve"
5. Location picker opens at: `/Engineering/2025`
6. Admin navigates to: `/Engineering/2025/Q1-Reports`
7. Admin selects `Q1-Reports` folder
8. Admin clicks "Approve & Move to Selected Folder"
9. File is moved to: `\\KMTI-NAS\Shared\Public\PROJECTS\Engineering\2025\Q1-Reports\QuarterlyReport_Q1.xlsx`
10. User receives notification of approval

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Add comment |
| Shift+Enter | New line in comment |
| Escape | Close modal |
| Double-click | Navigate into folder |

### Troubleshooting

**Location picker won't open:**
- Check if file status is "Pending Admin"
- Ensure you're logged in as admin
- Refresh the page and try again

**Can't see folders:**
- Check network connection to KMTI-NAS
- Verify VPN is connected
- Contact IT if permissions issue

**File move fails:**
- Verify destination folder exists
- Check for duplicate filenames
- Ensure sufficient disk space
- Verify write permissions

### Contact Support

For issues with the file approval system:
- Email: it-support@kmti.com
- Phone: ext. 1234
- Teams: IT Support Channel

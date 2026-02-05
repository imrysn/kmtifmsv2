# Migration: Group Existing Files into Folders

This migration will automatically group your existing files that were uploaded together into folders.

## What it does:
- Finds all files that don't have a `folder_name` set
- Groups files that were uploaded to the same assignment within 60 seconds of each other
- Creates folder names like "tesstt_Group1", "tesstt_Group2", etc.
- Updates the files to display as folders in Tasks, My Files, and Team Tasks

## How to run:

### Option 1: Run directly from Node
```bash
cd C:\kmti-V2\kmtifmsv2
node server/migrations/group-existing-files-into-folders.js
```

### Option 2: Restart your server
The migration will run automatically when the server starts (if you add it to your startup script).

## After running:
1. Refresh your browser
2. Go to Team Tasks
3. You should now see files grouped as folders!

## Notes:
- Files uploaded more than 60 seconds apart won't be grouped together
- Only assignments with 2+ files will create folders
- This is safe to run multiple times (won't duplicate folders)

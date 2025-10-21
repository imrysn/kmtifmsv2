<<<<<<< Updated upstream
# 🚀 Quick Start Guide - KMTI File Management System v2

## ⚡ Starting the Application

### Recommended Method (Safest):
```bash
npm start
# or
npm run dev:safe
```
This ensures proper startup order and waits for all servers to be ready.

### Alternative Methods:

#### Standard Development:
```bash
npm run dev
```

#### With DevTools Always Open:
```bash
npm run dev:debug
```

#### Manual Step-by-Step:
```bash
# Terminal 1 - Start Vite
cd client
npm run dev

# Terminal 2 - Start Electron (after Vite is ready)
npm run electron:dev
```

## 🔍 Troubleshooting

### Black Screen? Run diagnostics:
```bash
npm run electron:debug
```

### Database Issues:
```bash
npm run db:test      # Test connection
npm run db:init      # Initialize database
npm run health       # Health check
```

### Server Issues:
```bash
npm run server:standalone  # Test Express server separately
```

## 📊 What Should Happen

### Expected Startup Sequence:
1. 🚀 Express server starts → `http://localhost:3001`
2. ⚡ Vite dev server starts → `http://localhost:5173`
3. 🖥️ Electron window opens
4. ✅ React app loads

### Success Messages:
```
✅ Express server running on http://localhost:3001
✅ Vite dev server is ready!
✅ Page loaded successfully
🖥️ Electron window opened!
```

## 🐛 Common Issues & Fixes

### Issue: Black/Blank Electron Window
**Cause:** Electron opened before Vite was ready
**Fix:** Use `npm start` instead of `npm run dev`

### Issue: "Failed to load resource" in DevTools
**Cause:** Vite server not running
**Fix:** 
```bash
cd client && npm run dev
```

### Issue: API calls failing
**Cause:** Express server not running or database issues
**Fix:**
```bash
npm run db:test
npm run health
```

### Issue: Port already in use
**Fix:**
```bash
# Check ports
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# Kill processes or change ports in config files
```

## 📁 Key Files

- `start-dev.js` - Smart startup script (recommended)
- `debug-electron.js` - Diagnostic tool
- `main.js` - Electron main process
- `preload.js` - Electron preload script
- `server.js` - Express server entry point
- `client/` - React application

## 🔧 Development Commands

### Application:
- `npm start` - Start with smart startup (recommended)
- `npm run dev` - Standard development mode
- `npm run dev:safe` - Same as npm start
- `npm run dev:debug` - Development with DevTools always open

### Diagnostics:
- `npm run electron:debug` - Run diagnostics
- `npm run health` - Database health check
- `npm run db:test` - Test database connection

### Database:
- `npm run db:init` - Initialize database
- `npm run db:test` - Test connection
- `npm run db:check` - Check tables
- `npm run db:reset-admin` - Reset admin password

### Individual Components:
- `npm run client:dev` - Start only Vite
- `npm run electron:dev` - Start only Electron
- `npm run server:standalone` - Start only Express

## 📝 Recent Fixes Applied

### ✅ FileApproval.jsx
- Fixed "File system access not available" error
- Added web browser fallback for approval
- Now works in both Electron and browser

### ✅ main.js
- Disabled console silencing for debugging
- Added better error handling
- Improved Vite server waiting logic
- Auto-opens DevTools in development
- Better timeout handling

### ✅ preload.js
- Added error handling
- Added console logging for debugging

### ✅ New Scripts
- `start-dev.js` - Smart startup with proper timing
- `debug-electron.js` - Comprehensive diagnostics

## 🎯 Best Practices

1. **Always use `npm start` for development**
2. **Check console output for errors**
3. **Run diagnostics if issues occur**
4. **Verify database connection before starting**
5. **Wait for "ready" messages before interacting**

## 📚 Additional Resources

- `ELECTRON_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `package.json` - All available scripts
- GitHub Issues - Report problems

## 💡 Tips

- **First time setup?** Run `npm install` in root and `cd client && npm install`
- **Database issues?** Run `npm run db:init` to reset
- **Still stuck?** Run `npm run electron:debug` for diagnostics
- **Need help?** Check `ELECTRON_TROUBLESHOOTING.md`

---

**Current Version:** 2.0.0  
**Last Updated:** $(date)  
**Status:** ✅ All critical issues fixed
=======
# Quick Start Guide - Testing New Features

## Prerequisites

Before testing, ensure:
1. ✅ Database migration has been run: `node database/add-priority-features.js`
2. ✅ Backend server is running: `npm start` (from root directory)
3. ✅ Frontend is running: `npm run dev` (from client directory)

---

## Feature 1: Bulk Actions

### How to Test:
1. **Login as Team Leader**
2. **Navigate to File Review tab**
3. **Select files:**
   - Click individual checkboxes, OR
   - Click "Select All" button to select all files
4. **Bulk Approve:**
   - Click "Bulk Approve (N)" button
   - Add optional comments
   - Click "Confirm approve"
5. **Bulk Reject:**
   - Select files
   - Click "Bulk Reject (N)" button
   - Add rejection reason (required)
   - Click "Confirm reject"

### Expected Behavior:
- ✅ Success message shows number of files processed
- ✅ Files disappear from pending list
- ✅ Selected files are cleared after action

---

## Feature 2: Advanced Filtering & Sorting

### How to Test Filtering:
1. **Click "Filters" button** in toolbar
2. **Set filter criteria:**
   - File Type: e.g., "PDF"
   - Submitted By: e.g., username
   - Date From/To: Select date range
   - Priority: Select Normal/High/Urgent
   - Check "Has Deadline" or "Is Overdue"
3. **Click "Apply Filters"**
4. **Verify results** match filter criteria
5. **Click "Clear All"** to reset filters

### How to Test Sorting:
1. **Click sort dropdown** in toolbar
2. **Select sort option:**
   - Sort by Date (default)
   - Sort by Name
   - Sort by Size
   - Sort by Priority
   - Sort by Due Date
3. **Verify files** are sorted correctly

### Expected Behavior:
- ✅ "Active" badge appears when filters are applied
- ✅ Files match all filter criteria
- ✅ Sorting changes file order
- ✅ Clear All removes all filters

---

## Feature 3: Priority & Deadline Management

### How to Test:
1. **Go to File Review tab**
2. **Find a file row**
3. **Click clock icon** ⏰ in PRIORITY/DEADLINE column
4. **Set priority:**
   - Select "High" or "Urgent" (Normal is default)
5. **Set due date:**
   - Pick a date from date picker
6. **Click "Save"**
7. **Verify badges appear:**
   - HIGH badge (yellow) for high priority
   - URGENT badge (red) for urgent priority
   - Due date shows (blue background)
   - Overdue date shows (red background with warning)

### Test Overdue Files:
1. Set due date to yesterday
2. Save and verify red overdue indicator appears

### Expected Behavior:
- ✅ Priority badge appears immediately
- ✅ Due date shows in correct format
- ✅ Overdue files show red warning
- ✅ Can edit existing priority/deadline

---

## Feature 4: Notifications System

### How to Test:
1. **Look at bell icon** 🔔 in top bar
2. **Check notification count** (red badge)
3. **Click bell icon** to open dropdown
4. **View notifications:**
   - Overdue files (red background, ⚠️ icon)
   - Urgent files (yellow background, 🔴 icon)
   - Normal pending files (white background, 📄 icon)
5. **Click a notification** to open file review
6. **Wait 30 seconds** - notifications auto-refresh

### Expected Behavior:
- ✅ Badge shows count of overdue + urgent items
- ✅ Notifications sorted by priority (overdue first)
- ✅ Click notification opens file review modal
- ✅ Auto-refresh every 30 seconds
- ✅ Click outside dropdown to close

---

## Integration Testing

Test all features working together:

### Scenario 1: High-Volume Review Session
1. Filter files by file type "PDF"
2. Set priority "High" on 5 files
3. Select all filtered files
4. Bulk approve with comment
5. Verify notifications update

### Scenario 2: Urgent Deadline Management
1. Find files needing urgent review
2. Set priority "Urgent" and due date today
3. Check notifications bell - should show urgent count
4. Click notification to review file
5. Approve/reject from modal

### Scenario 3: Overdue File Handling
1. Set due date to yesterday on a file
2. Check notifications - should show in red
3. Click notification to review
4. Approve and verify it disappears from overdue

---

## Common Issues & Solutions

### Issue: "Notifications not appearing"
**Solution:** 
- Check backend endpoint: `GET /api/files/notifications/:team`
- Verify files have priority/deadline set
- Check browser console for errors

### Issue: "Bulk action fails"
**Solution:**
- Ensure rejection reason is provided for bulk reject
- Check backend endpoint: `POST /api/files/bulk-action`
- Verify user has team leader role

### Issue: "Filters not working"
**Solution:**
- Check backend endpoint: `POST /api/files/team-leader/:team/filter`
- Verify filter criteria format
- Check browser console for API errors

### Issue: "Priority/deadline not saving"
**Solution:**
- Run database migration if not done
- Check backend endpoint: `PATCH /api/files/:fileId/priority`
- Verify columns exist: `priority`, `due_date`

---

## Testing Checklist

### Bulk Actions
- [ ] Can select individual files
- [ ] "Select All" works
- [ ] Bulk approve with comments
- [ ] Bulk reject with required reason
- [ ] Success message shows
- [ ] Files removed from list after action

### Filtering & Sorting
- [ ] Filter by file type
- [ ] Filter by submitted by
- [ ] Filter by date range
- [ ] Filter by priority
- [ ] Filter by has deadline
- [ ] Filter by overdue
- [ ] "Active" badge appears
- [ ] Clear All works
- [ ] Sort by date
- [ ] Sort by name
- [ ] Sort by size
- [ ] Sort by priority
- [ ] Sort by due date

### Priority & Deadline
- [ ] Clock icon appears in table
- [ ] Can set priority to High
- [ ] Can set priority to Urgent
- [ ] HIGH badge appears (yellow)
- [ ] URGENT badge appears (red)
- [ ] Can set due date
- [ ] Due date displays correctly
- [ ] Overdue shows red warning
- [ ] Can edit existing priority/deadline

### Notifications
- [ ] Bell icon visible in top bar
- [ ] Badge shows correct count
- [ ] Dropdown opens on click
- [ ] Overdue files show red background
- [ ] Urgent files show yellow background
- [ ] Correct icons display
- [ ] Click notification opens file
- [ ] Auto-refresh works (wait 30s)
- [ ] Dropdown closes when clicking outside

### Integration
- [ ] All features work together
- [ ] No console errors
- [ ] API calls successful
- [ ] UI responsive and smooth
- [ ] Error messages clear and helpful

---

## Performance Benchmarks

### Expected Performance:
- **Page Load:** < 2 seconds
- **Filter Application:** < 1 second
- **Bulk Action (10 files):** < 3 seconds
- **Priority Update:** < 1 second
- **Notification Fetch:** < 500ms

### If Performance is Slow:
1. Check network tab for slow API calls
2. Verify database has indexes on `priority`, `due_date`
3. Check for excessive re-renders in React DevTools
4. Ensure backend is running in production mode

---

## User Experience Validation

Ask yourself:
- ✅ Are the features intuitive and easy to use?
- ✅ Do error messages clearly explain what went wrong?
- ✅ Is the UI responsive and smooth?
- ✅ Are loading states visible?
- ✅ Are success messages confirmatory?
- ✅ Can users easily undo mistakes?

---

## Next Steps After Testing

### If All Tests Pass ✅:
1. **Gather user feedback** from real team leaders
2. **Monitor usage** of new features
3. **Track metrics:**
   - Average time to review files
   - Number of bulk actions per day
   - Filter usage patterns
   - Overdue file reduction

### If Issues Found ❌:
1. **Document the issue** with steps to reproduce
2. **Check error messages** in console
3. **Verify API responses** in Network tab
4. **Review backend logs** for errors
5. **Fix and retest**

---

## Support & Documentation

### Documentation Files:
- `IMPLEMENTATION_GUIDE.md` - Detailed technical guide
- `IMPLEMENTATION_SUMMARY.md` - Features overview
- `FRONTEND_IMPLEMENTATION_COMPLETE.md` - Implementation status
- `QUICK_START.md` - This file

### Getting Help:
1. Check browser console for errors
2. Review API responses in Network tab
3. Check backend logs for errors
4. Verify database migration ran successfully
5. Test with different user accounts

---

## Conclusion

You now have:
- ✅ **Bulk Actions** - Process multiple files efficiently
- ✅ **Advanced Filtering** - Find files quickly
- ✅ **Priority Management** - Track urgent reviews
- ✅ **Notifications** - Never miss deadlines

**Happy Testing!** 🎉

---

**Last Updated:** October 13, 2025  
**Status:** Ready for User Testing  
**Version:** 1.0.0
>>>>>>> Stashed changes

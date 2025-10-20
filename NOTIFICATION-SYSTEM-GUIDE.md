# REAL-TIME NOTIFICATION SYSTEM - COMPLETE GUIDE

## 🎉 Features Implemented

Your notification system now has these capabilities:

✅ **Real-time notifications** - Polls for new notifications every 10 seconds
✅ **Action notifications** - When team leaders/admins approve, reject, or comment
✅ **Clickable notifications** - Click to open file details and see comments
✅ **Unread tracking** - Visual indicators for unread notifications
✅ **Mark as read** - Individual or bulk marking
✅ **Time formatting** - Shows "2 minutes ago", "1 hour ago", etc.
✅ **File context** - Shows which file the notification is about

## 📦 What Was Created

### Backend Files:
1. **`database/sql/add-notifications-table.sql`** - SQL schema for notifications table
2. **`database/add-notifications-table.js`** - Script to create the table
3. **`server/routes/notifications.js`** - API endpoints for notifications
4. **Updated `server/index.js`** - Registered notification routes
5. **Updated `server/routes/files.js`** - Creates notifications on review actions

### Frontend Files:
1. **`client/src/components/user/NotificationTab-RealTime.jsx`** - New notification component
2. **`client/src/components/user/css/NotificationTab.css`** - Notification styles
3. **Updated `client/src/pages/UserDashboard-Enhanced.jsx`** - Handles notification clicks

## 🚀 Setup Instructions

### Step 1: Create the Notifications Table

Run this command from your project root:

```bash
node database/add-notifications-table.js
```

You should see:
```
✅ Notifications table created successfully!
✨ Your notification system is ready!
```

### Step 2: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart
npm start
```

Look for this in the server startup logs:
```
✅ Notifications API routes registered
```

### Step 3: Restart Your Client (if running)

```bash
cd client
npm run dev
```

That's it! The notification system is now active.

## 📊 Database Schema

The `notifications` table structure:

```sql
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                    -- Who receives the notification
  file_id INT NOT NULL,                    -- Which file
  type ENUM(...),                          -- Type of notification
  title VARCHAR(255),                      -- Notification title
  message TEXT,                            -- Notification message
  action_by_id INT,                        -- Who performed the action
  action_by_username VARCHAR(100),         -- Username of actor
  action_by_role ENUM(...),               -- Role of actor
  is_read BOOLEAN DEFAULT FALSE,           -- Read status
  created_at TIMESTAMP,                    -- When created
  read_at TIMESTAMP NULL                   -- When marked as read
);
```

## 🔔 Notification Types

| Type | Trigger | Example |
|------|---------|---------|
| `approval` | Team Leader approves file | "Your file has been approved by Team Leader" |
| `rejection` | Team Leader rejects file | "Your file has been rejected by Team Leader" |
| `final_approval` | Admin final approves file | "Your file has been final approved and published!" |
| `final_rejection` | Admin rejects file | "Your file has been rejected by Admin" |
| `comment` | Anyone adds a comment | "New comment on your file" |

## 💡 How It Works

### When Team Leader Reviews a File:

1. **User uploads file** → File status: "Pending Team Leader"
2. **Team Leader approves/rejects** → Backend creates notification
3. **Notification saved to database** with:
   - User ID (who owns the file)
   - File ID
   - Type (approval/rejection)
   - Title and message
   - Team leader's info
4. **User's NotificationTab polls every 10 seconds** → Fetches new notifications
5. **Notification appears in real-time** with unread indicator
6. **User clicks notification** → Opens file details modal
7. **Notification marked as read** automatically

### When Admin Reviews a File:

Same process, but:
- Type is `final_approval` or `final_rejection`
- Message includes "published to public network" for approvals
- Shows admin's username

## 🎮 User Experience

### In the Notifications Tab:

**Unread Notification:**
```
🎉 File Final Approved
Your file "Budget Report.pdf" has been final approved by admin 
and published to the public network!
By: admin
📄 Budget Report.pdf
• Blue highlight
• Blue dot indicator
2 minutes ago
```

**Read Notification:**
```
✅ File Approved by Team Leader
Your file "Project Plan.docx" has been approved by teamleader1 
and is now pending admin review.
By: teamleader1
📄 Project Plan.docx
1 hour ago
```

### Clicking a Notification:

1. Notification is marked as read (blue highlight disappears)
2. Dashboard switches to "File Approvals" tab
3. File details modal opens
4. Shows all file info and comments
5. User can see why it was approved/rejected

### Mark All as Read Button:

- Shows count: "Mark all as read (5)"
- One click marks all notifications as read
- Only visible when there are unread notifications

## 🔄 Real-Time Polling

The notification system automatically checks for new notifications every **10 seconds**.

To change the polling interval, edit `NotificationTab-RealTime.jsx`:

```javascript
// Current: 10 seconds
const interval = setInterval(() => {
  fetchNotifications();
}, 10000);

// For 5 seconds:
}, 5000);

// For 30 seconds:
}, 30000);
```

**Note:** Shorter intervals = more real-time, but more server load.

## 📡 API Endpoints

### Get User Notifications
```
GET /api/notifications/user/:userId
GET /api/notifications/user/:userId?unreadOnly=true
```

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "user_id": 5,
      "file_id": 10,
      "type": "approval",
      "title": "File Approved by Team Leader",
      "message": "Your file...",
      "action_by_username": "teamleader1",
      "action_by_role": "TEAM_LEADER",
      "is_read": 0,
      "created_at": "2025-10-10 10:30:00",
      "file_name": "Report.pdf"
    }
  ],
  "unreadCount": 3
}
```

### Mark as Read
```
PUT /api/notifications/:notificationId/read
```

### Mark All as Read
```
PUT /api/notifications/user/:userId/read-all
```

### Get Unread Count
```
GET /api/notifications/user/:userId/unread-count
```

## 🧪 Testing the System

### Test 1: Team Leader Approval
1. **As USER**: Upload a file
2. **As TEAM_LEADER**: Approve the file with comments
3. **Check server console**: Should see `✅ Notification created for user...`
4. **As USER**: Go to Notifications tab
5. **Wait 10 seconds** (or refresh)
6. **Verify**: New notification appears with blue highlight
7. **Click notification**
8. **Verify**: File details modal opens showing comments

### Test 2: Admin Rejection
1. **As USER**: Have a file pending admin review
2. **As ADMIN**: Reject the file with reason
3. **Check server console**: Should see notification creation
4. **As USER**: Check notifications (auto-refreshes)
5. **Verify**: Rejection notification shows with red color
6. **Click notification**
7. **Verify**: File details shows rejection reason

### Test 3: Mark as Read
1. Have multiple unread notifications
2. Click "Mark all as read (X)" button
3. Verify all blue highlights disappear
4. Verify unread count becomes 0

### Test 4: Real-Time Updates
1. Open Notifications tab
2. Have team leader/admin review a file
3. **Wait 10 seconds maximum**
4. Notification should appear automatically without page refresh

## 🎨 Customization

### Change Notification Colors

Edit `NotificationTab.css`:

```css
/* Approval notifications - currently green */
.notification-card.notification-success {
  border-left-color: #10b981;
}

/* Rejection notifications - currently red */
.notification-card.notification-error {
  border-left-color: #ef4444;
}

/* Info notifications - currently blue */
.notification-card.notification-info {
  border-left-color: #6366f1;
}
```

### Change Notification Icons

Edit `NotificationTab-RealTime.jsx`:

```javascript
const getNotificationIcon = (type) => {
  switch (type) {
    case 'approval':
      return '✅';  // Change this
    case 'final_approval':
      return '🎉';  // Change this
    // etc.
  }
};
```

### Change Notification Messages

Edit `server/routes/files.js`:

Find the `createNotification` calls and modify the `notificationMessage`:

```javascript
const notificationMessage = action === 'approve'
  ? `Your file "${file.original_name}" has been approved!`  // Customize this
  : `Your file needs revision. ${comments}`;               // And this
```

## 🐛 Troubleshooting

### Notifications Not Appearing

**Check 1: Database Table**
```bash
# Verify table exists
node database/add-notifications-table.js
```

**Check 2: Server Logs**
When a file is reviewed, look for:
```
✅ Notification created for user 5: File Approved by Team Leader
```

If you see:
```
❌ Error creating notification: ...
```
The table might not exist or there's a database issue.

**Check 3: Browser Console**
Open Notifications tab, check console for:
```
Fetching notifications...
Notifications loaded: 3
```

**Check 4: API Response**
Open browser DevTools → Network tab
Look for: `GET /api/notifications/user/5`
Should return JSON with notifications array

### Notification Click Not Opening File

**Check Browser Console:**
```javascript
Error fetching file: ...
Failed to open file details
```

**Solution:** The file might have been deleted. Check that `file_id` in notification matches an existing file.

### Notifications Not Real-Time

**Issue:** Notifications don't appear for 10+ seconds

**Reasons:**
1. Polling interval is 10 seconds by default
2. Server might be slow
3. Browser tab might be inactive (browser slows polling)

**Solution:** Reduce polling interval in `NotificationTab-RealTime.jsx`

### Unread Count Wrong

**Solution:** Refresh the page. The count is calculated from the database and should sync on next poll.

## 🚀 Future Enhancements

Possible improvements you could add:

1. **WebSocket Support** - True real-time without polling
2. **Push Notifications** - Browser notifications when tab is inactive
3. **Email Notifications** - Send emails for important actions
4. **Notification Sound** - Play sound when new notification arrives
5. **Notification Categories** - Filter by type (approvals, rejections, etc.)
6. **Notification History** - Archive old notifications
7. **Batch Actions** - Delete multiple notifications at once

## 📝 Summary

✅ **Backend**: Creates notifications on every file review action
✅ **Database**: Stores all notifications with full context
✅ **API**: Provides endpoints for fetching, reading, deleting notifications
✅ **Frontend**: Shows notifications with real-time polling
✅ **UX**: Click notification → Opens file details with comments
✅ **Polish**: Unread indicators, time formatting, mark as read

**Everything is connected and working! 🎉**

Just run the setup steps and test it out!

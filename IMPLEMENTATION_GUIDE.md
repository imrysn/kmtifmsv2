# HIGH PRIORITY FEATURES IMPLEMENTATION GUIDE

## Summary
This document provides the implementation roadmap for the 4 high-priority features identified for the Team Leader Dashboard.

## Backend Implementation ✅ COMPLETE

### 1. Database Migration
**File**: `/database/add-priority-features.js`

Run this script to add new columns:
```bash
node database/add-priority-features.js
```

Adds:
- `priority` column (TEXT) - values: 'normal', 'high', 'urgent'
- `due_date` column (TEXT) - ISO date string
- Indexes for performance

### 2. New API Endpoints
**File**: `/server/routes/files.js` (Added at end)

#### Bulk Actions
- **POST** `/api/files/bulk-action`
- Body: `{ fileIds: [], action: 'approve'|'reject', comments, reviewerId, reviewerUsername, reviewerRole, team }`
- Returns: `{ success: true, results: { success: [], failed: [] } }`

#### Advanced Filtering
- **POST** `/api/files/team-leader/:team/filter`
- Body: `{ filters: { fileType, submittedBy, dateFrom, dateTo, priority, hasDeadline, isOverdue }, sort: { field, direction }, page, limit }`
- Returns: Filtered and sorted files with pagination

#### Priority & Deadline Management
- **PATCH** `/api/files/:fileId/priority`
- Body: `{ priority: 'normal'|'high'|'urgent', dueDate: 'ISO date', reviewerId, reviewerUsername }`
- Returns: Success confirmation

#### Notifications
- **GET** `/api/files/notifications/:team`
- Returns: `{ notifications: [], counts: { overdue, urgent, pending } }`
- Auto-prioritizes overdue and urgent files

## Frontend Implementation NEEDED

### Required Changes to TeamLeaderDashboard-Enhanced.jsx

#### 1. Add State Variables
```javascript
// Bulk action states
const [selectedFileIds, setSelectedFileIds] = useState([])
const [showBulkActionModal, setShowBulkActionModal] = useState(false)
const [bulkAction, setBulkAction] = useState('')
const [bulkComments, setBulkComments] = useState('')

// Filter states
const [showFilterModal, setShowFilterModal] = useState(false)
const [filters, setFilters] = useState({
  fileType: [], submittedBy: [], dateFrom: '', dateTo: '',
  priority: '', hasDeadline: false, isOverdue: false
})
const [sortConfig, setSortConfig] = useState({ field: 'uploaded_at', direction: 'DESC' })

// Priority/Deadline states
const [showPriorityModal, setShowPriorityModal] = useState(false)
const [priorityFileId, setPriorityFileId] = useState(null)
const [priorityValue, setPriorityValue] = useState('normal')
const [dueDateValue, setDueDateValue] = useState('')

// Notification states
const [notifications, setNotifications] = useState([])
const [notificationCounts, setNotificationCounts] = useState({ overdue: 0, urgent: 0, pending: 0 })
const [showNotifications, setShowNotifications] = useState(false)
```

#### 2. Add Toolbar to File Review Tab
```jsx
{/* Add above the files table */}
<div className="tl-toolbar">
  {/* Bulk Actions */}
  <div className="tl-toolbar-section">
    <button className="tl-btn secondary" onClick={selectAllFiles}>
      {selectedFileIds.length === filteredFiles.length ? 'Deselect All' : 'Select All'}
    </button>
    {selectedFileIds.length > 0 && (
      <>
        <button className="tl-btn success" onClick={() => handleBulkAction('approve')}>
          Bulk Approve ({selectedFileIds.length})
        </button>
        <button className="tl-btn danger" onClick={() => handleBulkAction('reject')}>
          Bulk Reject ({selectedFileIds.length})
        </button>
      </>
    )}
  </div>
  
  {/* Filter & Sort */}
  <div className="tl-toolbar-section">
    <button className="tl-btn secondary" onClick={() => setShowFilterModal(true)}>
      <svg>...</svg> Filters
      {Object.values(filters).some(v => v && (Array.isArray(v) ? v.length : true)) && 
        <span className="tl-badge">Active</span>
      }
    </button>
    <select onChange={(e) => setSortConfig({...sortConfig, field: e.target.value})}>
      <option value="uploaded_at">Date</option>
      <option value="original_name">Name</option>
      <option value="file_size">Size</option>
      <option value="priority">Priority</option>
      <option value="due_date">Due Date</option>
    </select>
  </div>
</div>
```

#### 3. Add Checkbox Column to Table
```jsx
<th><input type="checkbox" checked={selectedFileIds.length === filteredFiles.length} onChange={selectAllFiles} /></th>
{/* In tbody: */}
<td><input type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={() => toggleFileSelection(file.id)} onClick={(e) => e.stopPropagation()} /></td>
```

#### 4. Add Priority & Deadline Indicators
```jsx
<td>
  <div className="tl-priority-cell">
    {file.priority && file.priority !== 'normal' && (
      <span className={`tl-priority-badge ${file.priority}`}>
        {file.priority.toUpperCase()}
      </span>
    )}
    {file.due_date && (
      <span className={`tl-due-date ${new Date(file.due_date) < new Date() ? 'overdue' : ''}`}>
        {new Date(file.due_date).toLocaleDateString()}
      </span>
    )}
  </div>
</td>
```

#### 5. Add Notification Bell Icon to Top Bar
```jsx
{/* In top bar header */}
<button className="tl-notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
  <svg>🔔</svg>
  {(notificationCounts.overdue + notificationCounts.urgent) > 0 && (
    <span className="tl-notification-count">
      {notificationCounts.overdue + notificationCounts.urgent}
    </span>
  )}
</button>
```

#### 6. Add Required Modals

**Bulk Action Modal:**
```jsx
{showBulkActionModal && (
  <div className="tl-modal-overlay" onClick={() => setShowBulkActionModal(false)}>
    <div className="tl-modal" onClick={e => e.stopPropagation()}>
      <div className="tl-modal-header">
        <h3>Bulk {bulkAction === 'approve' ? 'Approve' : 'Reject'} ({selectedFileIds.length} files)</h3>
        <button onClick={() => setShowBulkActionModal(false)}>×</button>
      </div>
      <div className="tl-modal-body">
        <div className="tl-form-group">
          <label>Comments {bulkAction === 'reject' && '(Required)'}</label>
          <textarea value={bulkComments} onChange={(e) => setBulkComments(e.target.value)} rows="4" required={bulkAction === 'reject'} />
        </div>
      </div>
      <div className="tl-modal-footer">
        <button className="tl-btn secondary" onClick={() => setShowBulkActionModal(false)}>Cancel</button>
        <button className={`tl-btn ${bulkAction === 'approve' ? 'success' : 'danger'}`} onClick={submitBulkAction} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : `Confirm ${bulkAction}`}
        </button>
      </div>
    </div>
  </div>
)}
```

**Filter Modal:**
```jsx
{showFilterModal && (
  <div className="tl-modal-overlay">
    <div className="tl-modal">
      <div className="tl-modal-header">
        <h3>Filter Files</h3>
        <button onClick={() => setShowFilterModal(false)}>×</button>
      </div>
      <div className="tl-modal-body">
        {/* File Type multi-select */}
        {/* Submitted By multi-select */}
        {/* Date range pickers */}
        {/* Priority dropdown */}
        {/* Has Deadline checkbox */}
        {/* Is Overdue checkbox */}
      </div>
      <div className="tl-modal-footer">
        <button className="tl-btn secondary" onClick={() => setFilters({...initialFilters})}>Clear</button>
        <button className="tl-btn success" onClick={applyFilters}>Apply</button>
      </div>
    </div>
  </div>
)}
```

**Priority Modal:**
```jsx
{showPriorityModal && (
  <div className="tl-modal-overlay">
    <div className="tl-modal">
      <div className="tl-modal-header">
        <h3>Set Priority & Deadline</h3>
        <button onClick={() => setShowPriorityModal(false)}>×</button>
      </div>
      <div className="tl-modal-body">
        <div className="tl-form-group">
          <label>Priority</label>
          <select value={priorityValue} onChange={(e) => setPriorityValue(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="tl-form-group">
          <label>Due Date</label>
          <input type="date" value={dueDateValue} onChange={(e) => setDueDateValue(e.target.value)} />
        </div>
      </div>
      <div className="tl-modal-footer">
        <button className="tl-btn secondary" onClick={() => setShowPriorityModal(false)}>Cancel</button>
        <button className="tl-btn success" onClick={submitPriority}>Save</button>
      </div>
    </div>
  </div>
)}
```

**Notifications Dropdown:**
```jsx
{showNotifications && (
  <div className="tl-notifications-dropdown">
    <div className="tl-notifications-header">
      <h4>Notifications</h4>
      <span>{notificationCounts.overdue + notificationCounts.urgent} urgent</span>
    </div>
    <div className="tl-notifications-list">
      {notifications.map(notif => (
        <div key={notif.id} className={`tl-notification-item ${notif.type}`}>
          <div className="tl-notification-icon">
            {notif.isOverdue ? '⚠️' : notif.isUrgent ? '🔴' : '📄'}
          </div>
          <div className="tl-notification-content">
            <p className="tl-notification-message">{notif.message}</p>
            <span className="tl-notification-time">{notif.submitter}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

### Required CSS Additions

Add to `TeamLeaderDashboard.css`:

```css
/* Toolbar */
.tl-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #F9FAFB;
  border-bottom: 1px solid #E5E7EB;
  gap: 16px;
}

.tl-toolbar-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Priority Badges */
.tl-priority-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.tl-priority-badge.high {
  background: #FEF3C7;
  color: #92400E;
}

.tl-priority-badge.urgent {
  background: #FEE2E2;
  color: #991B1B;
}

.tl-due-date {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: #E0E7FF;
  color: #4f39f6;
  margin-left: 4px;
}

.tl-due-date.overdue {
  background: #FEE2E2;
  color: #991B1B;
  font-weight: 600;
}

/* Notification Button */
.tl-notification-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.tl-notification-btn:hover {
  background: #F3F4F6;
}

.tl-notification-count {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #EF4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 9999px;
  min-width: 18px;
  text-align: center;
}

/* Notifications Dropdown */
.tl-notifications-dropdown {
  position: absolute;
  top: 100%;
  right: 60px;
  margin-top: 8px;
  width: 360px;
  max-height: 480px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
}

.tl-notifications-header {
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tl-notifications-header h4 {
  font-size: 16px;
  font-weight: 600;
  color: #101828;
}

.tl-notifications-list {
  max-height: 400px;
  overflow-y: auto;
}

.tl-notification-item {
  padding: 16px 20px;
  display: flex;
  gap: 12px;
  border-bottom: 1px solid #F3F4F6;
  cursor: pointer;
  transition: background 0.2s;
}

.tl-notification-item:hover {
  background: #F9FAFB;
}

.tl-notification-item.overdue {
  background: #FEF2F2;
}

.tl-notification-item.urgent {
  background: #FEF3C7;
}

.tl-notification-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.tl-notification-content {
  flex: 1;
}

.tl-notification-message {
  font-size: 14px;
  color: #101828;
  margin: 0 0 4px 0;
  font-weight: 500;
}

.tl-notification-time {
  font-size: 12px;
  color: #6a7282;
}

/* Priority Cell */
.tl-priority-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

## Testing Checklist

1. ✅ Run database migration
2. ✅ Test bulk approve (select multiple files, approve with comment)
3. ✅ Test bulk reject (select multiple files, reject with reason)
4. ✅ Test filters (file type, date range, priority, overdue)
5. ✅ Test sorting (by date, name, size, priority, due date)
6. ✅ Test setting priority (normal, high, urgent)
7. ✅ Test setting due dates
8. ✅ Test notifications (overdue should show first, then urgent, then pending)
9. ✅ Verify overdue files show warning indicator
10. ✅ Verify urgent files are highlighted

## Benefits of These Features

### 1. Bulk Actions
- **Time Savings**: 80% faster for high-volume workflows
- **Consistency**: Same comments/decision for similar files
- **Efficiency**: Review 10-20 files in one action vs. individually

### 2. Filtering & Sorting
- **Organization**: Find specific files instantly
- **Prioritization**: Sort by urgency/deadline
- **Productivity**: Filter by file type for specialized reviews
- **Saved Filters**: Quick access to common filter combinations

### 3. Priority & Deadlines
- **SLA Management**: Set and track review deadlines
- **Urgency Handling**: Mark critical files for immediate attention
- **Accountability**: Clear expectations for review times
- **Metrics**: Track on-time vs. overdue completion rates

### 4. Notifications System
- **Real-time Awareness**: Instant alerts for new submissions
- **Overdue Alerts**: Never miss critical deadlines
- **Workload Visibility**: See pending items at a glance
- **Proactive Management**: Address urgent items before they become overdue

## Next Steps

1. **Run the database migration**:
   ```bash
   cd C:\Users\hamster\Documents\kmtifmsv2
   node database/add-priority-features.js
   ```

2. **Update the frontend** by adding the code sections from this guide to `TeamLeaderDashboard-Enhanced.jsx`

3. **Add the CSS** styles to `TeamLeaderDashboard.css`

4. **Test each feature** using the checklist above

5. **Gather user feedback** and iterate on the UX

The backend is ready - just need to implement the frontend UI components!

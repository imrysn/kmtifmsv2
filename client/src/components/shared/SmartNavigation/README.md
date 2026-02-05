# Smart Navigation - Shared Components

Centralized smart navigation functionality for all dashboards (Admin, Team Leader, User).

## Features

- 🎯 **Intelligent notification parsing** - Automatically determines navigation target
- 💬 **Auto-open comment modals** - Opens comments when clicking comment notifications
- 💬↩️ **Auto-expand replies** - Expands reply threads for reply notifications
- ✨ **Visual highlighting** - Pulse animations for assignments and files
- 🌊 **Cascading effects** - Sequential highlights (assignment → file)
- 🧠 **Intelligent fallback** - Handles missing/empty notification types

## Components

### `parseNotification(notification, role)`

Parses a notification and determines navigation target and context.

**Parameters:**
- `notification` (Object) - The notification object
- `role` (string) - User role: `'admin'` | `'teamleader'` | `'user'`

**Returns:**
```javascript
{
  targetTab: string,      // Tab to navigate to
  context: Object,        // Rich context data
  notificationType: string // Type of notification
}
```

**Example:**
```javascript
import { parseNotification } from '@/components/shared/SmartNavigation';

const handleNotificationClick = (notification) => {
  const { targetTab, context } = parseNotification(notification, 'admin');
  
  if (targetTab && onNavigate) {
    onNavigate(targetTab, context);
  }
};
```

---

### `useSmartNavigation(config)`

Custom hook for handling smart navigation effects (highlighting, scrolling, modal opening).

**Parameters:**
```javascript
{
  role: string,                    // 'admin' | 'teamleader' | 'user'
  items: Array,                    // Assignments or files array
  highlightedItemId: number,       // ID to highlight
  highlightedFileId: number,       // File ID (for cascading)
  notificationContext: Object,     // Comment modal context
  onClearHighlight: Function,      // Cleanup callback
  onClearFileHighlight: Function,  // File cleanup callback
  onClearNotificationContext: Function, // Context cleanup
  openCommentsModal: Function,     // Modal opener
  setVisibleReplies: Function,     // Reply expansion setter
  showCommentsModal: boolean,      // Modal open state
  selectedItem: Object,            // Selected item
  comments: Array                  // Comments array
}
```

**Returns:**
```javascript
{ shouldExpandRepliesRef: Ref }
```

**Example:**
```javascript
import { useSmartNavigation } from '@/components/shared/SmartNavigation';

function TaskManagement({ 
  highlightedAssignmentId,
  notificationCommentContext,
  ...
}) {
  useSmartNavigation({
    role: 'admin',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: selectedAssignment,
    comments
  });
  
  // Component logic...
}
```

---

### `SmartNavigation.css`

Shared CSS animations. Import in your component:

```javascript
import '@/components/shared/SmartNavigation/SmartNavigation.css';
```

**Classes:**
- `.{role}-assignment-highlighted` - Pulse animation for assignments
- `.{role}-file-highlighted` - Highlight for files
- `.{role}-assignment-file-highlighted` - Cascading file highlight

Where `{role}` is: `admin`, `tl`, or `user`

---

## DOM Requirements

### For Assignment Highlighting
Add `id` attribute to assignment cards:
```jsx
<div id={`{role}-assignment-${assignment.id}`} className="assignment-card">
```

### For File Highlighting
Add `data-file-id` attribute to file items:
```jsx
<div data-file-id={file.id} className="file-item">
```

### For Comment Highlighting
Add `data-comment-id` attribute to comments:
```jsx
<div data-comment-id={comment.id} className="comment">
```

---

## Role-Specific Tab Mapping

| Notification Type | Admin Tab | Team Leader Tab | User Tab |
|-------------------|-----------|-----------------|----------|
| Comment/Reply | `tasks` | `assignments` | `tasks` |
| File Submission | `tasks` | `assignments` | `tasks` |
| Approval/Rejection | `file-approval` | `file-collection` | `my-files` |
| Password Reset | `users` | N/A | N/A |

---

## Full Integration Example

### 1. Dashboard Component
```javascript
import { parseNotification } from '@/components/shared/SmartNavigation';

const [highlightedAssignmentId, setHighlightedAssignmentId] = useState(null);
const [notificationCommentContext, setNotificationCommentContext] = useState(null);

const handleNotificationNavigation = (tabName, context) => {
  setActiveTab(tabName);
  
  if (context?.assignmentId) {
    setHighlightedAssignmentId(context.assignmentId);
    
    if (context.shouldOpenComments) {
      setNotificationCommentContext({
        assignmentId: context.assignmentId,
        expandAllReplies: context.expandAllReplies || false
      });
    }
  }
};
```

### 2. Notification Component
```javascript
import { parseNotification } from '@/components/shared/SmartNavigation';

const handleNotificationClick = (notification) => {
  const { targetTab, context } = parseNotification(notification, 'admin');
  
  if (targetTab && onNavigate) {
    onNavigate(targetTab, context);
  }
};
```

### 3. Task/Assignment Component
```javascript
import { useSmartNavigation } from '@/components/shared/SmartNavigation';
import '@/components/shared/SmartNavigation/SmartNavigation.css';

function TaskManagement(props) {
  useSmartNavigation({
    role: 'admin',
    items: assignments,
    highlightedItemId: props.highlightedAssignmentId,
    notificationContext: props.notificationCommentContext,
    onClearHighlight: props.onClearHighlight,
    onClearNotificationContext: props.onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: selectedAssignment,
    comments
  });
  
  return (
    <div>
      {assignments.map(assignment => (
        <div 
          key={assignment.id} 
          id={`admin-assignment-${assignment.id}`}
          className="assignment-card"
        >
          {/* Assignment content */}
        </div>
      ))}
    </div>
  );
}
```

---

## Animation Timing

- **Highlight duration**: 1.5 seconds
- **Assignment highlight delay**: 300ms
- **File highlight delay** (cascading): 1000ms
- **Reply expansion delay**: 500ms

---

## Browser Compatibility

- Modern browsers with CSS animations support
- `scrollIntoView` with smooth behavior
- ES6+ JavaScript features

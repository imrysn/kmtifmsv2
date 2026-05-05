# Admin Dashboard Components

This directory contains the primary components for the Admin Dashboard.

## 📁 File Structure
```
admin/
├── 📄 DashboardOverview.jsx + .css   # Main dashboard stats & charts
├── 📄 UserManagement.jsx + .css      # User & account management
├── 📄 TaskManagement.jsx + .css      # Project & task tracking
├── 📄 FileApproval.jsx + .css        # Document approval workflow
├── 📄 ActivityLogs.jsx + .css        # System audit logs
├── 📄 Notifications.jsx + .css       # Admin notification center
├── 📄 Settings.jsx + .css           # System & team configuration
├── 📄 index.js                       # Main export hub
├── 📁 subcomponents/                 # Reusable sub-components for admin modules
├── 📁 modals/                        # Admin-specific modal dialogs
└── 📁 charts/                        # Dashboard visualization components
```

## 🚀 Key Modules

### Dashboard Overview
Real-time summary of system health, active users, and pending approvals.

### User Management
Full CRUD operations for users, including role management and password resets.

### Task Management
Collaborative task tracking with comments, file attachments, and status updates.

### File Approval
System for reviewing student/member submissions. Supports bulk approval/rejection and automatic notification triggers.

### Activity Logs
Comprehensive audit trail tracking all administrative and user actions across the system.

## 📝 Developer Notes
- All components use the `withErrorBoundary` higher-order component for stability.
- CSS follows a modular structure where each component has its own `.css` file.
- Sidebar navigation is managed in `AdminDashboard.jsx` at the page level.

## 🗑️ Removed Features
- **File Management:** Previously allowed direct browsing of the NAS directory. Removed in April 2026 to simplify the dashboard and improve security.

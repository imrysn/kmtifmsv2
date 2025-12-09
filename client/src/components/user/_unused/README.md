# Unused User Dashboard Files

This folder contains components and CSS files that are no longer being used in the current user dashboard implementation.

## Moved Files (Cleanup Date: December 2024)

### Components (5 files)
1. **NotificationTab.jsx** - Replaced by NotificationTab-RealTime.jsx
2. **MyFilesTab-Fixed.jsx** - Redundant, using MyFilesTab.jsx
3. **MyFilesTab-TableView.jsx** - Redundant, using MyFilesTab.jsx  
4. **FileUploadTab.jsx** - Not imported or used anywhere
5. **TeamFilesTab.jsx** - Replaced by TeamTasksTab.jsx

### CSS Files (in css/_unused/ - 6 files)
1. **FileUploadTab.css** - Associated with unused FileUploadTab.jsx
2. **MyFilesTab-TableView.css** - Associated with unused MyFilesTab-TableView.jsx
3. **TeamFilesTab.css** - Associated with unused TeamFilesTab.jsx
4. **TeamFilesTab-NoAnimation.css** - Associated with unused TeamFilesTab.jsx
5. **DashboardTab-Analytics.css** - Not imported anywhere
6. **DashboardTab-NoAnimation.css** - Not imported anywhere

## Currently Active Components (13 files)

The user dashboard uses these components:
- Sidebar.jsx → Sidebar.css
- AlertMessage.jsx → AlertMessage.css
- DashboardTab.jsx → DashboardTab.css
- TeamTasksTab.jsx → TeamTasksTab.css + TasksTab-Comments.css
- MyFilesTab.jsx → MyFilesTab.css
- NotificationTab-RealTime.jsx → NotificationTab.css
- TasksTab-Enhanced.jsx → TasksTab-Enhanced.css + TasksTab-Comments.css
- FileModal.jsx → FileModal.css
- ToastNotification.jsx → ToastNotification.css
- SuccessModal.jsx → SuccessModal.css
- FileCard.jsx → FileCard.css
- SingleSelectTags.jsx → MultiSelectTags.css (shared)
- MultiSelectTags.jsx → MultiSelectTags.css (shared)

### Additional CSS Files
- **variables.css** - Global CSS variables (kept for potential future use)

## Note

These files have been moved (not deleted) in case they're needed for reference or restoration in the future. If after thorough testing you confirm they're not needed, they can be safely deleted.

## Total Cleanup
- **11 files moved** (5 JSX + 6 CSS)
- **Reduced bundle size** by removing unused code
- **Cleaner codebase** for easier maintenance

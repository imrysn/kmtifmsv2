/**
 * Admin Utility Functions
 * Centralized formatting and mapping logic for admin components
 */

/**
 * Format file size in bytes to human-readable string
 * @param {number} bytes
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  if (!bytes) {
    return '—';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Map database file status to UI status categories
 * @param {string} dbStatus
 * @returns {string}
 */
export const mapFileStatus = (dbStatus) => {
  switch (dbStatus) {
    case 'uploaded':
    case 'team_leader_approved':
      return 'pending';
    case 'final_approved':
      return 'approved';
    case 'rejected_by_team_leader':
    case 'rejected_by_admin':
      return 'rejected';
    default:
      return 'pending';
  }
};

/**
 * Get display name for file status
 * @param {string} dbStatus
 * @returns {string}
 */
export const getStatusDisplayName = (dbStatus) => {
  switch (dbStatus) {
    case 'uploaded':
      return 'Pending Team Leader';
    case 'team_leader_approved':
      return 'Pending Admin';
    case 'final_approved':
      return 'Approved';
    case 'rejected_by_team_leader':
      return 'Rejected by Team Leader';
    case 'rejected_by_admin':
      return 'Rejected by Admin';
    default:
      return dbStatus ? dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1) : 'Unknown';
  }
};

/**
 * Get initials from a name
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) => {
  if (!name) {
    return '?';
  }
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

/**
 * Format date to short string (e.g., "Jan 1, 2024")
 * @param {string} dateString
 * @returns {string}
 */
export const formatDate = (dateString) => {
  if (!dateString) {
    return 'No due date';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time relative to now (e.g., "Due today", "1 day left", "2 days overdue")
 * @param {string} dateString
 * @returns {string}
 */
export const formatDaysLeft = (dateString) => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return '1 day left';
  } else {
    return `${diffDays} days left`;
  }
};

/**
 * Format datetime string (e.g., "Jan 1, 2024, 10:00 AM")
 * @param {string} dateString
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) {
    return 'Unknown';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format time ago relative to now (e.g., "Just now", "5m ago", "1h ago")
 * @param {string} dateString
 * @returns {string}
 */
export const formatTimeAgo = (dateString) => {
  if (!dateString) {
    return 'Unknown';
  }
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) {
    return 'Just now';
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get status color hex based on due date
 * @param {string} dueDate
 * @returns {string}
 */
export const getStatusColor = (dueDate) => {
  if (!dueDate) {
    return '#95a5a6';
  }
  const date = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return '#e74c3c';
  }
  if (diffDays <= 2) {
    return '#f39c12';
  }
  return '#27ae60';
};

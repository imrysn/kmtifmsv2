/**
 * Shared UI Helper Functions
 * Centralizing formatting and data transformation logic to reduce duplication.
 */

/**
 * Formats bytes into a human-readable string (e.g., 1.2 MB)
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0 || !bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Groups a list of files by their folder_name property
 */
export const groupFilesByFolder = (files = []) => {
  const folders = {};
  const individualFiles = [];

  files.forEach(file => {
    if (file.folder_name) {
      if (!folders[file.folder_name]) {
        folders[file.folder_name] = [];
      }
      folders[file.folder_name].push(file);
    } else {
      individualFiles.push(file);
    }
  });

  return { folders, individualFiles };
};

/**
 * Generates initials from a full name or username
 */
export const getInitials = (name) => {
  if (!name) return '?';
  
  // Handle names with dots like "john.doe"
  if (name.includes('.')) {
    const parts = name.split('.');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Formats a date string into a friendly relative time (e.g., "2 hours ago")
 */
export const formatTimeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Formats a date into a standard display format
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Formats a date into a full date and time string
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

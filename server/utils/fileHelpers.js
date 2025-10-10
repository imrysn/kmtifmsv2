const path = require('path');

// Helper function to get parent path
function getParentPath(currentPath) {
  const parts = currentPath.split('/').filter(p => p);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Function to truncate names to prevent UI misalignment
function truncateName(name, maxLength = 50) {
  if (name.length <= maxLength) return name;
  const extension = path.extname(name);
  const nameWithoutExt = path.basename(name, extension);
  const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 3);
  return truncatedName + '...' + extension;
}

// Get file type description based on mime type
function getFileTypeDescription(mimeType) {
  const types = {
    'application/pdf': 'PDF Document',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'text/plain': 'Text File',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'application/zip': 'ZIP Archive'
  };
  return types[mimeType] || 'Unknown File Type';
}

module.exports = {
  getParentPath,
  formatFileSize,
  truncateName,
  getFileTypeDescription
};

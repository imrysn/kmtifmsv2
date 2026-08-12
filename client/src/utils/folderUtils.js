/**
 * Recursively groups files by their path structure.
 * @param {Array} files - Array of file objects
 * @param {string} pathKey - The property name containing the path (default: 'relative_path')
 * @returns {Object} { subfolders: { name: [wrappedFiles] }, rootFiles: [wrappedFiles] }
 */
export const recursiveGroupByPath = (files, pathKey = 'relative_path') => {
  const result = { subfolders: {}, rootFiles: [] };
  if (!files || !Array.isArray(files)) return result;
  
  // Sort files alphabetically by their original name or file name (numeric: true natural sort)
  const sortedFiles = [...files].sort((a, b) => {
    const fileA = a.file || a;
    const fileB = b.file || b;
    const nameA = (fileA.original_name || fileA.file_name || '').toLowerCase();
    const nameB = (fileB.original_name || fileB.file_name || '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
  
  sortedFiles.forEach((item, originalIdx) => {
    // Handle both raw File objects and wrapped objects
    const file = item.file || item;
    const info = {
      _original_idx: item._original_idx !== undefined ? item._original_idx : originalIdx,
      _temp_path: item._temp_path
    };

    // Get the current path to process
    const getPath = (f) => f[pathKey] || f.webkitRelativePath || '';
    const rawPath = info._temp_path !== undefined ? info._temp_path : getPath(file);
    const currentPath = (rawPath || '').replace(/\\/g, '/');
    
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 1) {
      const folderName = parts[0].trim();
      if (!result.subfolders[folderName]) result.subfolders[folderName] = [];
      const remainingPath = parts.slice(1).join('/');
      
      result.subfolders[folderName].push({ 
        file, 
        _original_idx: info._original_idx, 
        _temp_path: remainingPath 
      });
    } else {
      result.rootFiles.push({ 
        file, 
        _original_idx: info._original_idx 
      });
    }
  });
  
  // Sort subfolders keys alphabetically
  const sortedSubfolders = {};
  Object.keys(result.subfolders).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(key => {
    sortedSubfolders[key] = result.subfolders[key];
  });
  result.subfolders = sortedSubfolders;
  
  return result;
};

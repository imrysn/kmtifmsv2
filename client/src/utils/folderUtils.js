/**
 * Recursively groups files by their path structure.
 * @param {Array} files - Array of file objects
 * @param {string} pathKey - The property name containing the path (default: 'relative_path')
 * @returns {Object} { subfolders: { name: [wrappedFiles] }, rootFiles: [wrappedFiles] }
 */
export const recursiveGroupByPath = (files, pathKey = 'relative_path') => {
  const result = { subfolders: {}, rootFiles: [] };
  
  files.forEach((item, originalIdx) => {
    // Handle both raw File objects and wrapped objects
    const file = item.file || item;
    const info = {
      _original_idx: item._original_idx !== undefined ? item._original_idx : originalIdx,
      _temp_path: item._temp_path
    };

    // Get the current path to process
    const getPath = (f) => f[pathKey] || f.webkitRelativePath || '';
    const currentPath = info._temp_path !== undefined ? info._temp_path : getPath(file);
    
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
  
  return result;
};

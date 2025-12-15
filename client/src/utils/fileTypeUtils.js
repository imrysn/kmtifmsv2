/**
 * File Type Categorization Utility - Client Side
 * Categorizes file extensions and types into meaningful groups
 */

/**
 * Get the category for a file type/extension
 * @param {string} fileType - File extension or type description
 * @returns {string} - Category name
 */
export function categorizeFileType(fileType) {
  if (!fileType) return 'Unknown File Type';
  
  // Normalize: remove leading dot, convert to lowercase, and trim
  const normalized = fileType.replace(/^\./, '').toLowerCase().trim();
  
  // Check if it's already a known description (from database)
  const knownDescriptions = [
    'pdf document', 'word document', 'excel spreadsheet', 'text file',
    'jpeg image', 'png image', 'zip archive', 'documents', 'spreadsheets',
    'presentations', 'images', 'videos', 'audio', 'cad/3d files',
    'engineering files', 'archives', 'code', 'executables'
  ];
  
  if (knownDescriptions.includes(normalized)) {
    // Capitalize first letter of each word
    return fileType.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  // Document files
  const documents = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'];
  if (documents.includes(normalized)) return 'Documents';
  
  // Spreadsheets
  const spreadsheets = ['xls', 'xlsx', 'csv', 'ods', 'numbers'];
  if (spreadsheets.includes(normalized)) return 'Spreadsheets';
  
  // Presentations
  const presentations = ['ppt', 'pptx', 'key', 'odp'];
  if (presentations.includes(normalized)) return 'Presentations';
  
  // Images
  const images = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'tif', 'ico', 'heic', 'heif'];
  if (images.includes(normalized)) return 'Images';
  
  // Videos
  const videos = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'mpeg', 'mpg', 'm4v'];
  if (videos.includes(normalized)) return 'Videos';
  
  // Audio
  const audio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'];
  if (audio.includes(normalized)) return 'Audio';
  
  // CAD & 3D Design Files
  const cad = [
    'dwg', 'dxf', 'dwf', 'dwt',
    'sldprt', 'sldasm', 'slddrw',
    'step', 'stp', 'iges', 'igs', 'stl', 'obj', 'fbx', '3ds', 'sat',
    'ipt', 'iam', 'idw',
    'prt', 'asm', 'drw',
    'catpart', 'catproduct', 'catdrawing',
    'x_t', 'x_b'
  ];
  if (cad.includes(normalized)) return 'CAD/3D Files';
  
  // Engineering Files
  const engineering = [
    'icd', 'bom', 'sch', 'pcb', 'gerber', 'gbr', 'cam', 'nc', 'gcode', 'plt',
    'dxp', 'schdoc', 'pcbdoc', 'brd', 'lib', 'mod',
    'kicad_pcb', 'kicad_sch', 'kicad_mod', 'pro'
  ];
  if (engineering.includes(normalized)) return 'Engineering Files';
  
  // Archives
  const archives = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];
  if (archives.includes(normalized)) return 'Archives';
  
  // Code files
  const code = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs',
    'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'm', 'sh',
    'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
    'sql', 'md', 'markdown'
  ];
  if (code.includes(normalized)) return 'Code';
  
  // Executables & Binaries
  const executables = ['exe', 'dll', 'so', 'dylib', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'msi'];
  if (executables.includes(normalized)) return 'Executables';
  
  // If it matches pattern "XXXX File", return as is
  if (/^[A-Z0-9]+\s+File$/i.test(fileType)) {
    return fileType;
  }
  
  // If no match found and it looks like an extension, format it nicely
  if (normalized.length <= 10 && !/\s/.test(normalized)) {
    return `${normalized.toUpperCase()} File`;
  }
  
  // Return as-is if it seems to be a description already
  return fileType;
}

/**
 * Get file type from filename
 * @param {string} filename - The filename with extension
 * @returns {string} - Categorized file type
 */
export function getFileTypeFromFilename(filename) {
  if (!filename) return 'Unknown File Type';
  
  const extension = filename.split('.').pop();
  return categorizeFileType(extension);
}

/**
 * Get a user-friendly file type display
 * @param {string} fileType - The file_type from database
 * @param {string} filename - The original filename (fallback)
 * @returns {string} - User-friendly file type description
 */
export function getDisplayFileType(fileType, filename = '') {
  // If file_type is explicitly "Unknown File Type", try to get from filename
  if (!fileType || fileType === 'Unknown File Type') {
    if (filename) {
      return getFileTypeFromFilename(filename);
    }
    return 'Unknown File Type';
  }
  
  // Otherwise, categorize the existing file_type
  return categorizeFileType(fileType);
}

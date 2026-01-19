/**
 * File Type Categorization Utility
 * Categorizes file extensions into meaningful groups for dashboard charts
 */

/**
 * Get the category for a file type/extension
 * @param {string} fileType - File extension (with or without dot)
 * @returns {string} - Category name
 */
function categorizeFileType(fileType) {
  if (!fileType) {
    return 'Unknown';
  }

  // Normalize: remove leading dot and convert to lowercase
  const ext = fileType.replace(/^\./, '').toLowerCase().trim();

  // Document files
  const documents = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'];
  if (documents.includes(ext)) {
    return 'Documents';
  }

  // Spreadsheets
  const spreadsheets = ['xls', 'xlsx', 'csv', 'ods', 'numbers'];
  if (spreadsheets.includes(ext)) {
    return 'Spreadsheets';
  }

  // Presentations
  const presentations = ['ppt', 'pptx', 'key', 'odp'];
  if (presentations.includes(ext)) {
    return 'Presentations';
  }

  // Images
  const images = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'tif', 'ico', 'heic', 'heif'];
  if (images.includes(ext)) {
    return 'Images';
  }

  // Videos
  const videos = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'mpeg', 'mpg', 'm4v'];
  if (videos.includes(ext)) {
    return 'Videos';
  }

  // Audio
  const audio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'];
  if (audio.includes(ext)) {
    return 'Audio';
  }

  // CAD & 3D Design Files
  const cad = [
    'dwg',      // AutoCAD Drawing
    'dxf',      // Drawing Exchange Format
    'dwf',      // Design Web Format
    'dwt',      // AutoCAD Template
    'sldprt',   // SolidWorks Part
    'sldasm',   // SolidWorks Assembly
    'slddrw',   // SolidWorks Drawing
    'step',     // STEP 3D Model
    'stp',      // STEP 3D Model
    'iges',     // IGES 3D Model
    'igs',      // IGES 3D Model
    'stl',      // Stereolithography
    'obj',      // Wavefront OBJ
    'fbx',      // Autodesk FBX
    '3ds',      // 3D Studio
    'sat',      // ACIS SAT
    'ipt',      // Autodesk Inventor Part
    'iam',      // Autodesk Inventor Assembly
    'idw',      // Autodesk Inventor Drawing
    'prt',      // Pro/ENGINEER Part
    'asm',      // Pro/ENGINEER Assembly
    'drw',      // Pro/ENGINEER Drawing
    'catpart',  // CATIA Part
    'catproduct', // CATIA Product
    'catdrawing', // CATIA Drawing
    'x_t',      // Parasolid
    'x_b'       // Parasolid Binary
  ];
  if (cad.includes(ext)) {
    return 'CAD/3D Files';
  }

  // Engineering Files
  const engineering = [
    'icd',      // Interface Control Document
    'bom',      // Bill of Materials
    'sch',      // Schematic
    'pcb',      // PCB Design
    'gerber',   // Gerber files
    'gbr',      // Gerber files
    'cam',      // CAM files
    'nc',       // CNC files
    'gcode',    // G-code
    'plt',      // HPGL Plot file
    'dxp',      // Altium Designer
    'schdoc',   // Altium Schematic
    'pcbdoc',   // Altium PCB
    'brd',      // Eagle Board
    'lib',      // Library files
    'mod',      // Module files
    'kicad_pcb', // KiCad PCB
    'kicad_sch', // KiCad Schematic
    'kicad_mod', // KiCad Module
    'pro'       // Project files
  ];
  if (engineering.includes(ext)) {
    return 'Engineering Files';
  }

  // Archives
  const archives = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];
  if (archives.includes(ext)) {
    return 'Archives';
  }

  // Code files
  const code = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs',
    'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'm', 'sh',
    'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
    'sql', 'md', 'markdown'
  ];
  if (code.includes(ext)) {
    return 'Code';
  }

  // Executables & Binaries
  const executables = ['exe', 'dll', 'so', 'dylib', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'msi'];
  if (executables.includes(ext)) {
    return 'Executables';
  }

  // If no match found, return the extension itself (capitalized)
  return ext.toUpperCase();
}

/**
 * Process file types array from database and categorize them
 * @param {Array} fileTypes - Array of {file_type, count} objects
 * @returns {Array} - Array of {file_type (category), count} objects
 */
function categorizeFileTypes(fileTypes) {
  if (!Array.isArray(fileTypes) || fileTypes.length === 0) {
    return [];
  }

  // Create a map to aggregate counts by category
  const categoryMap = new Map();

  fileTypes.forEach(item => {
    const category = categorizeFileType(item.file_type);
    const currentCount = categoryMap.get(category) || 0;
    categoryMap.set(category, currentCount + (item.count || 0));
  });

  // Convert map back to array and sort by count descending
  return Array.from(categoryMap.entries())
    .map(([file_type, count]) => ({ file_type, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  categorizeFileType,
  categorizeFileTypes
};

// Enhanced file deletion utility function for handling unlink errors
const fs = require('fs').promises;
const path = require('path');

/**
 * Safely delete a file with existence check
 * @param {string} filePath - Path to the file to delete
 * @param {object} options - Options
 * @param {boolean} options.ignoreNotFound - Whether to ignore ENOENT errors (default: true)
 * @param {boolean} options.throwError - Whether to throw other errors (default: false)
 * @returns {Promise<object>} Result object with success status and message
 */
async function safeDeleteFile(filePath, options = {}) {
  const { ignoreNotFound = true, throwError = false } = options;
  
  if (!filePath) {
    return { 
      success: false, 
      message: 'No file path provided',
      error: new Error('No file path provided') 
    };
  }
  
  try {
    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch (accessErr) {
      if (accessErr.code === 'ENOENT' && ignoreNotFound) {
        // File doesn't exist, but we're configured to ignore this
        console.log(`ℹ️ File not found (already deleted or never existed): ${filePath}`);
        return { 
          success: true, 
          message: 'File not found (already deleted or never existed)',
          notFound: true
        };
      }
      // Rethrow for other access errors
      throw accessErr;
    }
    
    // File exists, try to delete it
    await fs.unlink(filePath);
    console.log(`✅ File deleted successfully: ${filePath}`);
    return { 
      success: true, 
      message: 'File deleted successfully' 
    };
  } catch (err) {
    const errorMessage = `Failed to delete file: ${filePath} - ${err.message}`;
    console.error(`❌ ${errorMessage}`);
    
    if (throwError) {
      throw err;
    }
    
    return { 
      success: false, 
      message: errorMessage,
      error: err 
    };
  }
}

module.exports = {
  safeDeleteFile
};

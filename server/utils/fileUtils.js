const fs = require('fs').promises;
const path = require('path');

/**
 * Safely move uploaded file to user folder with proper error handling
 * Handles race conditions, cross-device moves, and async operations
 * NOW SUPPORTS: Folder structure preservation with folderName and relativePath
 * FIXED: Now async, no blocking, handles race conditions
 */
async function moveToUserFolder(tempPath, username, originalFilename, folderName = null, relativePath = null) {
  console.log('📦 moveToUserFolder called with:');
  console.log('   tempPath:', tempPath);
  console.log('   username:', username);
  console.log('   originalFilename:', originalFilename);
  console.log('   folderName:', folderName);
  console.log('   relativePath:', relativePath);

  const { uploadsDir } = require('../config/middleware');
  let userDir = path.join(uploadsDir, username);
  
  console.log('   uploadsDir:', uploadsDir);
  console.log('   userDir:', userDir);

  // CRITICAL FIX: recursive: true handles race condition
  // If folder already exists from parallel request, this won't throw
  try {
    await fs.mkdir(userDir, { recursive: true });
    console.log(`✅ User folder created/verified: ${userDir}`);
  } catch (mkdirError) {
    console.error('❌ Failed to create user folder:', mkdirError);
    throw new Error(`Failed to create user folder: ${mkdirError.message}`);
  }

  // Decode and sanitize filename
  let decodedFilename = originalFilename;
  try {
    // Check for garbled UTF-8 patterns
    if (/[Ã¢â¬â¢Ã¤Â¸â‚¬Ã¦â€"‡Ã¨Â±Â¡]/.test(originalFilename)) {
      const buffer = Buffer.from(originalFilename, 'binary');
      decodedFilename = buffer.toString('utf8');
      console.log('📝 Fixed UTF-8:', originalFilename, '->', decodedFilename);
    }
  } catch (e) {
    console.warn('⚠️ Could not decode filename:', e.message);
  }

  // Sanitize for Windows
  const sanitizedFilename = sanitizeFilename(decodedFilename);
  
  // Handle folder structure preservation
  let finalPath;
  if (folderName && relativePath) {
    // relativePath already includes the full path from the folder root
    // e.g., "FolderName/subfolder/file.txt"
    const relativeDir = path.dirname(relativePath);
    if (relativeDir && relativeDir !== '.') {
      const subfolderPath = path.join(userDir, relativeDir);
      console.log('📁 Creating folder structure:', subfolderPath);
      await fs.mkdir(subfolderPath, { recursive: true });
    }
    finalPath = path.join(userDir, relativePath);
    console.log('📁 Final path with folder structure:', finalPath);
  } else if (relativePath) {
    // Single file with relative path (edge case)
    finalPath = path.join(userDir, relativePath);
  } else {
    // Regular file upload without folder
    finalPath = path.join(userDir, sanitizedFilename);
  }
  
  console.log('📍 Final target path:', finalPath);

  // Verify source exists
  console.log('🔍 Checking if temp file exists...');
  try {
    await fs.access(tempPath);
    console.log('✅ Temp file exists');
    
    // Get file stats for debugging
    const stats = await fs.stat(tempPath);
    console.log(`   File size: ${stats.size} bytes`);
    console.log(`   Is file: ${stats.isFile()}`);
  } catch (error) {
    console.error('❌ Temp file not found at:', tempPath);
    throw new Error(`Temp file not found: ${tempPath}`);
  }

  // CRITICAL FIX: Async move with fallback for cross-device
  console.log('🚚 Attempting to move file...');
  
  // CHECK: If destination file already exists, we're about to overwrite it
  try {
    await fs.access(finalPath);
    console.log('⚠️  WARNING: Destination file already exists and will be OVERWRITTEN');
    console.log(`   Existing file: ${finalPath}`);
  } catch (e) {
    console.log('✅ Destination path is clear (no existing file)');
  }
  
  try {
    // Try rename first (fast, atomic on same filesystem)
    await fs.rename(tempPath, finalPath);
    console.log(`✅ Moved via rename: ${finalPath}`);
  } catch (renameError) {
    console.log('⚠️ Rename failed:', renameError.code, renameError.message);
    // Handle cross-device link error (EXDEV)
    if (renameError.code === 'EXDEV') {
      console.log('🔄 Cross-device detected, using copy+delete');
      try {
        await fs.copyFile(tempPath, finalPath);
        console.log('✅ Copy successful');
        await fs.unlink(tempPath);
        console.log('✅ Temp file deleted');
        console.log(`✅ Moved via copy: ${finalPath}`);
      } catch (copyError) {
        console.error('❌ Copy failed:', copyError);
        throw new Error(`Failed to copy file: ${copyError.message}`);
      }
    } else {
      console.error('❌ Rename failed with unexpected error:', renameError);
      throw new Error(`Failed to move file: ${renameError.message}`);
    }
  }

  // Final verification
  console.log('🔍 Verifying file exists at final location...');
  try {
    await fs.access(finalPath);
    const stats = await fs.stat(finalPath);
    console.log('✅ File verified at final location');
    console.log(`   Final file size: ${stats.size} bytes`);
  } catch (verifyError) {
    console.error('❌ CRITICAL: File not found after move operation!');
    console.error('   Expected at:', finalPath);
    throw new Error('File verification failed after move');
  }

  return finalPath;
}

/**
 * Sanitize filename for Windows filesystem
 * Removes forbidden characters and prevents path traversal
 */
function sanitizeFilename(filename) {
  // Windows forbidden: < > : " / \ | ? *
  // Control chars: 0x00-0x1F
  const sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/^\.+|\.+$/g, '_')  // No leading/trailing dots
    .trim();

  return sanitized || 'unnamed_file';
}

/**
 * Safely delete file with verification
 * FIXED: Now async, doesn't block event loop
 * Returns object with success status and additional info
 */
async function safeDeleteFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`✅ Deleted: ${filePath}`);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️ File already deleted or not found: ${filePath}`);
      return { success: true, notFound: true, message: 'File not found (already deleted)' };
    }
    console.error(`❌ Failed to delete ${filePath}:`, error);
    return { success: false, error: error, message: error.message };
  }
}

/**
 * Check if directory exists (async)
 */
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Ensure directory exists, create if needed (async, race-safe)
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to ensure directory ${dirPath}:`, error);
    return false;
  }
}

module.exports = {
  moveToUserFolder,
  sanitizeFilename,
  safeDeleteFile,
  directoryExists,
  ensureDirectory
};

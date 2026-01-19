const fs = require('fs').promises;
const path = require('path');

/**
 * Safely move uploaded file to user folder with proper error handling
 * Handles race conditions, cross-device moves, and async operations
 * FIXED: Now async, no blocking, handles race conditions
 */
async function moveToUserFolder(tempPath, username, originalFilename) {
  console.log('📦 moveToUserFolder:', { tempPath, username, originalFilename });

  const { uploadsDir } = require('../config/middleware');
  const userDir = path.join(uploadsDir, username);

  // CRITICAL FIX: recursive: true handles race condition
  // If folder already exists from parallel request, this won't throw
  await fs.mkdir(userDir, { recursive: true });
  console.log(`✅ User folder ready: ${userDir}`);

  // Decode and sanitize filename
  let decodedFilename = originalFilename;
  try {
    // Check for garbled UTF-8 patterns
    if (/[Ã¢â¬â¢Ã¤Â¸â¬Ã¦ââÃ¨Â±Â¡]/.test(originalFilename)) {
      const buffer = Buffer.from(originalFilename, 'binary');
      decodedFilename = buffer.toString('utf8');
      console.log('📝 Fixed UTF-8:', originalFilename, '->', decodedFilename);
    }
  } catch (e) {
    console.warn('⚠️ Could not decode filename:', e.message);
  }

  // Sanitize for Windows
  const sanitizedFilename = sanitizeFilename(decodedFilename);
  const finalPath = path.join(userDir, sanitizedFilename);
  console.log('📍 Target path:', finalPath);

  // Verify source exists
  try {
    await fs.access(tempPath);
  } catch (error) {
    throw new Error(`Temp file not found: ${tempPath}`);
  }

  // CRITICAL FIX: Async move with fallback for cross-device
  try {
    // Try rename first (fast, atomic on same filesystem)
    await fs.rename(tempPath, finalPath);
    console.log(`✅ Moved via rename: ${finalPath}`);
  } catch (renameError) {
    // Handle cross-device link error (EXDEV)
    if (renameError.code === 'EXDEV') {
      console.log('⚠️ Cross-device detected, using copy+delete');
      try {
        await fs.copyFile(tempPath, finalPath);
        await fs.unlink(tempPath);
        console.log(`✅ Moved via copy: ${finalPath}`);
      } catch (copyError) {
        console.error('❌ Copy failed:', copyError);
        throw new Error(`Failed to copy file: ${copyError.message}`);
      }
    } else {
      console.error('❌ Rename failed:', renameError);
      throw new Error(`Failed to move file: ${renameError.message}`);
    }
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
 */
async function safeDeleteFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`✅ Deleted: ${filePath}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️ File already deleted: ${filePath}`);
      return true;
    }
    console.error(`❌ Failed to delete ${filePath}:`, error);
    return false;
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

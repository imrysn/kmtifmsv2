const fs = require('fs').promises;
const path = require('path');

/**
 * Move uploaded file from temp location to user's folder.
 * Supports folder structure preservation via folderName + relativePath.
 * Handles cross-device moves (EXDEV) for NAS targets.
 */
async function moveToUserFolder(tempPath, username, originalFilename, folderName = null, relativePath = null) {
  const { uploadsDir } = require('../config/middleware');
  const userDir = path.join(uploadsDir, username);

  // Ensure user directory exists (race-safe)
  try {
    await fs.mkdir(userDir, { recursive: true });
  } catch (mkdirError) {
    throw new Error(`Failed to create user folder: ${mkdirError.message}`);
  }

  // Decode garbled UTF-8 filenames (latin1 mis-decoded as binary)
  let decodedFilename = originalFilename;
  try {
    if (/[\xC3\xC4\xC6\xC8]/.test(originalFilename)) {
      const buffer = Buffer.from(originalFilename, 'binary');
      const utf8Attempt = buffer.toString('utf8');
      if (utf8Attempt !== originalFilename) decodedFilename = utf8Attempt;
    }
  } catch (e) {
    // keep original
  }

  // Sanitize for Windows filesystem
  const sanitizedFilename = sanitizeFilename(decodedFilename);

  // Handle folder structure preservation
  let finalPath;
  if (folderName && relativePath) {
    // relativePath = "FolderName/subfolder/file.txt"
    // Sanitize each path segment individually (preserves separators)
    const normalizedRelPath = relativePath.replace(/\\/g, '/');
    const segments = normalizedRelPath.split('/');
    const sanitizedSegments = segments.map((seg, i) =>
      i === segments.length - 1 ? sanitizeFilename(seg) : sanitizeFilename(seg) || seg
    );
    const sanitizedRelPath = sanitizedSegments.join(path.sep);

    const subfolderPath = path.dirname(path.join(userDir, sanitizedRelPath));
    await fs.mkdir(subfolderPath, { recursive: true });
    finalPath = path.join(userDir, sanitizedRelPath);
  } else if (relativePath) {
    // Edge case: single file with relative path but no folderName
    finalPath = path.join(userDir, sanitizeFilename(relativePath));
  } else {
    finalPath = path.join(userDir, sanitizedFilename);
  }

  // Verify temp file exists before moving
  try {
    await fs.access(tempPath);
  } catch {
    throw new Error(`Temp file not found: ${tempPath}`);
  }

  // Move: try fast rename first, fall back to copy+delete for cross-device (NAS)
  try {
    await fs.rename(tempPath, finalPath);
  } catch (renameError) {
    if (renameError.code === 'EXDEV') {
      // Cross-device (local temp → NAS): copy then delete
      try {
        await fs.copyFile(tempPath, finalPath);
        await fs.unlink(tempPath).catch(() => {}); // best-effort cleanup
      } catch (copyError) {
        throw new Error(`Failed to copy file to NAS: ${copyError.message}`);
      }
    } else {
      throw new Error(`Failed to move file: ${renameError.message}`);
    }
  }

  // Verify file landed at destination
  try {
    await fs.access(finalPath);
  } catch {
    throw new Error(`File verification failed after move — not found at: ${finalPath}`);
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
 * Safely delete a file. Returns a result object; never throws.
 */
async function safeDeleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') return { success: true, notFound: true };
    console.error(`Failed to delete ${filePath}:`, error.message);
    return { success: false, error, message: error.message };
  }
}

/** Returns true if dirPath is an existing directory. */
async function directoryExists(dirPath) {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

/** Creates directory (and parents) if not already present. Returns true on success. */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error.message);
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

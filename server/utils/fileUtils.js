const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Cache of already-created directories to avoid redundant mkdir NAS round-trips
const _createdDirs = new Set();
async function ensureDirCached(dirPath) {
  if (_createdDirs.has(dirPath)) return;
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw new Error(`Failed to create folder: ${e.message}`);
  }
  _createdDirs.add(dirPath);
}

/**
 * Fast streaming copy using fs.createReadStream/WriteStream with an 8 MB buffer.
 * 8 MB chunks dramatically reduce NAS round-trips vs the old 256 KB buffer:
 * a 100 MB file goes from ~400 NAS reads down to ~13.
 */
function streamCopy(src, dest) {
  return new Promise((resolve, reject) => {
    const rd = fsSync.createReadStream(src, { highWaterMark: 8 * 1024 * 1024 });
    const wr = fsSync.createWriteStream(dest, { highWaterMark: 8 * 1024 * 1024 });
    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  });
}

/**
 * Robustly decode a filename that may have been mis-decoded as Latin-1 (ISO-8859-1).
 * Multer/busboy often decodes UTF-8 filenames as Latin-1, resulting in mojibake.
 * This utility recovers the original UTF-8 characters.
 */
function decodeUTF8Filename(name) {
  if (!name) return name;
  try {
    // Re-interpret the string as raw bytes (latin1), then decode as UTF-8.
    const buffer = Buffer.from(name, 'latin1');
    const utf8Attempt = buffer.toString('utf8');

    // If the re-decoded string is different and doesn't contain replacement chars (U+FFFD),
    // it is highly likely to be the correct UTF-8 representation.
    if (utf8Attempt !== name && !utf8Attempt.includes('\uFFFD')) {
      return utf8Attempt;
    }
  } catch (_) {
    // Fallback to original if any error occurs
  }
  return name;
}

/**
 * Move uploaded file from temp location to user's folder.
 * Supports folder structure preservation via folderName + relativePath.
 * Handles cross-device moves (EXDEV) for NAS targets.
 * @param {string} taskPrefix  Optional sub-directory under userDir (e.g. "task_42")
 *                             used to isolate uploads per assignment.
 * @param {boolean} isTeamLeaderAttachment  If true, files go to teamleader/<username>/
 *                             instead of uploads/<username>/.
 */
async function moveToUserFolder(tempPath, username, originalFilename, folderName = null, relativePath = null, taskPrefix = null, isTeamLeaderAttachment = false) {
  const { uploadsDir } = require('../config/middleware');
  const { networkDataPath } = require('../config/database');

  const baseDir = isTeamLeaderAttachment
    ? path.join(networkDataPath, 'teamleader')
    : uploadsDir;

  const userDir = taskPrefix
    ? path.join(baseDir, username, taskPrefix)
    : path.join(baseDir, username);

  const decodedFilename = decodeUTF8Filename(originalFilename);
  const sanitizedFilename = sanitizeFilename(decodedFilename);

  // Resolve final destination path
  let finalPath;
  if (folderName && relativePath) {
    const normalizedRelPath = relativePath.replace(/\\/g, '/');
    const segments = normalizedRelPath.split('/');
    const sanitizedSegments = segments.map((seg, i) =>
      i === segments.length - 1 ? sanitizeFilename(seg) : sanitizeFilename(seg) || seg
    );
    const sanitizedRelPath = sanitizedSegments.join(path.sep);
    const subfolderPath = path.dirname(path.join(userDir, sanitizedRelPath));
    await ensureDirCached(subfolderPath);
    finalPath = path.join(userDir, sanitizedRelPath);
  } else if (relativePath) {
    await ensureDirCached(userDir);
    finalPath = path.join(userDir, sanitizeFilename(relativePath));
  } else {
    await ensureDirCached(userDir);
    finalPath = path.join(userDir, sanitizedFilename);
  }

  // Move: try fast rename first, fall back to streaming copy for cross-device (NAS)
  try {
    await fs.rename(tempPath, finalPath);
  } catch (renameError) {
    if (renameError.code === 'EXDEV') {
      try {
        await streamCopy(tempPath, finalPath);
        await fs.unlink(tempPath).catch(() => {});
      } catch (copyError) {
        throw new Error(`Failed to copy file to NAS: ${copyError.message}`);
      }
    } else {
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

/**
 * Move an uploaded file into a task's project folder on the NAS.
 *
 * Flat layout — no user sub-folder:
 *   projectsDataPath / {tlUsername} / {sanitized taskTitle} / {relativePath or filename}
 *
 * If the destination file already exists it is overwritten (same-filename replacement).
 *
 * @param {string} tempPath         - OS temp path from multer
 * @param {string} tlUsername       - Team leader's username (project owner)
 * @param {string} taskTitle        - Assignment title (used as the folder name)
 * @param {string} originalFilename - File's original name
 * @param {string|null} folderName  - Top-level folder from drag-drop (or null)
 * @param {string|null} relativePath - Full relative path from drag-drop (or null)
 * @returns {string} finalPath      - Absolute NAS path where the file now lives
 */
async function moveToProjectFolder(
  tempPath, tlUsername, taskTitle,
  originalFilename, folderName = null, relativePath = null
) {
  const { projectsDataPath } = require('../config/database');

  const safeTitle    = sanitizeFilename(taskTitle) || 'untitled_task';
  const taskDir      = path.join(projectsDataPath, tlUsername, safeTitle);

  const decodedFilename   = decodeUTF8Filename(originalFilename);
  const sanitizedFilename = sanitizeFilename(decodedFilename);

  let finalPath;

  if (folderName && relativePath) {
    // Folder upload — preserve full relative path inside taskDir
    const normalizedRelPath = relativePath.replace(/\\/g, '/');
    const segments = normalizedRelPath.split('/');
    const sanitizedSegments = segments.map((seg, i) =>
      i === segments.length - 1
        ? sanitizeFilename(seg)
        : (sanitizeFilename(seg) || seg)
    );
    const sanitizedRelPath = sanitizedSegments.join(path.sep);
    const subfolderPath = path.dirname(path.join(taskDir, sanitizedRelPath));
    await ensureDirCached(subfolderPath);
    finalPath = path.join(taskDir, sanitizedRelPath);
  } else if (relativePath) {
    await ensureDirCached(taskDir);
    finalPath = path.join(taskDir, sanitizeFilename(relativePath));
  } else {
    await ensureDirCached(taskDir);
    finalPath = path.join(taskDir, sanitizedFilename);
  }

  // Move: rename (fast) → fallback to streaming copy for cross-device NAS targets
  try {
    await fs.rename(tempPath, finalPath);
  } catch (renameError) {
    if (renameError.code === 'EXDEV') {
      await streamCopy(tempPath, finalPath);   // overwrite if exists — intentional
      await fs.unlink(tempPath).catch(() => {});
    } else {
      throw new Error(`Failed to move file to project folder: ${renameError.message}`);
    }
  }

  return finalPath;
}

module.exports = {
  moveToUserFolder,
  moveToProjectFolder,
  streamCopy,          // exported so fileService can reuse the large-buffer copy
  decodeUTF8Filename,
  sanitizeFilename,
  safeDeleteFile,
  directoryExists,
  ensureDirectory
};

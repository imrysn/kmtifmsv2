/**
 * File System Watcher Service
 * Watches upload/NAS folders. When a file is deleted from Windows Explorer,
 * it is automatically removed from the database.
 */

const path = require('path');
const { query } = require('../../database/config');

let watcher = null;
let isStarted = false;
let watchPathsList = [];
let watcherLog = [];  // keep last 50 events for debug endpoint

function logEvent(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  console.log(entry);
  watcherLog.push(entry);
  if (watcherLog.length > 50) watcherLog.shift();
}

function getStatus() {
  return { isStarted, watchPaths: watchPathsList, recentEvents: watcherLog };
}

// Normalise a path to forward-slashes, lowercase, trimmed
function norm(p) {
  return (p || '').replace(/\\/g, '/').toLowerCase().trim();
}

/**
 * Extract the relative portion AFTER "uploads/" or "user_approvals/" or "PROJECTS/"
 * from any absolute or relative path.
 * e.g.  \\NAS\Shared\data\uploads\KMTI User\Test\file.pdf
 *       →  kmti user/test/file.pdf
 */
function relPart(p) {
  const n = norm(p);
  for (const seg of ['uploads/', 'user_approvals/', 'projects/']) {
    const idx = n.indexOf(seg);
    if (idx !== -1) return n.slice(idx + seg.length);
  }
  return n;
}

/**
 * Called when chokidar fires 'unlink' (a single file was deleted).
 */
async function handleFileDeletion(deletedPath) {
  const fileName    = path.basename(deletedPath);
  const fileNameLow = fileName.toLowerCase().trim();
  const relDeleted  = relPart(deletedPath);   // e.g. "kmti user/test test/case study no. 2.pdf"

  logEvent(`🗑️ File deleted: ${deletedPath} | relPart=${relDeleted}`);

  try {
    /* ── 1. Match files table ─────────────────────────────────────────── */
    // Pull ALL rows whose original_name or filename matches — then filter
    // by path so we don't accidentally delete a same-named file in another folder.
    const fileRows = await query(
      `SELECT id, original_name, filename, file_path, public_network_url
       FROM files
       WHERE LOWER(TRIM(original_name)) = ?
          OR LOWER(TRIM(filename))      = ?`,
      [fileNameLow, fileNameLow]
    );

    const matchedFiles = (fileRows || []).filter(row => {
      // Build the relative portion stored in DB
      const storedRel = relPart(row.public_network_url || row.file_path || '');

      // If we have a stored relative path, both sides must share the same
      // relative suffix (covers encoding differences between stored vs deleted).
      if (!storedRel) return true;   // no path info → match by name only
      return storedRel === relDeleted ||
             relDeleted.endsWith(storedRel) ||
             storedRel.endsWith(relDeleted);
    });

    for (const file of matchedFiles) {
      console.log(`  ↳ Removing file ID ${file.id} (${file.original_name})`);

      // Nullify any assignment_members references first (FK)
      await query(
        `UPDATE assignment_members
         SET file_id = NULL, status = 'pending', submitted_at = NULL
         WHERE file_id = ?`,
        [file.id]
      ).catch(() => {});

      await query(`DELETE FROM assignment_submissions  WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM notifications           WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM file_comments           WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM file_status_history     WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM files                   WHERE id      = ?`, [file.id]);

      logEvent(`✅ File ID ${file.id} (${file.original_name}) removed from DB`);
    }

    /* ── 2. Match assignment_attachments table ────────────────────────── */
    const attRows = await query(
      `SELECT id, original_name, file_path
       FROM assignment_attachments
       WHERE LOWER(TRIM(original_name)) = ?
          OR LOWER(TRIM(filename))      = ?`,
      [fileNameLow, fileNameLow]
    ).catch(() => []);

    for (const att of (attRows || [])) {
      const storedRel = relPart(att.file_path || '');
      const matches = !storedRel ||
        storedRel === relDeleted ||
        relDeleted.endsWith(storedRel) ||
        storedRel.endsWith(relDeleted);

      if (matches) {
        await query(`DELETE FROM assignment_attachments WHERE id = ?`, [att.id]);
        console.log(`  ✅ Attachment ID ${att.id} (${att.original_name}) removed from DB`);
      }
    }

    if (matchedFiles.length === 0 && (attRows || []).length === 0) {
      logEvent(`ℹ️  No DB record found for "${fileName}" (relDeleted=${relDeleted})`);
    }

  } catch (err) {
    console.error(`  ❌ [Watcher] DB error for ${deletedPath}:`, err.message);
  }
}

/**
 * Called when chokidar fires 'unlinkDir' (an entire folder was deleted).
 */
async function handleDirectoryDeletion(dirPath) {
  const relDir = relPart(dirPath);   // e.g. "kmti user/test test"
  console.log(`🗑️  [Watcher] Directory deleted: ${dirPath}`);

  try {
    // Match any file whose stored relative path starts with this folder segment
    const fileRows = await query(
      `SELECT id FROM files
       WHERE LOWER(REPLACE(COALESCE(file_path,''), '\\\\', '/'))         LIKE ?
          OR LOWER(REPLACE(COALESCE(public_network_url,''), '\\\\', '/')) LIKE ?`,
      [`%${relDir}%`, `%${relDir}%`]
    );

    for (const file of (fileRows || [])) {
      await query(`UPDATE assignment_members SET file_id = NULL, status = 'pending', submitted_at = NULL WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM assignment_submissions  WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM notifications           WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM file_comments           WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM file_status_history     WHERE file_id = ?`, [file.id]).catch(() => {});
      await query(`DELETE FROM files                   WHERE id      = ?`, [file.id]).catch(() => {});
    }

    const attRows = await query(
      `SELECT id FROM assignment_attachments
       WHERE LOWER(REPLACE(COALESCE(file_path,''), '\\\\', '/')) LIKE ?`,
      [`%${relDir}%`]
    ).catch(() => []);

    for (const att of (attRows || [])) {
      await query(`DELETE FROM assignment_attachments WHERE id = ?`, [att.id]).catch(() => {});
    }

    const total = (fileRows || []).length + (attRows || []).length;
    console.log(`  ✅ Removed ${total} DB record(s) for deleted directory "${path.basename(dirPath)}"`);

  } catch (err) {
    console.error(`  ❌ [Watcher] Directory deletion error:`, err.message);
  }
}

/**
 * Start the file system watcher on the given paths.
 */
function startWatcher(watchPaths) {
  if (isStarted) {
    console.log('⚠️  [Watcher] Already running');
    return;
  }

  watchPathsList = watchPaths;

  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch (_) {
    console.warn('⚠️  [Watcher] chokidar not installed. Run: npm install chokidar --prefix server');
    return;
  }

  const fs = require('fs');
  const validPaths = watchPaths.filter(p => {
    try { return fs.existsSync(p); } catch (_) { return false; }
  });

  if (validPaths.length === 0) {
    console.warn('⚠️  [Watcher] Watch paths not accessible yet. Retrying in 60s...');
    setTimeout(() => startWatcher(watchPaths), 60000);
    return;
  }

  logEvent(`👀 Starting watcher on: ${validPaths.join(' | ')}`);

  watcher = chokidar.watch(validPaths, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,        // Required for NAS/UNC network paths
    interval: 3000,          // Poll every 3 seconds
    binaryInterval: 5000,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
    ignored: [
      /(^|[\/\\])\../,       // hidden/dot files
      /temp_\d+_[a-z0-9]+$/, // multer temp files
    ],
    depth: 15,
  });

  watcher
    .on('unlink',    handleFileDeletion)
    .on('unlinkDir', handleDirectoryDeletion)
    .on('error', (err) => {
      console.error('❌ [Watcher] Error:', err.message);
      isStarted = false;
      // Restart after 30s (handles NAS disconnects)
      setTimeout(() => {
        stopWatcher().then(() => startWatcher(watchPathsList));
      }, 30000);
    })
    .on('ready', () => {
      isStarted = true;
      logEvent('✅ Watcher ready — listening for file deletions');
    });
}

async function stopWatcher() {
  if (watcher) {
    await watcher.close().catch(() => {});
    watcher = null;
    isStarted = false;
    console.log('⏹️  [Watcher] Stopped');
  }
}

module.exports = { startWatcher, stopWatcher, getWatcherStatus: getStatus };

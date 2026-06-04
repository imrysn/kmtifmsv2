/**
 * File System Watcher Service
 * Watches upload/NAS folders. When a file is deleted from Windows Explorer,
 * it is automatically removed from the database.
 */

const path = require('path');
const { query } = require('../config/database');

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
  const relDeleted  = relPart(deletedPath);

  // ── Office temp-file guard ─────────────────────────────────────────────────
  // Word/Excel/PowerPoint create temp files (starting with ~ or ending in .tmp)
  // during save operations. Ignore those events — they are noise.
  if (fileName.startsWith('~') || /\.tmp$/i.test(fileName) || /^~/.test(fileName)) {
    logEvent(`⏭️  Ignored Office temp file event: ${fileName}`);
    return;
  }

  // ── Projects-folder guard ──────────────────────────────────────────────────
  // The "projects/" directory stores user-submitted files linked to tasks.
  // When a team leader opens and saves a file in this folder, the Office
  // application briefly deletes the original (triggering this event) before
  // writing the saved copy back.  We must NEVER delete DB records for these
  // files — the physical file will reappear within seconds.
  const normPath = norm(deletedPath);
  if (normPath.includes('/projects/') || normPath.includes('\\projects\\')) {
    logEvent(`⏭️  Ignored deletion in projects/ folder (Office save pattern): ${deletedPath}`);
    return;
  }

  logEvent(`🗑️ File deleted: ${deletedPath} | relPart=${relDeleted}`);

  // ── Debounce: wait 5 s before acting — gives Office time to restore the file ─
  // If the file reappears on disk within 5 seconds we treat it as a save-cycle
  // (not a real deletion) and abort the DB removal.
  await new Promise(resolve => setTimeout(resolve, 5000));

  const fs = require('fs');
  if (fs.existsSync(deletedPath)) {
    logEvent(`⏭️  File reappeared after 5 s — skipping DB removal (Office save cycle): ${deletedPath}`);
    return;
  }

  try {
    /* ── 1. Match files table ─────────────────────────────────────────── */
    const fileRows = await query(
      `SELECT id, original_name, filename, file_path, public_network_url, status
       FROM files
       WHERE LOWER(TRIM(original_name)) = ?
          OR LOWER(TRIM(filename))      = ?`,
      [fileNameLow, fileNameLow]
    );

    const matchedFiles = (fileRows || []).filter(row => {
      const storedRel = relPart(row.public_network_url || row.file_path || '');
      if (!storedRel) return true;
      return storedRel === relDeleted ||
             relDeleted.endsWith(storedRel) ||
             storedRel.endsWith(relDeleted);
    });

    for (const file of matchedFiles) {
      // NEVER delete records for approved files
      if (file.status === 'final_approved') {
        console.log(`ℹ️  [Watcher] Skipping deletion for approved file: ${file.original_name} (ID: ${file.id})`);
        continue;
      }

      // Double-check: if the physical file now exists (Office restored it), skip.
      const physPath = file.public_network_url || file.file_path || '';
      if (physPath && fs.existsSync(physPath)) {
        logEvent(`⏭️  Physical file exists — skipping DB removal for ID ${file.id} (${file.original_name})`);
        continue;
      }

      console.log(`  ↳ Removing file ID ${file.id} (${file.original_name})`);

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
        if (att.file_path && fs.existsSync(att.file_path)) {
          logEvent(`⏭️  Physical attachment exists — skipping DB removal for attachment ID ${att.id}`);
          continue;
        }
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
  const relDir = relPart(dirPath);
  console.log(`🗑️  [Watcher] Directory deleted: ${dirPath}`);

  // ── Projects-folder guard ──────────────────────────────────────────────────
  // Never auto-delete DB records for the projects/ directory — these are
  // user-submitted task files. Folder removal in this path is handled explicitly
  // by the server (e.g. when a task is deleted), not by the watcher.
  const normDir = norm(dirPath);
  if (normDir.includes('/projects/') || normDir.includes('\\projects\\')) {
    logEvent(`⏭️  Ignored directory deletion in projects/ folder: ${dirPath}`);
    return;
  }

  try {
    const fileRows = await query(
      `SELECT id, original_name, status FROM files
       WHERE LOWER(REPLACE(COALESCE(file_path,''), '\\\\', '/'))         LIKE ?
          OR LOWER(REPLACE(COALESCE(public_network_url,''), '\\\\', '/')) LIKE ?`,
      [`%${relDir}%`, `%${relDir}%`]
    );

    for (const file of (fileRows || [])) {
      if (file.status === 'final_approved') {
        console.log(`ℹ️  [Watcher] Skipping folder deletion for approved file: ${file.original_name} (ID: ${file.id})`);
        continue;
      }
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
    usePolling: false,
    interval: 10000,
    binaryInterval: 15000,
    awaitWriteFinish: {
      stabilityThreshold: 3000,
      pollInterval: 1000,
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

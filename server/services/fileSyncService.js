/**
 * File Sync Service
 * Scans all files in the DB and removes records for files
 * that no longer physically exist on disk.
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../../database/config');

function norm(p) {
  return (p || '').replace(/\\/g, '/').toLowerCase().trim();
}

/**
 * Resolve a stored DB path to an absolute disk path.
 * Tries public_network_url first, then file_path, then uploadsDir + file_path.
 */
function resolveFilePath(row, uploadsDir, networkDataPath) {
  // 1. public_network_url is already an absolute UNC/local path
  if (row.public_network_url) {
    return row.public_network_url.replace(/\//g, path.sep);
  }

  // 2. file_path starting with /uploads/ → uploadsDir relative
  if (row.file_path) {
    const fp = row.file_path.replace(/\\/g, '/');
    if (fp.startsWith('/uploads/')) {
      return path.join(uploadsDir, fp.replace(/^\/uploads\//, ''));
    }
    if (fp.startsWith('/user_approvals/')) {
      return path.join(networkDataPath, fp.replace(/^\//, ''));
    }
    if (fp.startsWith('/PROJECTS/')) {
      return path.join(networkDataPath, fp.replace(/^\//, ''));
    }
    // Absolute path stored directly
    if (path.isAbsolute(fp) || fp.startsWith('\\\\')) {
      return fp;
    }
    // Fallback: treat as relative to uploadsDir
    return path.join(uploadsDir, fp);
  }

  return null;
}

/**
 * Delete all DB records for a file ID (cascading cleanup).
 */
async function deleteFileRecord(fileId) {
  await query(`UPDATE assignment_members SET file_id = NULL, status = 'pending', submitted_at = NULL WHERE file_id = ?`, [fileId]).catch(() => {});
  await query(`DELETE FROM assignment_submissions WHERE file_id = ?`, [fileId]).catch(() => {});
  await query(`DELETE FROM notifications WHERE file_id = ?`, [fileId]).catch(() => {});
  await query(`DELETE FROM file_comments WHERE file_id = ?`, [fileId]).catch(() => {});
  await query(`DELETE FROM file_status_history WHERE file_id = ?`, [fileId]).catch(() => {});
  await query(`DELETE FROM files WHERE id = ?`, [fileId]);
}

/**
 * Run a full sync: check every file in DB against disk, remove orphans.
 * Returns a summary { checked, removed, errors, removedFiles }
 */
async function syncDeletedFiles(uploadsDir, networkDataPath) {
  const summary = { checked: 0, removed: 0, errors: 0, removedFiles: [] };

  // ── 1. Sync files table ───────────────────────────────────────────
  const files = await query(
    `SELECT id, original_name, filename, file_path, public_network_url FROM files`
  );

  for (const row of (files || [])) {
    summary.checked++;
    const absPath = resolveFilePath(row, uploadsDir, networkDataPath);

    if (!absPath) {
      // Can't resolve path — skip
      continue;
    }

    let exists = false;
    try {
      exists = fs.existsSync(absPath);
    } catch (_) {
      // Network unreachable — skip this file rather than delete
      summary.errors++;
      continue;
    }

    if (!exists) {
      try {
        await deleteFileRecord(row.id);
        summary.removed++;
        summary.removedFiles.push({ id: row.id, name: row.original_name, path: absPath });
        console.log(`🗑️  [Sync] Removed orphan file ID ${row.id}: ${row.original_name}`);
      } catch (e) {
        console.error(`❌ [Sync] Failed to remove file ID ${row.id}:`, e.message);
        summary.errors++;
      }
    }
  }

  // ── 2. Sync assignment_attachments table ─────────────────────────
  const attachments = await query(
    `SELECT id, original_name, filename, file_path FROM assignment_attachments`
  ).catch(() => []);

  for (const row of (attachments || [])) {
    summary.checked++;
    const absPath = resolveFilePath(row, uploadsDir, networkDataPath);
    if (!absPath) continue;

    let exists = false;
    try {
      exists = fs.existsSync(absPath);
    } catch (_) {
      summary.errors++;
      continue;
    }

    if (!exists) {
      try {
        await query(`DELETE FROM assignment_attachments WHERE id = ?`, [row.id]);
        summary.removed++;
        summary.removedFiles.push({ id: row.id, name: row.original_name, path: absPath, type: 'attachment' });
        console.log(`🗑️  [Sync] Removed orphan attachment ID ${row.id}: ${row.original_name}`);
      } catch (e) {
        console.error(`❌ [Sync] Failed to remove attachment ID ${row.id}:`, e.message);
        summary.errors++;
      }
    }
  }

  console.log(`✅ [Sync] Complete — checked: ${summary.checked}, removed: ${summary.removed}, errors: ${summary.errors}`);
  return summary;
}

module.exports = { syncDeletedFiles };

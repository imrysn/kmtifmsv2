/**
 * Standalone watcher test — run this OUTSIDE the app:
 *   node test-watcher.js
 *
 * It will:
 * 1. Connect to MySQL and show what file paths are stored
 * 2. Start the file watcher and log every event
 * 3. Let you delete a file and see if the DB record is removed
 */

const path = require('path');

// ── 1. Load DB config (same as the server does) ───────────────────────
const mysqlConfig = require('./database/config');
const { query, networkDataPath } = mysqlConfig;

// ── 2. Resolve the same watch paths the server uses ───────────────────
const uploadsDir       = path.join(networkDataPath, 'uploads');
const userApprovalsDir = path.join(networkDataPath, 'user_approvals');
const projectsDir      = path.join(networkDataPath, 'PROJECTS');

console.log('\n🔍 Watch paths:');
console.log('  uploads      :', uploadsDir);
console.log('  user_approvals:', userApprovalsDir);
console.log('  PROJECTS     :', projectsDir);

// ── 3. Show a sample of files stored in DB ────────────────────────────
async function showSampleFiles() {
  console.log('\n📋 Sample file records in DB (last 5 uploaded):');
  try {
    const rows = await query(
      `SELECT id, original_name, filename, file_path, public_network_url
       FROM files ORDER BY uploaded_at DESC LIMIT 5`
    );
    if (!rows || rows.length === 0) {
      console.log('  (no files found in DB)');
    } else {
      rows.forEach(r => {
        console.log(`  [${r.id}] ${r.original_name}`);
        console.log(`       file_path         : ${r.file_path}`);
        console.log(`       public_network_url: ${r.public_network_url}`);
      });
    }
  } catch (e) {
    console.error('  DB query error:', e.message);
  }
}

// ── 4. Start watcher ──────────────────────────────────────────────────
function startWatcher() {
  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch (_) {
    console.error('\n❌ chokidar not installed. Run: npm install chokidar --save');
    process.exit(1);
  }

  const fs = require('fs');
  const watchPaths = [uploadsDir, userApprovalsDir, projectsDir].filter(p => {
    try { return fs.existsSync(p); } catch (_) { return false; }
  });

  if (watchPaths.length === 0) {
    console.error('\n❌ NONE of the watch paths exist! Check your NAS connection.');
    console.error('   Paths checked:');
    console.error('   -', uploadsDir);
    console.error('   -', userApprovalsDir);
    console.error('   -', projectsDir);
    process.exit(1);
  }

  console.log('\n✅ Accessible paths:', watchPaths);
  console.log('\n👀 Starting watcher... (delete a file from Explorer now)\n');

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 3000,
    depth: 15,
  });

  watcher
    .on('unlink', async (filePath) => {
      console.log('\n🗑️  DELETED FILE:', filePath);

      const fileName = path.basename(filePath).toLowerCase().trim();
      try {
        const rows = await query(
          `SELECT id, original_name, filename, file_path, public_network_url
           FROM files
           WHERE LOWER(TRIM(original_name)) = ? OR LOWER(TRIM(filename)) = ?`,
          [fileName, fileName]
        );
        if (!rows || rows.length === 0) {
          console.log('  ❌ No DB match for:', fileName);
          console.log('  Tip: Check that original_name in DB matches the deleted filename exactly');
        } else {
          console.log(`  ✅ Found ${rows.length} DB record(s):`, rows.map(r => `[${r.id}] ${r.original_name}`).join(', '));
          console.log('  → Would delete these from DB in production');
        }
      } catch (e) {
        console.error('  DB error:', e.message);
      }
    })
    .on('unlinkDir', (dirPath) => {
      console.log('\n🗑️  DELETED DIR:', dirPath);
    })
    .on('error', (err) => {
      console.error('\n❌ Watcher error:', err.message);
    })
    .on('ready', () => {
      console.log('✅ Watcher ready! Now go delete a file from Windows Explorer...');
      console.log('   (Ctrl+C to stop)\n');
    });
}

// ── Run ───────────────────────────────────────────────────────────────
showSampleFiles().then(() => {
  startWatcher();
}).catch(e => {
  console.error('Startup error:', e.message);
});

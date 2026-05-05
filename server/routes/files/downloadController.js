const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { db, query, queryOne, uploadsDir } = require('../../config/database-mysql');

const router = express.Router();

const mimeTypes = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.json': 'application/json', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg'
};

async function resolvePath(fileId) {
  let f = await queryOne('SELECT file_path, original_name, public_network_url FROM files WHERE id = ?', [fileId]);
  if (!f) {
    f = await queryOne('SELECT file_path, original_name, public_network_url FROM assignment_attachments WHERE id = ?', [fileId]);
    if (!f) return null;
  }
  let p = f.public_network_url && !f.public_network_url.startsWith('http') ? f.public_network_url : null;
  if (!p) {
    const fp = f.file_path || '';
    if (fp.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(fp)) p = fp;
    else if (fp.startsWith('/uploads/')) p = path.join(uploadsDir, fp.substring(9));
    else if (fp) p = path.join(uploadsDir, fp);
  }
  return p ? { path: p, name: f.original_name } : null;
}

router.post('/open-file', async (req, res) => {
  const { filePath } = req.body;
  try {
    let p = filePath.startsWith('/uploads/') ? path.join(uploadsDir, filePath.substring(9)) : path.normalize(filePath);
    if (!await fs.access(p).then(() => true).catch(() => false)) return res.status(404).json({ success: false, message: 'File not found' });
    if (/[&;`|<>$!\r\n]/.test(p)) return res.status(400).json({ success: false, message: 'Invalid path' });
    
    const cmd = process.platform === 'win32' ? `start "" "${p.replace(/"/g, '\\"')}"` : (process.platform === 'darwin' ? `open "${p}"` : `xdg-open "${p}"`);
    exec(cmd, (err) => err ? res.status(500).json({ success: false, error: err.message }) : res.json({ success: true }));
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:fileId/download', async (req, res) => {
  try {
    const resolved = await resolvePath(req.params.fileId);
    if (!resolved || !fsSync.existsSync(resolved.path)) return res.status(404).send('File not found');
    
    const ext = path.extname(resolved.name).toLowerCase();
    res.setHeader('Content-Disposition', `attachment; filename="${resolved.name}"; filename*=UTF-8''${encodeURIComponent(resolved.name)}`);
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    fsSync.createReadStream(resolved.path).pipe(res);
  } catch (e) { res.status(500).send(e.message); }
});

router.get('/:fileId/stream', async (req, res) => {
  try {
    const resolved = await resolvePath(req.params.fileId);
    if (!resolved || !fsSync.existsSync(resolved.path)) return res.status(404).send('File not found');
    
    const ext = path.extname(resolved.path).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resolved.name)}"`);
    fsSync.createReadStream(resolved.path).pipe(res);
  } catch (e) { res.status(500).send(e.message); }
});

router.get('/folder/zip', async (req, res) => {
  const { fileIds: idsStr, folderName } = req.query;
  const ids = idsStr?.split(',').map(id => parseInt(id.trim())).filter(Boolean);
  if (!ids?.length || !folderName) return res.status(400).send('Invalid params');

  const os = require('os'), tmpDir = path.join(os.tmpdir(), `kmti-${Date.now()}`), zipPath = path.join(os.tmpdir(), `${folderName}-${Date.now()}.zip`);
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    for (const id of ids) {
      const f = await queryOne('SELECT file_path, original_name, public_network_url, relative_path FROM files WHERE id = ?', [id]);
      if (!f) continue;
      let src = f.public_network_url && !f.public_network_url.startsWith('http') ? f.public_network_url : (f.file_path.startsWith('/uploads/') ? path.join(uploadsDir, f.file_path.substring(9)) : path.join(uploadsDir, f.file_path));
      if (fsSync.existsSync(src)) {
        let rel = f.relative_path ? f.relative_path.replace(/\\/g, '/').split('/').slice(1).join('/') : f.original_name;
        const dest = path.join(tmpDir, rel || f.original_name);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
      }
    }
    await new Promise((resolve, reject) => exec(`powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`, (err) => err ? reject(err) : resolve()));
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    fsSync.createReadStream(zipPath).on('close', () => { fsSync.rmSync(tmpDir, { recursive: true }); fsSync.unlinkSync(zipPath); }).pipe(res);
  } catch (e) { res.status(500).send(e.message); }
});

module.exports = router;

const express = require('express');
const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/middleware');

const router = express.Router();

// View file inline (forces browser to display, not download)
router.get('/view/*', (req, res) => {
  try {
    // Get the file path from the URL
    const filePath = req.params[0]; // Everything after /view/
    const fullPath = path.join(uploadsDir, filePath);
    
    console.log('📂 File view request:', filePath);
    console.log('📂 Full path:', fullPath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      return res.status(404).send('File not found');
    }
    
    // Get file stats
    const stat = fs.statSync(fullPath);
    
    // Get file extension
    const ext = path.extname(fullPath).toLowerCase();
    
    // Set appropriate content type based on file extension
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime'
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Set headers to force inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline'); // This is the key!
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
    
    console.log('✅ File served successfully:', filePath);
    
  } catch (error) {
    console.error('❌ Error serving file:', error);
    res.status(500).send('Error serving file');
  }
});

// Download file (forces download with original filename)
router.get('/download/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(uploadsDir, filePath);
    
    console.log('💾 File download request:', filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      return res.status(404).send('File not found');
    }
    
    const filename = path.basename(fullPath);
    
    // Force download with original filename
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(fullPath, filename);
    
    console.log('✅ File download started:', filename);
    
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    res.status(500).send('Error downloading file');
  }
});

module.exports = router;

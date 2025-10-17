const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { networkDataPath } = require('./database');

// Network Uploads Configuration
const uploadsDir = path.join(networkDataPath, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// Configure multer storage - Keep temp filename simple
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to uploads root first
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Save with a simple temp name (no special characters)
    // We'll use the properly decoded name when moving to final location
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    cb(null, `temp_${timestamp}_${randomString}`);
  }
});

// Create multer upload middleware
const upload = multer({
  storage: storage,
  // No file size limit - allow unlimited file sizes
  // No file type filter - allow all file types
});

// Helper to sanitize filename for Windows file system
function sanitizeFilename(filename) {
  // Windows doesn't allow these characters in filenames: < > : " / \ | ? *
  // Also remove control characters (ASCII 0-31)
  const sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/^\.|\.$/, '_') // Don't allow filenames starting or ending with a dot
    .trim();
  
  return sanitized || 'unnamed_file';
}

// Helper to move file to user folder after upload
function moveToUserFolder(tempPath, username, originalFilename) {
  console.log('📦 moveToUserFolder called:');
  console.log('  tempPath:', tempPath);
  console.log('  username:', username);
  console.log('  originalFilename:', originalFilename);
  
  const userDir = path.join(uploadsDir, username);
  
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    console.log(`✅ Created user folder: ${userDir}`);
  }
  
  // Decode UTF-8 filename if needed
  let decodedFilename = originalFilename;
  try {
    // Check if the filename contains typical garbled UTF-8 patterns
    if (/[Ã¢â¬â¢Ã¤Â¸â¬Ã¦ââÃ¨Â±Â¡]/.test(originalFilename)) {
      // The filename was decoded as latin1/binary instead of utf8
      // Re-encode as binary bytes, then decode as utf8
      const buffer = Buffer.from(originalFilename, 'binary');
      decodedFilename = buffer.toString('utf8');
      console.log('📝 Fixed UTF-8 encoding:', originalFilename, '->', decodedFilename);
    }
  } catch (e) {
    console.warn('⚠️ Could not decode filename, using original:', originalFilename);
  }
  
  // Sanitize filename for Windows compatibility
  const sanitizedFilename = sanitizeFilename(decodedFilename);
  console.log('🧹 Sanitized filename:', sanitizedFilename);
  
  const finalPath = path.join(userDir, sanitizedFilename);
  console.log('📍 Final path:', finalPath);
  
  // Check if temp file exists
  if (!fs.existsSync(tempPath)) {
    const error = new Error(`Temp file not found: ${tempPath}`);
    console.error('❌', error.message);
    throw error;
  }
  
  // Move the file (use copy + delete for better cross-platform support)
  try {
    fs.copyFileSync(tempPath, finalPath);
    fs.unlinkSync(tempPath);
    console.log(`✅ Successfully moved file to: ${finalPath}`);
  } catch (moveError) {
    console.error('❌ Error moving file:', moveError);
    console.error('  Temp path:', tempPath);
    console.error('  Final path:', finalPath);
    console.error('  Temp exists:', fs.existsSync(tempPath));
    console.error('  User dir exists:', fs.existsSync(userDir));
    console.error('  Full error:', moveError.stack);
    throw new Error(`Failed to move file: ${moveError.message}`);
  }
  
  return finalPath;
}

function setupMiddleware(app) {
  // CORS configuration with UTF-8 support
  app.use(cors({
    origin: ['http://localhost:5173', 'file://'], // Allow Vite dev server and Electron
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  }));

  // JSON parsing with extended options to handle UTF-8 special characters
  app.use(express.json({ 
    extended: true,
    limit: '50mb' // Increase limit for larger payloads
  }));
  
  app.use(express.urlencoded({ 
    extended: true,
    limit: '50mb',
    parameterLimit: 50000
  }));

  // Serve uploaded files with proper UTF-8 headers
  app.use('/uploads', (req, res, next) => {
    // Decode the URI to handle UTF-8 filenames properly
    try {
      req.url = decodeURIComponent(req.url);
    } catch (e) {
      console.warn('Could not decode URL:', req.url);
    }
    
    // Set Content-Disposition to inline to prevent automatic downloads
    res.setHeader('Content-Disposition', 'inline');
    
    // Ensure UTF-8 encoding for file responses
    const contentType = res.getHeader('Content-Type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    
    next();
  }, express.static(uploadsDir, {
    // Enable proper handling of UTF-8 filenames
    setHeaders: (res, filePath) => {
      // Extract filename and encode it properly
      const filename = path.basename(filePath);
      try {
        // Use RFC 5987 encoding for non-ASCII filenames
        const encodedFilename = encodeURIComponent(filename);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
      } catch (e) {
        console.warn('Could not encode filename for header:', filename);
      }
    }
  }));
}

module.exports = {
  setupMiddleware,
  upload,
  uploadsDir,
  moveToUserFolder
};

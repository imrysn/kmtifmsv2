const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { networkDataPath } = require('./database');

// FIXED: Import async file utilities
const { moveToUserFolder: moveToUserFolderAsync } = require('../utils/fileUtils');

// Network Uploads Configuration
// IMPORTANT: Keep as simple path.join for NCC bundler compatibility
const uploadsDir = path.join(networkDataPath, String('uploads'));

// NOTE: NAS directory check is deferred to upload time to avoid
// blocking server startup when the NAS is temporarily unreachable.
console.log(`📁 Uploads directory configured: ${uploadsDir}`);

// Configure multer storage with optimizations for large files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Lazily create uploads directory at upload time (not at server startup)
    // This avoids blocking when NAS is temporarily unreachable on startup
    fs.mkdir(uploadsDir, { recursive: true }, (mkdirErr) => {
      if (mkdirErr && mkdirErr.code !== 'EEXIST') {
        console.error('❌ Cannot create uploads directory:', mkdirErr.message);
        console.error('   Path:', uploadsDir);
        console.error('   💡 Check network connection to NAS and folder permissions.');
      }
      cb(null, uploadsDir);
    });
  },
  filename: function (req, file, cb) {
    // Save with a simple temp name (no special characters)
    // We'll use the properly decoded name when moving to final location
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    cb(null, `temp_${timestamp}_${randomString}`);
  }
});

// Create multer upload middleware with optimizations
const upload = multer({
  storage: storage,
  // Security limits to prevent DoS attacks
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024 // 50GB max file size (effectively limitless)
    // No files limit — supports folder uploads with unlimited file count
  }
});

function setupMiddleware(app) {
  // Security Headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "http://localhost:*", "http://192.168.*.*"], // Allow local network
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for file uploads
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin for local network
  }));

  // CORS configuration with UTF-8 support
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or Electron file://)
      if (!origin) return callback(null, true);

      // Allow file:// protocol
      if (origin === 'file://') return callback(null, true);

      // Allow localhost and local network IPs
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3001',
        process.env.CORS_ORIGIN,
        'http://192.168.200.105:3001' // Explicitly allow the server IP
      ].filter(Boolean);

      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Allow any 192.168.x.x origin (Local Network)
      if (origin.startsWith('http://192.168.') || origin.startsWith('https://192.168.')) {
        return callback(null, true);
      }

      // Default: Allow it anyway for this internal tool to prevent friction
      // (You can restrict this later if security is a concern)
      return callback(null, true);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  }));

  // JSON parsing with extended options to handle UTF-8 special characters
  app.use(express.json({
    extended: true,
    limit: '50gb' // Increase limit for larger payloads
  }));

  app.use(express.urlencoded({
    extended: true,
    limit: '50gb',
    parameterLimit: 50000
  }));

  // Serve uploaded files - FORCE inline display (no downloads)
  app.use('/uploads', express.static(uploadsDir, {
    // Set headers to force inline display
    setHeaders: (res, filePath) => {
      // CRITICAL: Always use 'inline' to open in browser, never 'attachment'
      res.setHeader('Content-Disposition', 'inline');

      // Set proper MIME type for common file types
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.zip': 'application/zip',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);

      // Disable download for all files
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }));
}

module.exports = {
  setupMiddleware,
  upload,
  uploadsDir,
  moveToUserFolder: moveToUserFolderAsync  // FIXED: Now exports async version
};

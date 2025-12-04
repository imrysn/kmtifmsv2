const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { networkDataPath } = require('./database');

// Network Uploads Configuration
const uploadsDir = path.join(networkDataPath, 'uploads');

// Ensure uploads directory exists with detailed error logging
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✅ Created uploads directory: ${uploadsDir}`);
  } catch (mkdirError) {
    console.error('❌ CRITICAL: Cannot create uploads directory!');
    console.error('   Path:', uploadsDir);
    console.error('   Error:', mkdirError.message);
    console.error('   💡 Solution:');
    console.error('      1. Check network connection to NAS');
    console.error('      2. Verify folder permissions');
    console.error('      3. Or enable local storage: USE_LOCAL_STORAGE=true in .env');
    console.error('   ⚠️  File uploads will FAIL until this is resolved!');
  }
} else {
  console.log(`✅ Uploads directory ready: ${uploadsDir}`);
  
  // Test write permission
  const testFile = path.join(uploadsDir, '.test-write-' + Date.now());
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Uploads directory is writable');
  } catch (writeError) {
    console.error('❌ WARNING: Uploads directory exists but is NOT writable!');
    console.error('   Error:', writeError.message);
    console.error('   💡 Check folder permissions on the NAS');
  }
}

// Configure multer storage with optimizations for large files
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

// Create multer upload middleware with optimizations
const upload = multer({
  storage: storage,
  // Optimized limits for better performance
  limits: {
    // No file size limit - set to undefined
    files: 1 // Only one file at a time
  }
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
  
  // Move the file using rename (faster than copy + delete for local drives)
  try {
    fs.renameSync(tempPath, finalPath);
    console.log(`✅ Successfully moved file to: ${finalPath}`);
  } catch (moveError) {
    // Fallback to copy if rename fails (e.g., cross-device link)
    try {
      fs.copyFileSync(tempPath, finalPath);
      fs.unlinkSync(tempPath);
      console.log(`✅ Successfully copied file to: ${finalPath}`);
    } catch (copyError) {
      console.error('❌ Error moving file:', moveError);
      console.error('❌ Error copying file:', copyError);
      console.error('  Temp path:', tempPath);
      console.error('  Final path:', finalPath);
      console.error('  Temp exists:', fs.existsSync(tempPath));
      console.error('  User dir exists:', fs.existsSync(userDir));
      throw new Error(`Failed to move file: ${moveError.message}`);
    }
  }
  
  return finalPath;
}

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

function setupMiddleware(app) {
  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Electron compatibility
    crossOriginEmbedderPolicy: false
  }));

  // Cookie parser - MUST be before CSRF
  app.use(cookieParser());

  // CORS configuration with credentials support
  const corsOptions = {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'file://'],
    credentials: true, // Allow cookies
    exposedHeaders: ['Content-Disposition', 'X-CSRF-Token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  };
  app.use(cors(corsOptions));

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

  // Apply rate limiting to all API routes
  app.use('/api/', apiLimiter);
  
  // Stricter rate limiting for auth routes
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

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

  console.log('✅ Security middleware initialized');
  console.log('   - Helmet security headers enabled');
  console.log('   - CORS configured for:', corsOptions.origin);
  console.log('   - Rate limiting: API (100 req/15min), Auth (5 req/15min)');
  console.log('   - Cookie parser enabled');
}

module.exports = {
  setupMiddleware,
  upload,
  uploadsDir,
  moveToUserFolder,
  authLimiter,
  apiLimiter
};

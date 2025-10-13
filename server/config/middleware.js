const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage
  // No file size limit - allow unlimited file sizes
  // No file type filter - allow all file types
});

function setupMiddleware(app) {
  // CORS configuration
  app.use(cors({
    origin: ['http://localhost:5173', 'file://'], // Allow Vite dev server and Electron
    credentials: true
  }));

  // JSON parsing
  app.use(express.json());

  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir));
}

module.exports = {
  setupMiddleware,
  upload,
  uploadsDir
};

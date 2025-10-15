const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { truncateName, formatFileSize, getParentPath } = require('../utils/fileHelpers');
const { db, USE_MYSQL } = require('../config/database');

const router = express.Router();

// Default network projects directory
let networkProjectsPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';

// Function to get current root directory from settings
async function getRootDirectory() {
  try {
    if (USE_MYSQL) {
      const settings = await db.query(
        'SELECT setting_value FROM settings WHERE setting_key = ?',
        ['root_directory']
      );
      if (settings && settings.length > 0 && settings[0].setting_value) {
        return settings[0].setting_value;
      }
    } else {
      const setting = await new Promise((resolve, reject) => {
        db.get(
          'SELECT setting_value FROM settings WHERE setting_key = ?',
          ['root_directory'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      if (setting && setting.setting_value) {
        return setting.setting_value;
      }
    }
  } catch (error) {
    console.error('Error fetching root directory from settings:', error);
  }
  // Return default if not found
  return networkProjectsPath;
}

// Browse network project directory - ASYNC
router.get('/browse', async (req, res) => {
  const requestPath = req.query.path || '/';

  console.log(`📁 Browsing network directory: ${requestPath}`);

  try {
    // Get the current root directory from settings
    const rootDirectory = await getRootDirectory();
    console.log(`📂 Using root directory: ${rootDirectory}`);

    let fullPath;
    if (requestPath === '/') {
      fullPath = rootDirectory;
    } else {
      // Remove leading slash and join with network path
      const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
      fullPath = path.join(rootDirectory, relativePath);
    }
    console.log(`🔍 Reading directory: ${fullPath}`);

    // Check if directory exists using async
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      console.log('❌ Directory not found:', fullPath);
      return res.status(404).json({
        success: false,
        message: 'Directory not found',
        path: requestPath
      });
    }

    // Check if it's actually a directory using async
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: 'Path is not a directory',
        path: requestPath
      });
    }

    // Read directory contents using async
    const items = await fs.readdir(fullPath);
    const fileSystemItems = [];

    // Add parent directory if not at root
    if (requestPath !== '/') {
      fileSystemItems.push({
        id: 'parent',
        name: '..',
        displayName: '..',
        type: 'folder',
        path: getParentPath(requestPath),
        size: null,
        modified: null,
        isParent: true
      });
    }

    // Process each item in the directory with async operations
    // Use Promise.all to process all items concurrently, which is much faster than sequential sync calls
    const processPromises = items.map(async (item, index) => {
      try {
        const itemPath = path.join(fullPath, item);
        const itemStats = await fs.stat(itemPath);
        const isDirectory = itemStats.isDirectory();

        // Skip hidden files/folders
        if (item.startsWith('.')) return null;

        const truncatedName = truncateName(item);
        const itemRequestPath = requestPath === '/' ? `/${item}` : `${requestPath}/${item}`;
        const fileSystemItem = {
          id: `${isDirectory ? 'folder' : 'file'}-${index}`,
          name: item,
          displayName: truncatedName,
          type: isDirectory ? 'folder' : 'file',
          path: itemRequestPath,
          size: isDirectory ? null : formatFileSize(itemStats.size),
          modified: itemStats.mtime,
          isParent: false
        };

        // Add file type for files
        if (!isDirectory) {
          const extension = path.extname(item).toLowerCase().slice(1);
          fileSystemItem.fileType = extension || 'unknown';
        }

        return fileSystemItem;
      } catch (itemError) {
        console.error(`❌ Error processing item ${item}:`, itemError.message);
        // Skip items that can't be processed
        return null;
      }
    });

    const processedItems = (await Promise.all(processPromises)).filter(item => item !== null);
    fileSystemItems.push(...processedItems);

    // Sort items: folders first, then files, alphabetically
    fileSystemItems.sort((a, b) => {
      if (a.isParent) return -1;
      if (b.isParent) return 1;
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    console.log(`✅ Found ${fileSystemItems.length} items in ${requestPath}`);
    res.json({
      success: true,
      items: fileSystemItems,
      path: requestPath,
      networkPath: fullPath
    });
  } catch (error) {
    console.error('❌ Error browsing network directory:', error);
    let errorMessage = 'Failed to browse directory';
    if (error.code === 'ENOENT') {
      errorMessage = 'Network directory not accessible. Please check VPN connection and permissions.';
    } else if (error.code === 'EACCES') {
      errorMessage = 'Access denied. Please check directory permissions.';
    }
    res.status(500).json({
      success: false,
      message: errorMessage,
      path: requestPath,
      error: error.code || error.message
    });
  }
});

// Get network directory info - ASYNC
router.get('/info', async (req, res) => {
  try {
    // Get the current root directory from settings
    const rootDirectory = await getRootDirectory();
    
    const exists = await fs.access(rootDirectory).then(() => true).catch(() => false);
    if (exists) {
      const stats = await fs.stat(rootDirectory);
      res.json({
        success: true,
        accessible: true,
        path: rootDirectory,
        modified: stats.mtime,
        message: 'Network directory accessible'
      });
    } else {
      res.json({
        success: false,
        accessible: false,
        path: rootDirectory,
        message: 'Network directory not accessible'
      });
    }
  } catch (error) {
    const rootDirectory = await getRootDirectory();
    res.status(500).json({
      success: false,
      accessible: false,
      path: rootDirectory,
      message: 'Error accessing network directory',
      error: error.message
    });
  }
});

// Serve individual file - ASYNC
router.get('/file', async (req, res) => {
  const requestPath = req.query.path;

  if (!requestPath) {
    return res.status(400).json({
      success: false,
      message: 'File path is required'
    });
  }

  console.log(`📄 Serving file: ${requestPath}`);

  try {
    // Get the current root directory from settings
    const rootDirectory = await getRootDirectory();
    console.log(`📂 Using root directory: ${rootDirectory}`);

    // Remove leading slash and join with network path
    const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
    const fullPath = path.join(rootDirectory, relativePath);
    console.log(`🔍 Full file path: ${fullPath}`);

    // Check if file exists
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      console.log('❌ File not found:', fullPath);
      return res.status(404).json({
        success: false,
        message: 'File not found',
        path: requestPath
      });
    }

    // Check if it's actually a file
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({
        success: false,
        message: 'Path is not a file',
        path: requestPath
      });
    }

    // Get file extension and set appropriate content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    const fileName = path.basename(fullPath);

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = require('fs').createReadStream(fullPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('❌ Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file',
          error: error.message
        });
      }
    });

    console.log(`✅ Serving file: ${fileName}`);
  } catch (error) {
    console.error('❌ Error serving file:', error);
    let errorMessage = 'Failed to serve file';
    if (error.code === 'ENOENT') {
      errorMessage = 'File not found';
    } else if (error.code === 'EACCES') {
      errorMessage = 'Access denied. Please check file permissions.';
    }
    res.status(500).json({
      success: false,
      message: errorMessage,
      path: requestPath,
      error: error.code || error.message
    });
  }
});

// Global search - recursively search through directories
router.get('/search', async (req, res) => {
  const searchQuery = req.query.query;
  const searchPath = req.query.path || '/';

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  console.log(`🔍 Global search for: "${searchQuery}" starting from: ${searchPath}`);

  try {
    const rootDirectory = await getRootDirectory();
    const searchRoot = searchPath === '/' ? rootDirectory : path.join(rootDirectory, searchPath.slice(1));
    
    const results = [];
    const searchLower = searchQuery.toLowerCase();

    // Recursive function to search through directories
    async function searchDirectory(dirPath, relativePath) {
      try {
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
          // Skip hidden files/folders
          if (item.startsWith('.')) continue;
          
          const fullPath = path.join(dirPath, item);
          const itemRelativePath = relativePath === '/' ? `/${item}` : `${relativePath}/${item}`;
          
          try {
            const stats = await fs.stat(fullPath);
            const isDirectory = stats.isDirectory();
            
            // Check if item name matches search query
            if (item.toLowerCase().includes(searchLower)) {
              const truncatedName = truncateName(item);
              results.push({
                id: `${isDirectory ? 'folder' : 'file'}-${results.length}`,
                name: item,
                displayName: truncatedName,
                type: isDirectory ? 'folder' : 'file',
                path: itemRelativePath,
                size: isDirectory ? null : formatFileSize(stats.size),
                modified: stats.mtime,
                parentPath: relativePath,
                fileType: isDirectory ? null : path.extname(item).toLowerCase().slice(1) || 'unknown'
              });
            }
            
            // Recursively search subdirectories (limit depth to prevent infinite loops)
            if (isDirectory && results.length < 500) {
              await searchDirectory(fullPath, itemRelativePath);
            }
          } catch (itemError) {
            // Skip items that can't be accessed
            console.error(`Error accessing ${item}:`, itemError.message);
          }
        }
      } catch (dirError) {
        console.error(`Error reading directory ${dirPath}:`, dirError.message);
      }
    }

    await searchDirectory(searchRoot, searchPath);

    // Sort results: folders first, then files
    results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    console.log(`✅ Found ${results.length} results for "${searchQuery}"`);
    res.json({
      success: true,
      results: results,
      query: searchQuery,
      searchPath: searchPath,
      count: results.length
    });
  } catch (error) {
    console.error('❌ Error performing global search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: error.message
    });
  }
});

module.exports = router;

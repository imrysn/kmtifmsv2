const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { truncateName, formatFileSize, getParentPath } = require('../utils/fileHelpers');

const router = express.Router();

// Network projects directory configuration
const networkProjectsPath = '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';

// Browse network project directory - ASYNC
router.get('/browse', async (req, res) => {
  const requestPath = req.query.path || '/';

  console.log(`📁 Browsing network directory: ${requestPath}`);

  try {
    let fullPath;
    if (requestPath === '/') {
      fullPath = networkProjectsPath;
    } else {
      // Remove leading slash and join with network path
      const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
      fullPath = path.join(networkProjectsPath, relativePath);
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
    const exists = await fs.access(networkProjectsPath).then(() => true).catch(() => false);
    if (exists) {
      const stats = await fs.stat(networkProjectsPath);
      res.json({
        success: true,
        accessible: true,
        path: networkProjectsPath,
        modified: stats.mtime,
        message: 'Network directory accessible'
      });
    } else {
      res.json({
        success: false,
        accessible: false,
        path: networkProjectsPath,
        message: 'Network directory not accessible'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      accessible: false,
      path: networkProjectsPath,
      message: 'Error accessing network directory',
      error: error.message
    });
  }
});

module.exports = router;

const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function registerIpcHandlers(mainWindow, log, LogLevel, isProduction) {
  ipcMain.handle('dialog:openDirectory', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath: options.defaultPath || undefined
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths || []
    };
  });

  // Get default network projects path
  ipcMain.handle('app:getNetworkProjectsPath', async () => {
    try {
      const networkPath = process.env.NETWORK_PROJECTS_PATH || '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';
      if (fs.existsSync(networkPath)) {
        log(LogLevel.DEBUG, 'Network projects path found:', networkPath);
        return networkPath;
      }
      log(LogLevel.DEBUG, 'Network projects path not found, returning null');
      return null;
    } catch (error) {
      log(LogLevel.ERROR, 'Error getting network projects path:', error.message);
      return null;
    }
  });

  // Handle file downloads
  ipcMain.handle('file:download', async (event, { fileUrl, fileName }) => {
    try {
      const downloadsDir = app.getPath('downloads');
      const safeFileName = fileName || 'download';
      const hasExt = path.extname(safeFileName).length > 1;
      let finalName = safeFileName;
      if (!hasExt) {
        const urlPath = fileUrl.split('?')[0];
        const urlExt = path.extname(urlPath);
        if (urlExt.length > 1) finalName = safeFileName + urlExt;
      }

      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(downloadsDir, finalName),
        title: 'Save File',
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };

      let savePath = result.filePath;
      const savedExt = path.extname(savePath);
      const expectedExt = path.extname(finalName);
      if (!savedExt && expectedExt) {
        savePath = savePath + expectedExt;
      }

      const https = require('https');
      const http = require('http');
      const httpModule = fileUrl.startsWith('https') ? https : http;
      await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(savePath);
        httpModule.get(fileUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            const redirectModule = redirectUrl.startsWith('https') ? https : http;
            redirectModule.get(redirectUrl, (r2) => {
              r2.pipe(dest);
              dest.on('finish', () => { dest.close(); resolve(); });
              dest.on('error', reject);
            }).on('error', reject);
            return;
          }
          response.pipe(dest);
          dest.on('finish', () => { dest.close(); resolve(); });
          dest.on('error', reject);
        }).on('error', reject);
      });
      return { success: true, savedTo: savePath };
    } catch (err) {
      log(LogLevel.ERROR, 'Download failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:openInApp', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        log(LogLevel.WARN, 'Invalid file path provided');
        return { success: false, error: 'Invalid file path' };
      }

      const normalizedPath = path.normalize(filePath);
      const isUNCPath = normalizedPath.startsWith('\\\\') || filePath.startsWith('\\\\');

      if (isUNCPath) {
        log(LogLevel.DEBUG, `Opening UNC/network file directly: ${normalizedPath}`);
        const result = await shell.openPath(normalizedPath);
        if (result) {
          log(LogLevel.ERROR, 'Error opening UNC file:', result);
          return { success: false, error: result };
        }
        log(LogLevel.INFO, 'UNC file opened successfully');
        return { success: true, method: 'system-default-unc' };
      }

      if (!fs.existsSync(normalizedPath)) {
        log(LogLevel.WARN, 'File not found:', normalizedPath);
        return { success: false, error: 'File not found or has been deleted/moved' };
      }

      const stats = fs.statSync(normalizedPath);
      if (stats.isDirectory()) {
        log(LogLevel.WARN, 'Attempted to open directory as file:', normalizedPath);
        return { success: false, error: 'Cannot open directory as file' };
      }

      log(LogLevel.DEBUG, `Opening file with system default application: ${normalizedPath}`);
      const result = await shell.openPath(normalizedPath);

      if (result) {
        log(LogLevel.ERROR, 'Error opening file:', result);
        return { success: false, error: result };
      }

      log(LogLevel.INFO, 'File opened successfully with system default application');
      return { success: true, method: 'system-default' };

    } catch (error) {
      log(LogLevel.ERROR, 'Error opening file:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('folder:openInExplorer', async (event, folderPath) => {
    try {
      if (!folderPath || typeof folderPath !== 'string') {
        return { success: false, error: 'Invalid folder path' };
      }
      const normalizedPath = path.normalize(folderPath);
      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: 'Folder not found' };
      }
      log(LogLevel.DEBUG, `Opening in Explorer: ${normalizedPath}`);
      shell.showItemInFolder(normalizedPath);
      return { success: true };
    } catch (error) {
      log(LogLevel.ERROR, 'Error opening folder:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('window:flashFrame', (event, shouldFlash) => {
    log(LogLevel.DEBUG, `Window flash request ignored (disabled to prevent blinking)`);
  });

  ipcMain.on('updater:quit-and-install', () => {
    if (isProduction) {
      const updater = require('../updater');
      updater.quitAndInstall();
    }
  });

  ipcMain.on('updater:check-for-updates', () => {
    if (isProduction) {
      const updater = require('../updater');
      updater.checkForUpdates();
    }
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:open-external', async (event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });
};

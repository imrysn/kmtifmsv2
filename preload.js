const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loaded');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electron', {
    // Dialog methods
    openDirectoryDialog: (options) => ipcRenderer.invoke('dialog:openDirectory', options),

    // File operations - uses Windows default file associations
    openFileInApp: (filePath) => ipcRenderer.invoke('file:openInApp', filePath),

    // Download a file via native Save dialog
    downloadFile: (fileUrl, fileName) => ipcRenderer.invoke('file:download', { fileUrl, fileName }),

    // Open external links in default browser
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

    // Open folder in Windows Explorer
    openFolderInExplorer: (folderPath) => ipcRenderer.invoke('folder:openInExplorer', folderPath),

    // Download a folder as a real folder (not zip) to the Downloads directory
    downloadFolder: (folderName, fileInfoList) => ipcRenderer.invoke('folder:download', { folderName, fileInfoList }),

    // Get default network projects path
    getNetworkProjectsPath: () => ipcRenderer.invoke('app:getNetworkProjectsPath'),

    // Window flashing for notifications
    flashFrame: (shouldFlash) => ipcRenderer.send('window:flashFrame', shouldFlash),

    // Taskbar overlay badge with unread count
    setBadge: (count) => ipcRenderer.send('window:setBadge', count),

    // Persistent app storage — reads/writes a JSON file in userData via main process
    // This survives app restarts (unlike browser localStorage which may not flush on close)
    appStorage: {
      get: (key) => ipcRenderer.invoke('app-storage:get', key),
      set: (key, value) => ipcRenderer.invoke('app-storage:set', key, value),
    },
  });

  // Expose updater API - secure and scoped
  contextBridge.exposeInMainWorld('updater', {
    // Listen for update toast events
    onStatus: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('updater:toast', subscription);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener('updater:toast', subscription);
    },

    // Request to install downloaded update and restart
    restartAndInstall: () => ipcRenderer.send('updater:quit-and-install'),

    // Manually check for updates
    checkForUpdates: () => ipcRenderer.send('updater:check-for-updates'),

    // Get current app version
    getVersion: () => ipcRenderer.invoke('app:get-version')
  });

  console.log('✅ Electron API exposed to window object');
} catch (error) {
  console.error('❌ Failed to expose Electron API:', error);
}

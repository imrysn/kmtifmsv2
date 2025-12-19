const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loaded');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electron', {
    // Dialog methods
    openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
    
    // File operations - uses Windows default file associations
    openFileInApp: (filePath) => ipcRenderer.invoke('file:openInApp', filePath),
    
    // Window flashing for notifications
    flashFrame: (shouldFlash) => ipcRenderer.send('window:flashFrame', shouldFlash)
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

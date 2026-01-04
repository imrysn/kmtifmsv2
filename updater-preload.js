const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Updater preload script loaded');

// Expose updater API to the renderer process
try {
  contextBridge.exposeInMainWorld('updaterAPI', {
    // Listen for status updates from main process
    onStatus: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('updater:status', subscription);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener('updater:status', subscription);
    },

    // Request to install update
    installUpdate: () => ipcRenderer.send('updater-window:install'),

    // Cancel update
    cancelUpdate: () => ipcRenderer.send('updater-window:cancel')
  });

  console.log('✅ Updater API exposed to window object');
} catch (error) {
  console.error('❌ Failed to expose updater API:', error);
}

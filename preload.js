const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loaded');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electron', {
    // Dialog methods
    openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
    
    // File operations - uses Windows default file associations
    openFileInApp: (filePath) => ipcRenderer.invoke('file:openInApp', filePath)
  });
  console.log('✅ Electron API exposed to window object');
} catch (error) {
  console.error('❌ Failed to expose Electron API:', error);
}

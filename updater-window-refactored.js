/**
 * KMTI FMS - Standalone Update Window (REFACTORED)
 *
 * Improvements over original:
 * - Loads external HTML/CSS/JS files (separation of concerns)
 * - Cleaner code structure
 * - Better error handling
 * - Improved maintainability
 *
 * Features:
 * - Independent update window separate from main application
 * - Real-time update progress display
 * - Automatic update installation
 * - Clean, minimal UI focused on updates
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Updater window instance
let updaterWindow = null;

// Environment detection
const isDev = process.env.NODE_ENV === 'development';

// Window configuration
const WINDOW_CONFIG = {
  width: 400,
  height: 300,
  show: false,
  frame: false,
  alwaysOnTop: true,
  center: true,
  resizable: false,
  backgroundColor: '#1a1a1a',
  icon: path.join(__dirname, 'client/src/assets/fms-icon.png'),
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    preload: path.join(__dirname, 'updater-preload.js')
  }
};

/**
 * Get the URL for the updater window
 * @returns {string} URL to load
 */
function getUpdaterUrl() {
  const updaterPath = path.join(__dirname, 'client/updater-ui/index.html');
  
  // Check if file exists
  if (!fs.existsSync(updaterPath)) {
    console.error('❌ Updater UI not found at:', updaterPath);
    console.error('   Falling back to inline HTML');
    return null;
  }
  
  return `file://${updaterPath}`;
}

/**
 * Fallback inline HTML (for backward compatibility)
 * Used only if external files are not found
 */
function getFallbackHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI FMS - Updating...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: white;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container { text-align: center; padding: 30px; max-width: 350px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #007bff; }
        .status { font-size: 16px; margin-bottom: 15px; opacity: 0.9; }
        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #007bff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">KMTI FMS</div>
        <div class="status" id="status">Loading updater...</div>
        <div class="spinner"></div>
      </div>
      <script>
        window.updaterAPI?.onStatus((data) => {
          document.getElementById('status').textContent = data.status || 'Updating...';
        });
      </script>
    </body>
    </html>`;
}

/**
 * Create the standalone updater window
 * @returns {BrowserWindow} The created window
 */
function createUpdaterWindow() {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.focus();
    return updaterWindow;
  }

  updaterWindow = new BrowserWindow(WINDOW_CONFIG);

  // Try to load external HTML first
  const updaterUrl = getUpdaterUrl();
  
  if (updaterUrl) {
    // Load from file system (production)
    updaterWindow.loadFile(path.join(__dirname, 'client/updater-ui/index.html'));
    console.log('✅ Loading updater UI from:', updaterUrl);
  } else {
    // Fallback to inline HTML
    const fallbackHtml = getFallbackHtml();
    updaterWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
    console.warn('⚠️  Using fallback inline HTML for updater window');
  }

  // Show window when ready
  updaterWindow.once('ready-to-show', () => {
    updaterWindow.show();
    console.log('🔄 Updater window shown');
  });

  // Handle window closed
  updaterWindow.on('closed', () => {
    updaterWindow = null;
    console.log('🔄 Updater window closed');
  });

  // Development tools
  if (isDev) {
    updaterWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle navigation (security)
  updaterWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent navigation to external URLs
    if (!url.startsWith('file://') && !url.startsWith('data:')) {
      event.preventDefault();
      console.warn('⚠️  Prevented navigation to:', url);
    }
  });

  return updaterWindow;
}

/**
 * Show the updater window with specific status
 * @param {string} status - Initial status to display
 * @param {Object} data - Additional data for the status
 */
function showUpdaterWindow(status, data = {}) {
  const window = createUpdaterWindow();
  
  // Wait for window to be ready before sending status
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', () => {
      sendStatusToWindow(window, status, data);
    });
  } else {
    sendStatusToWindow(window, status, data);
  }
}

/**
 * Send status update to the window
 * @param {BrowserWindow} window - Window to send to
 * @param {string} status - Status to send
 * @param {Object} data - Additional data
 */
function sendStatusToWindow(window, status, data = {}) {
  if (!window || window.isDestroyed()) {
    console.warn('⚠️  Cannot send status: window is destroyed');
    return;
  }

  // Small delay to ensure renderer is ready
  setTimeout(() => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('updater:status', { status, ...data });
      console.log(`📤 Sent status to updater window: ${status}`);
    }
  }, 100);
}

/**
 * Update the status in the updater window
 * @param {string} status - Status to update
 * @param {Object} data - Additional data
 */
function updateStatus(status, data = {}) {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send('updater:status', { status, ...data });
  } else {
    console.warn('⚠️  Updater window not available for status update');
  }
}

/**
 * Close the updater window
 */
function closeUpdaterWindow() {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.close();
  }
}

/**
 * Check if updater window is visible
 * @returns {boolean} True if visible
 */
function isUpdaterWindowVisible() {
  return updaterWindow && !updaterWindow.isDestroyed() && updaterWindow.isVisible();
}

/**
 * Get the updater window instance
 * @returns {BrowserWindow|null} The window or null
 */
function getUpdaterWindow() {
  return updaterWindow;
}

// ===== IPC Handlers =====

/**
 * Handle install update request from renderer
 */
ipcMain.on('updater-window:install', () => {
  console.log('🔄 Install update requested from updater window');
  
  // Find main window
  const mainWindow = BrowserWindow.getAllWindows().find(win =>
    win !== updaterWindow && win.getTitle() !== 'KMTI FMS - Updating...'
  );

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:quit-and-install');
  } else {
    console.warn('⚠️  Main window not found, cannot trigger install');
  }
});

/**
 * Handle cancel update request from renderer
 */
ipcMain.on('updater-window:cancel', () => {
  console.log('❌ Update cancelled by user');
  closeUpdaterWindow();
});

// ===== Exports =====

module.exports = {
  createUpdaterWindow,
  showUpdaterWindow,
  updateStatus,
  closeUpdaterWindow,
  isUpdaterWindowVisible,
  getUpdaterWindow
};

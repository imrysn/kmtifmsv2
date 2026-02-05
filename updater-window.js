/**
 * KMTI FMS - Standalone Update Window
 *
 * Features:
 * - Independent update window separate from main application
 * - Real-time update progress display
 * - Automatic update installation
 * - Clean, minimal UI focused on updates
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Updater window instance
let updaterWindow = null;

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
 * Create the standalone updater window
 */
function createUpdaterWindow() {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.focus();
    return updaterWindow;
  }

  updaterWindow = new BrowserWindow(WINDOW_CONFIG);

  // Load the updater UI
  const updaterHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI FMS - Updating...</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: white;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .updater-container {
          text-align: center;
          padding: 30px;
          max-width: 350px;
          width: 100%;
        }

        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          color: #007bff;
        }

        .status {
          font-size: 16px;
          margin-bottom: 15px;
          opacity: 0.9;
          min-height: 20px;
        }

        .progress-container {
          margin: 20px 0;
          display: none;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff 0%, #0056b3 100%);
          width: 0%;
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        .progress-text {
          font-size: 12px;
          opacity: 0.7;
        }

        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #007bff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }

        .buttons {
          display: none;
          gap: 10px;
          justify-content: center;
          margin-top: 20px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #545b62;
        }

        .error-message {
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid rgba(220, 53, 69, 0.3);
          color: #ff6b6b;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
          display: none;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="updater-container fade-in">
        <div class="logo">KMTI FMS</div>
        <div class="status" id="status">Preparing update...</div>

        <div class="spinner" id="spinner"></div>

        <div class="progress-container" id="progressContainer">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-text" id="progressText">0%</div>
        </div>

        <div class="buttons" id="buttons">
          <button class="btn btn-primary" id="installBtn">Install & Restart</button>
          <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
        </div>

        <div class="error-message" id="errorMessage"></div>
      </div>

      <script>
        const statusEl = document.getElementById('status');
        const spinnerEl = document.getElementById('spinner');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const buttons = document.getElementById('buttons');
        const installBtn = document.getElementById('installBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const errorMessage = document.getElementById('errorMessage');

        // Listen for update status from main process
        window.updaterAPI.onStatus((data) => {
          updateUI(data.status, data);
        });

        function updateUI(status, data = {}) {
          switch (status) {
            case 'checking':
              statusEl.textContent = 'Checking for updates...';
              showSpinner(true);
              hideProgress();
              hideButtons();
              hideError();
              break;

            case 'available':
              statusEl.textContent = \`Update ${data.version} available\`;
              showSpinner(false);
              hideProgress();
              hideButtons();
              hideError();
              break;

            case 'downloading':
              statusEl.textContent = 'Downloading update...';
              showSpinner(false);
              showProgress(data.percent || 0);
              hideButtons();
              hideError();
              break;

            case 'downloaded':
              statusEl.textContent = \`Update ${data.version} downloaded\`;
              showSpinner(false);
              hideProgress();
              showButtons();
              hideError();
              break;

            case 'error':
              statusEl.textContent = 'Update failed';
              showSpinner(false);
              hideProgress();
              hideButtons();
              showError(data.message || 'Unknown error occurred');
              break;

            default:
              statusEl.textContent = 'Updating...';
              showSpinner(true);
              hideProgress();
              hideButtons();
              hideError();
          }
        }

        function showSpinner(show) {
          spinnerEl.style.display = show ? 'block' : 'none';
        }

        function showProgress(percent) {
          progressContainer.style.display = 'block';
          progressFill.style.width = \`\${percent}%\`;
          progressText.textContent = \`\${Math.round(percent)}%\`;
        }

        function hideProgress() {
          progressContainer.style.display = 'none';
        }

        function showButtons() {
          buttons.style.display = 'flex';
        }

        function hideButtons() {
          buttons.style.display = 'none';
        }

        function showError(message) {
          errorMessage.textContent = message;
          errorMessage.style.display = 'block';
        }

        function hideError() {
          errorMessage.style.display = 'none';
        }

        // Button event handlers
        installBtn.addEventListener('click', () => {
          window.updaterAPI.installUpdate();
        });

        cancelBtn.addEventListener('click', () => {
          window.updaterAPI.cancelUpdate();
        });
      </script>
    </body>
    </html>`;

  updaterWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(updaterHtml)}`);

  // Show window when ready
  updaterWindow.once('ready-to-show', () => {
    updaterWindow.show();
    console.log('🔄 Standalone updater window shown');
  });

  // Handle window closed
  updaterWindow.on('closed', () => {
    updaterWindow = null;
    console.log('🔄 Updater window closed');
  });

  return updaterWindow;
}

/**
 * Show the updater window with specific status
 */
function showUpdaterWindow(status, data = {}) {
  const window = createUpdaterWindow();
  // Send initial status to the window
  setTimeout(() => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('updater:status', { status, ...data });
    }
  }, 500);
}

/**
 * Update the status in the updater window
 */
function updateStatus(status, data = {}) {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send('updater:status', { status, ...data });
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
 */
function isUpdaterWindowVisible() {
  return updaterWindow && !updaterWindow.isDestroyed() && updaterWindow.isVisible();
}

// IPC handlers for the updater window
ipcMain.on('updater-window:install', () => {
  // Notify main process to install update
  const updater = require('./updater');
  updater.quitAndInstall();
});

ipcMain.on('updater-window:cancel', () => {
  closeUpdaterWindow();
});

// Export functions
module.exports = {
  createUpdaterWindow,
  showUpdaterWindow,
  updateStatus,
  closeUpdaterWindow,
  isUpdaterWindowVisible
};

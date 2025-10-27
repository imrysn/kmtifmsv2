const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let splashWindow;
let serverProcess;
let loadRetryCount = 0;
let viteRetryInterval = null;
let isConnectedToVite = false;

const isDev = process.env.NODE_ENV === 'development';
const SERVER_PORT = process.env.EXPRESS_PORT || 3001;
const VITE_URL = 'http://localhost:5173';
const EXPRESS_CHECK_INTERVAL = 500;
const MAX_EXPRESS_WAIT = 30000; // 30 seconds
const MAX_VITE_WAIT = 20000; // Reduced to 20 seconds for faster feedback
const MAX_LOAD_RETRIES = 10;

/**
 * Show a loading/error page as fallback when Vite isn't responding
 */
function showFallbackPage() {
  if (mainWindow && mainWindow.webContents) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI File Management System - Connecting...</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .container {
          text-align: center;
          animation: fadeIn 0.5s ease-in-out;
        }
        .spinner {
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }
        .title {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .message {
          font-size: 16px;
          opacity: 0.9;
          line-height: 1.5;
        }
        .retry-btn {
          margin-top: 30px;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }
        .retry-btn:hover {
          background: white;
          color: #667eea;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <div class="title">Loading KMTI File Management System</div>
        <div class="message">
          Connecting to development server...<br>
          This might take a few seconds.
        </div>
        <button class="retry-btn" onclick="window.location.reload()">Retry Connection</button>
      </div>
      <script>
        let retryCount = 0;
        const maxRetries = 30;

        function checkConnection() {
          retryCount++;
          if (retryCount > maxRetries) {
            document.querySelector('.message').innerHTML = 'Connection timeout.<br>Please restart the application.';
            document.querySelector('.spinner').style.display = 'none';
            return;
          }

          fetch('${VITE_URL}', { mode: 'no-cors' })
            .then(() => {
              window.location.href = '${VITE_URL}';
            })
            .catch(() => {
              setTimeout(checkConnection, 5000);
            });
        }

        setTimeout(checkConnection, 2000);
      </script>
    </body>
    </html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    mainWindow.show();
    console.log('🛑 Showing fallback loading page while waiting for Vite server...');
  }
}

/**
 * Check Vite connection and retry if needed
 */
function checkViteConnection() {
  if (!isDev || !mainWindow) return;

  checkViteServer().then((isReady) => {
    if (isReady && !isConnectedToVite) {
      console.log('🔄 Vite server detected! Loading React app...');
      isConnectedToVite = true;
      loadRetryCount = 0;
      mainWindow.loadURL(VITE_URL);

      if (viteRetryInterval) {
        clearInterval(viteRetryInterval);
        viteRetryInterval = null;
      }
    }
  }).catch(() => {
    // Continue checking
  });
}

/**
 * Create and show splash window - NOW SHOWS IMMEDIATELY
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false, // Will show after ready-to-show
    backgroundColor: '#667eea',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI File Management System - Loading...</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .container {
          text-align: center;
          animation: fadeIn 0.3s ease-in-out;
        }
        .spinner {
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 20px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .title {
          font-size: 18px;
          margin-bottom: 10px;
          opacity: 0.9;
        }
        .message {
          font-size: 14px;
          opacity: 0.8;
          line-height: 1.5;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">KMTI</div>
        <div class="spinner"></div>
        <div class="title">File Management System</div>
        <div class="message">
          ${isDev ? 'Starting development server...' : 'Initializing...'}
        </div>
      </div>
    </body>
    </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    console.log('🚀 Splash window shown');
  });

  return splashWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#667eea', // Match splash background to prevent flash
    show: false, // CHANGED: Don't show immediately, wait for content
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      spellcheck: false,
      sandbox: true,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'AutoplayPolicy',
      webSecurity: true,
      allowRunningInsecureContent: false
    },
  });

  mainWindow.once('ready-to-show', () => {
    // Close splash window FIRST
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      console.log('🏁 Splash window closed');
    }
    // Then show main window
    mainWindow.show();
    console.log('✅ Main Electron window opened!');
  });

  if (isDev) {
    console.log(`🔗 Attempting to load React app from ${VITE_URL}`);

    // IMPROVED: Show content faster
    mainWindow.webContents.on('did-start-loading', () => {
      console.log('🔄 Page started loading...');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      loadRetryCount++;
      console.error(`❌ Failed to load (attempt ${loadRetryCount}/${MAX_LOAD_RETRIES}): ${errorCode} - ${errorDescription}`);

      if (loadRetryCount >= MAX_LOAD_RETRIES) {
        console.error('❌ Max retries reached. Showing fallback page.');
        showFallbackPage();
        // Close splash and show main window with fallback
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.destroy();
        }
        mainWindow.show();
        return;
      }

      const retryDelay = Math.min(1000 * Math.pow(1.5, loadRetryCount - 1), 5000);
      setTimeout(() => {
        console.log(`🔄 Retrying connection to Vite (attempt ${loadRetryCount + 1})...`);
        mainWindow.loadURL(VITE_URL);
      }, retryDelay);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      loadRetryCount = 0;
      isConnectedToVite = true;
      console.log('✅ Page loaded successfully');
      
      // Open DevTools after a short delay
      setTimeout(() => {
        mainWindow.webContents.openDevTools();
      }, 500);
    });

    mainWindow.webContents.on('crashed', () => {
      console.error('❌ Renderer process crashed!');
      showFallbackPage();
      mainWindow.show();
    });

    mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
      console.log(`🖼️  [Renderer]: ${message}`);
    });

    // Start checking immediately
    checkViteConnection();
    viteRetryInterval = setInterval(checkViteConnection, 3000);

    mainWindow.loadURL(VITE_URL);
  } else {
    const indexPath = path.join(__dirname, 'client/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    isConnectedToVite = false;
    if (viteRetryInterval) {
      clearInterval(viteRetryInterval);
      viteRetryInterval = null;
    }
  });
}

/**
 * Check if Vite is fully ready
 */
function checkViteServer() {
  return new Promise((resolve) => {
    const req = http.get(VITE_URL, { timeout: 2000 }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 304) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if Express is responding
 */
function checkExpressServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${SERVER_PORT}`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode < 500);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Start Express server
 */
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Express server...');
    
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: 'pipe',
      env: { 
        ...process.env, 
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: SERVER_PORT
      }
    });

    let serverReady = false;
    let startTimeout;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`📡 ${output}`);
        
        if ((output.includes('running') || output.includes('listening')) && !serverReady) {
          serverReady = true;
          clearTimeout(startTimeout);
          console.log('✅ Express server is ready!');
          resolve();
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      if (error && !error.includes('Warning')) {
        console.error(`⚠️  ${error}`);
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(startTimeout);
      console.error('❌ Failed to start server:', error.message);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`⚠️  Server exited with code ${code}`);
      }
    });

    startTimeout = setTimeout(() => {
      if (!serverReady) {
        console.warn('⚠️  Server startup timeout, proceeding anyway...');
        resolve();
      }
    }, MAX_EXPRESS_WAIT);
  });
}

/**
 * Wait for Vite server - FASTER with early bailout
 */
function waitForViteServer() {
  return new Promise((resolve) => {
    if (!isDev) {
      resolve();
      return;
    }

    console.log('⏳ Waiting for Vite dev server...');
    let attempts = 0;
    const maxAttempts = Math.ceil(MAX_VITE_WAIT / 500);

    const checkServer = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        console.error(`❌ Vite server did not start within ${MAX_VITE_WAIT / 1000}s`);
        console.error('💡 Troubleshooting:');
        console.error('   1. Check if port 5173 is in use: netstat -ano | findstr :5173');
        console.error('   2. Try: cd client && npm install && npm run dev');
        console.error('   3. Restart the application');
        console.warn('⚠️  Proceeding anyway - fallback page will be shown...');
        resolve(); // Resolve anyway to not block
        return;
      }

      try {
        const isReady = await checkViteServer();

        if (isReady) {
          console.log('✅ Vite dev server is ready!');
          resolve();
          return;
        }
      } catch (error) {
        // Continue trying
      }

      if (attempts % 10 === 0) {
        const elapsed = Math.floor(attempts * 0.5);
        console.log(`⏳ Still waiting for Vite... (${elapsed}s/${MAX_VITE_WAIT / 1000}s)`);
      }

      setTimeout(checkServer, 500);
    };

    checkServer();
  });
}

/**
 * Graceful shutdown handler
 */
function shutdownServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log('🛑 Stopping Express server...');
    serverProcess.kill('SIGTERM');
    
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 3000);
  }
}

if (app) {
  // CRITICAL: Disable hardware acceleration to prevent GPU crashes
  app.disableHardwareAcceleration();
  console.log('🔧 Hardware acceleration disabled (prevents GPU crashes)');

  app.on('ready', async () => {
    console.log('⚡ Electron app is ready!');

    app.on('child-process-gone', (event, details) => {
      console.error('❌ Child process error:', details.type, details.reason);
      if (details.type === 'GPU') {
        console.error('💡 GPU process crashed. Hardware acceleration issue detected.');
      }
    });

    const { session } = require('electron');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
          ]
        }
      });
    });

    console.log('🔒 Content Security Policy configured');

    try {
      // Create splash window FIRST - shows immediately
      createSplashWindow();

      // Start Express server in parallel
      const serverPromise = startServer();

      // Create main window immediately (hidden)
      createWindow();

      // Wait for server (but don't block window creation)
      await serverPromise;

      // Wait briefly for Vite (but proceed even if not ready)
      await waitForViteServer();

    } catch (error) {
      console.error('❌ Failed to start application:', error.message);
      if (splashWindow) splashWindow.destroy();
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });

  app.on('window-all-closed', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }

    shutdownServer();

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }
    shutdownServer();
  });
}

if (ipcMain) {
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths || []
    };
  });

  ipcMain.handle('file:openInApp', async (event, filePath) => {
    try {
      const fs = require('fs');

      console.log(`📂 Opening file: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const result = await shell.openPath(filePath);

      if (result) {
        console.error('❌ Error opening file:', result);
        return { success: false, error: result };
      }

      console.log('✅ File opened successfully');
      return { success: true, method: 'system-default' };

    } catch (error) {
      console.error('❌ Error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

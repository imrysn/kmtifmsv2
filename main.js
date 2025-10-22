const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;
let loadRetryCount = 0;
let viteRetryInterval = null;
let isConnectedToVite = false;

const isDev = process.env.NODE_ENV === 'development';
const SERVER_PORT = process.env.EXPRESS_PORT || 3001;
const VITE_URL = 'http://localhost:5173';
const EXPRESS_CHECK_INTERVAL = 500;
const MAX_EXPRESS_WAIT = 30000; // 30 seconds
const MAX_VITE_WAIT = 60000; // 60 seconds for Vite startup
const MAX_LOAD_RETRIES = 10; // Maximum retries for page loading

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
          animation: fadeIn 1s ease-in-out;
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
        // Auto-retry every 10 seconds
        let retryCount = 0;
        const maxRetries = 30; // 5 minutes max

        function checkConnection() {
          retryCount++;
          if (retryCount > maxRetries) {
            document.querySelector('.message').innerHTML = 'Connection timeout.<br>Please restart the application.';
            document.querySelector('.spinner').style.display = 'none';
            return;
          }

          fetch('${VITE_URL}', { mode: 'no-cors' })
            .then(() => {
              // If we get here, connection succeeded
              window.location.href = '${VITE_URL}';
            })
            .catch(() => {
              setTimeout(checkConnection, 10000);
            });
        }

        setTimeout(checkConnection, 3000);
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
      // Vite is now available, load the actual app
      console.log('🔄 Vite server detected! Loading React app...');
      isConnectedToVite = true;
      loadRetryCount = 0; // Reset retry count
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // icon: path.join(__dirname, 'assets/kmti_logo.png'),
    backgroundColor: '#ffffff',
    show: true, // Show immediately to prevent black screen
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      backgroundThrottling: false,
      spellcheck: false,
      sandbox: true,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'AutoplayPolicy', // Prevent autoplay issues
      // Security: Content Security Policy
      webSecurity: true,
      allowRunningInsecureContent: false
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Electron window opened!');
  });

  if (isDev) {
    console.log(`🔗 Attempting to load React app from ${VITE_URL}`);

    // Enhanced error handling for load failures
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      loadRetryCount++;
      console.error(`❌ Failed to load (attempt ${loadRetryCount}/${MAX_LOAD_RETRIES}): ${errorCode} - ${errorDescription}`);

      if (loadRetryCount >= MAX_LOAD_RETRIES) {
        console.error('❌ Max retries reached. Showing fallback page.');
        showFallbackPage();
        return;
      }

      // Retry after a delay with exponential backoff
      const retryDelay = Math.min(2000 * Math.pow(2, loadRetryCount - 1), 10000);
      setTimeout(() => {
        console.log(`🔄 Retrying connection to Vite (attempt ${loadRetryCount + 1})...`);
        mainWindow.loadURL(VITE_URL);
      }, retryDelay);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      loadRetryCount = 0; // Reset on success
      isConnectedToVite = true;
      console.log('✅ Page loaded successfully');
      // Open DevTools AFTER page loads
      setTimeout(() => {
        mainWindow.webContents.openDevTools();
      }, 500);
    });

    mainWindow.webContents.on('crashed', () => {
      console.error('❌ Renderer process crashed!');
      showFallbackPage();
    });

    // Enable remote debugging for troubleshooting
    mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
      console.log(`🖼️  [Renderer]: ${message}`);
    });

    // Start periodic checking if Vite isn't responding
    checkViteConnection();
    viteRetryInterval = setInterval(checkViteConnection, 5000); // Check every 5 seconds

    mainWindow.loadURL(VITE_URL);
  } else {
    // Production: load from built files
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
 * Check if Vite is fully ready (not just responding, but ready to render)
 */
function checkViteServer() {
  return new Promise((resolve) => {
    const req = http.get(VITE_URL, { timeout: 2000 }, (res) => {
      // Check if we get a successful response
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
 * Start Express server with better error handling
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
        
        // Check for success indicators
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

    // Timeout: if server doesn't respond within 30 seconds, continue anyway
    startTimeout = setTimeout(() => {
      if (!serverReady) {
        console.warn('⚠️  Server startup timeout, proceeding anyway...');
        resolve(); // Continue despite timeout
      }
    }, MAX_EXPRESS_WAIT);
  });
}

/**
 * Wait for Vite server to be ready with improved black screen prevention
 */
function waitForViteServer() {
  return new Promise((resolve) => {
    if (!isDev) {
      resolve();
      return;
    }

    console.log('⏳ Waiting for Vite dev server...');
    let attempts = 0;
    const maxAttempts = Math.ceil(MAX_VITE_WAIT / 500); // Check every 500ms

    const checkServer = async () => {
      attempts++;

        if (attempts > maxAttempts) {
          console.error(`❌ Vite server did not start within ${MAX_VITE_WAIT / 1000}s`);
          console.error('💡 Troubleshooting:');
          console.error('   1. Check if port 5173 is in use: netstat -ano | findstr :5173');
          console.error('   2. Try: cd client && npm install && npm run dev');
          console.error('   3. Restart the application');
          console.warn('⚠️  Showing fallback loading page since Vite failed to start...');
          // Show fallback page immediately when Vite fails to start
          showFallbackPage();
          resolve();
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

      if (attempts % 20 === 0) {
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
    
    // Force kill after 3 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 3000);
  }
}

// Disable GPU hardware acceleration to prevent GPU process crashes
// This fixes the "GPU process exited unexpectedly" error
app.disableHardwareAcceleration();
console.log('⚙️  Hardware acceleration disabled for stability');

// Handle child process errors more gracefully
app.on('child-process-gone', (event, details) => {
  console.error('❌ Child process error:', details.type, details.reason);
  if (details.type === 'GPU') {
    console.error('💡 GPU process crashed. Hardware acceleration is disabled, but the error may persist.');
    console.error('   Possible causes: outdated GPU drivers, incompatible graphics card, or Windows graphics settings.');
  }
});

app.whenReady().then(async () => {
  console.log('⚡ Electron app is ready!');
  
  // Configure session for better security
  const { session } = require('electron');
  
  // Set Content Security Policy via session
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev 
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
        ]
      }
    });
  });
  
  console.log('🔒 Content Security Policy configured');
  
  try {
    // Start Express server
    await startServer();
    
    // Wait for Vite in development
    await waitForViteServer();
    
    // Create the window
    createWindow();
  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  shutdownServer();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', shutdownServer);

// IPC Handlers
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
    const { shell } = require('electron');
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

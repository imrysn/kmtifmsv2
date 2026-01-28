const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const updaterWindow = require('./updater-window');
const updater = require('./updater'); // Import updater module for window registration

let mainWindow;
let splashWindow;
let serverProcess;
let loadRetryCount = 0;
let viteRetryInterval = null;
let isConnectedToVite = false;
let splashTimeout = null;

const isDev = process.env.NODE_ENV === 'development';
const isProduction = !isDev;
const SERVER_MODE = process.env.SERVER_MODE || 'embedded'; // 'embedded' or 'remote'
const REMOTE_SERVER_URL = process.env.REMOTE_SERVER_URL || 'http://192.168.200.105:3001';
const SERVER_PORT = process.env.EXPRESS_PORT || 3001;
const VITE_URL = 'http://localhost:5173';
const EXPRESS_CHECK_INTERVAL = 500;
const MAX_EXPRESS_WAIT = 30000;
const MAX_VITE_WAIT = 60000;
const MAX_LOAD_RETRIES = 10;
const SPLASH_TIMEOUT = 15000; // 15 second max for splash screen

// FIXED: PID file for tracking server process
const PID_FILE = path.join(app.getPath('userData'), 'server.pid');

// FIXED: Import port utilities for cleanup
const { isPortAvailable, waitForPortToBeFree, killProcess, findProcessByPort } = require('./server/utils/portUtils');

// Logging utility with levels
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = isDev ? LogLevel.DEBUG : LogLevel.INFO;

function log(level, message, ...args) {
  if (level <= currentLogLevel) {
    const prefix = {
      [LogLevel.ERROR]: '❌',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.INFO]: '✅',
      [LogLevel.DEBUG]: '🔍'
    }[level] || '📝';

    console.log(`${prefix} ${message}`, ...args);
  }
}

/*** Show a loading/error page as fallback when Vite isn't responding */
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
    log(LogLevel.INFO, 'Showing fallback loading page while waiting for Vite server...');
  }
}

/**
 * Show error page when production build is missing
 */
function showProductionErrorPage(error) {
  if (mainWindow && mainWindow.webContents) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI FMS - Build Error</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          max-width: 600px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .message {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 25px;
          opacity: 0.95;
        }
        .details {
          background: rgba(0,0,0,0.2);
          padding: 15px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          margin-bottom: 25px;
          text-align: left;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #dc2626;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <div class="title">Application Build Not Found</div>
        <div class="message">
          The application interface could not be loaded. This usually happens when the build files are missing or corrupted.
        </div>
        <div class="details">
          Error: ${error}<br>
          <br>
          Please rebuild the application:<br>
          1. npm run client:build<br>
          2. npm run build
        </div>
        <a href="#" onclick="require('electron').ipcRenderer.send('app:restart')" class="button">
          Restart Application
        </a>
      </div>
    </body>
    </html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    mainWindow.show();
  }
}

/**
 * Check Vite connection and retry if needed
 */
function checkViteConnection() {
  if (!isDev || !mainWindow) return;

  checkViteServer().then((isReady) => {
    if (isReady && !isConnectedToVite) {
      log(LogLevel.INFO, 'Vite server detected! Loading React app...');
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

/*** Create and show splash window - SHOWS IMMEDIATELY, NO BLOCKING */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    backgroundColor: '#667eea',
    icon: path.join(__dirname, 'client/src/assets/fms-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
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
          min-height: 20px;
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
        <div class="spinner" id="spinner"></div>
        <div class="title">File Management System</div>
        <div class="message" id="message">
          ${isDev ? 'Starting development server...' : 'Initializing application...'}
        </div>
      </div>
    </body>
    </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    log(LogLevel.INFO, 'Splash window shown');

    // Register splash window with updater for IPC communication
    if (isProduction) {
      updater.setSplashWindow(splashWindow);
      log(LogLevel.INFO, 'Splash window registered with updater');
    }

    // Safety timeout: force close splash after max time
    splashTimeout = setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        log(LogLevel.WARN, 'Splash timeout reached, forcing close');
        splashWindow.destroy();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        }
      }
    }, SPLASH_TIMEOUT);
  });

  return splashWindow;
}

/**
 * Validate production build exists
 */
function validateProductionBuild() {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  const distPath = path.join(__dirname, 'client/dist');

  if (!fs.existsSync(distPath)) {
    throw new Error('client/dist directory not found. Run: npm run client:build');
  }

  if (!fs.existsSync(indexPath)) {
    throw new Error('client/dist/index.html not found. Run: npm run client:build');
  }

  // Check if dist has content
  const files = fs.readdirSync(distPath);
  if (files.length < 2) { // Should have at least index.html and assets
    throw new Error('client/dist appears to be empty. Run: npm run client:build');
  }

  log(LogLevel.INFO, 'Production build validated');
  return indexPath;
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = Math.floor(screenWidth * 0.8);
  const windowHeight = Math.floor(screenHeight * 0.8);
  const shouldAutoMaximize = screenWidth <= 1920 || screenHeight <= 1080;

  log(LogLevel.DEBUG, `Screen detected: ${screenWidth}x${screenHeight}`);
  log(LogLevel.DEBUG, `Window size: ${windowWidth}x${windowHeight}`);
  log(LogLevel.DEBUG, `Auto-maximize: ${shouldAutoMaximize ? 'Yes' : 'No'}`);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    backgroundColor: '#667eea',
    show: false,
    icon: path.join(__dirname, 'client/src/assets/fms-icon.png'),
    center: true,
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

  if (shouldAutoMaximize) {
    mainWindow.maximize();
    log(LogLevel.DEBUG, 'Window auto-maximized');
  }

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    // Clear splash timeout
    if (splashTimeout) {
      clearTimeout(splashTimeout);
      splashTimeout = null;
    }

    // Close splash window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      log(LogLevel.INFO, 'Splash window closed');
    }

    // Register main window with updater for IPC communication
    if (isProduction) {
      updater.setMainWindow(mainWindow);
      log(LogLevel.INFO, 'Main window registered with updater');
    }

    mainWindow.show();
    log(LogLevel.INFO, 'Main Electron window opened!');
  });

  if (isDev) {
    log(LogLevel.DEBUG, `Attempting to load React app from ${VITE_URL}`);

    mainWindow.webContents.on('did-start-loading', () => {
      log(LogLevel.DEBUG, 'Page started loading...');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      loadRetryCount++;
      log(LogLevel.ERROR, `Failed to load (attempt ${loadRetryCount}/${MAX_LOAD_RETRIES}): ${errorCode} - ${errorDescription}`);

      if (loadRetryCount >= MAX_LOAD_RETRIES) {
        log(LogLevel.ERROR, 'Max retries reached. Showing fallback page.');
        showFallbackPage();

        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.destroy();
        }
        mainWindow.show();
        return;
      }

      const retryDelay = Math.min(1000 * Math.pow(1.5, loadRetryCount - 1), 5000);
      setTimeout(() => {
        log(LogLevel.DEBUG, `Retrying connection to Vite (attempt ${loadRetryCount + 1})...`);
        mainWindow.loadURL(VITE_URL);
      }, retryDelay);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      loadRetryCount = 0;
      isConnectedToVite = true;
      log(LogLevel.INFO, 'Page loaded successfully');
    });

    mainWindow.webContents.on('crashed', () => {
      log(LogLevel.ERROR, 'Renderer process crashed!');
      showFallbackPage();
      mainWindow.show();
    });

    if (currentLogLevel >= LogLevel.DEBUG) {
      mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
        log(LogLevel.DEBUG, `[Renderer]: ${message}`);
      });
    }

    checkViteConnection();
    viteRetryInterval = setInterval(checkViteConnection, 3000);

    mainWindow.loadURL(VITE_URL).catch(err => {
      log(LogLevel.ERROR, 'Failed to load Vite URL:', err);
      showFallbackPage();
      mainWindow.show();
    });
  } else {
    // PRODUCTION MODE - with validation
    try {
      const indexPath = validateProductionBuild();
      mainWindow.loadFile(indexPath).catch(err => {
        log(LogLevel.ERROR, 'Failed to load production build:', err.message);
        showProductionErrorPage(err.message);
      });
    } catch (error) {
      log(LogLevel.ERROR, 'Production build validation failed:', error.message);
      showProductionErrorPage(error.message);
      mainWindow.show();
    }
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

/*** Check if Vite is fully ready */
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

/*** Check if Express is responding */
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

/*** Start Express server */
function startServer() {
  return new Promise((resolve, reject) => {
    log(LogLevel.INFO, 'Starting Express server...');

    let serverPath;
    let spawnCommand;
    let spawnArgs;

    // 1. Determine the correct path based on environment
    if (app.isPackaged) {
      // In production (installed app), try to use the standalone server executable first
      const exePath = path.join(path.dirname(process.execPath), 'KMTI_FMS_Server.exe');

      if (require('fs').existsSync(exePath)) {
        // Use the standalone server executable
        serverPath = exePath;
        spawnCommand = exePath;
        spawnArgs = [];
        log(LogLevel.INFO, `Using standalone server executable: ${exePath}`);
      } else {
        // Fallback to bundled server
        serverPath = path.join(process.resourcesPath, 'app-server', 'index.js');
        spawnCommand = 'node';
        spawnArgs = [serverPath];
        log(LogLevel.INFO, `Using bundled server: ${serverPath}`);
      }
    } else {
      // In development or "npm run prod" (source mode), run the source file directly
      serverPath = path.join(__dirname, 'server.js');
      spawnCommand = 'node';
      spawnArgs = [serverPath];
      log(LogLevel.INFO, `Using source server file: ${serverPath}`);
    }

    // 2. Prepare Environment Variables
    const serverEnv = {
      ...process.env,
      NODE_ENV: isProduction ? 'production' : 'development',
      PORT: SERVER_PORT,
      // Tell the server where the database is
      DB_BASE_PATH: app.isPackaged && process.resourcesPath
        ? path.join(process.resourcesPath, 'database')
        : path.join(__dirname, 'database'),
    };

    // 3. Spawn the process
    serverProcess = spawn(spawnCommand, spawnArgs, {
      stdio: 'pipe',
      env: serverEnv,
      cwd: path.dirname(serverPath) // Important for relative paths inside the server
    });

    // ... (Keep the rest of your logging/event listener logic from here down) ...
    let serverReady = false;
    let startTimeout;

    serverProcess.stdout.on('data', (data) => {
      // ... keep existing code ...
      const output = data.toString().trim();
      if (output) {
        if (currentLogLevel >= LogLevel.DEBUG) console.log(`📡 ${output}`);
        if ((output.includes('running') || output.includes('listening')) && !serverReady) {
          serverReady = true;
          clearTimeout(startTimeout);
          log(LogLevel.INFO, 'Express server is ready!');
          resolve();
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // ... keep existing code ...
      const error = data.toString().trim();
      if (error && !error.includes('Warning')) log(LogLevel.WARN, `Server: ${error}`);
    });

    serverProcess.on('error', (error) => {
      clearTimeout(startTimeout);
      log(LogLevel.ERROR, 'Failed to start server:', error.message);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) log(LogLevel.WARN, `Server exited with code ${code}`);
    });

    startTimeout = setTimeout(() => {
      if (!serverReady) {
        log(LogLevel.WARN, 'Server startup timeout, proceeding anyway...');
        resolve();
      }
    }, MAX_EXPRESS_WAIT);
  });
}

/*** Wait for Vite server - FASTER with early bailout */
function waitForViteServer() {
  return new Promise((resolve) => {
    if (!isDev) {
      resolve();
      return;
    }

    log(LogLevel.DEBUG, 'Waiting for Vite dev server...');
    let attempts = 0;
    const maxAttempts = Math.ceil(MAX_VITE_WAIT / 500);

    const checkServer = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        log(LogLevel.WARN, `Vite server did not start within ${MAX_VITE_WAIT / 1000}s`);
        log(LogLevel.WARN, 'Proceeding anyway - fallback page will be shown...');
        resolve();
        return;
      }

      try {
        const isReady = await checkViteServer();

        if (isReady) {
          log(LogLevel.INFO, 'Vite dev server is ready!');
          resolve();
          return;
        }
      } catch (error) {
        // Continue checking
      }

      if (attempts % 10 === 0 && currentLogLevel >= LogLevel.DEBUG) {
        const elapsed = Math.floor(attempts * 0.5);
        log(LogLevel.DEBUG, `Still waiting for Vite... (${elapsed}s/${MAX_VITE_WAIT / 1000}s)`);
      }

      setTimeout(checkServer, 500);
    };

    checkServer();
  });
}

/*** Graceful shutdown handler */
function shutdownServer() {
  if (serverProcess && !serverProcess.killed) {
    log(LogLevel.INFO, 'Stopping Express server...');
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
  log(LogLevel.INFO, 'Hardware acceleration disabled (prevents GPU crashes)');

  app.on('ready', async () => {
    log(LogLevel.INFO, 'Electron app is ready!');

    try {
      app.on('child-process-gone', (event, details) => {
        log(LogLevel.ERROR, 'Child process error:', details.type, details.reason);
        if (details.type === 'GPU') {
          log(LogLevel.ERROR, 'GPU process crashed. Hardware acceleration issue detected.');
        }
      });

      log(LogLevel.INFO, 'Setting up session and CSP...');
      const { session } = require('electron');

      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              isDev
                ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com http: https:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
                : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com http: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
            ]
          }
        });
      });

      log(LogLevel.INFO, 'Content Security Policy configured');
      // CRITICAL FIX: Create splash window FIRST - instant visual feedback
      createSplashWindow();

      console.log('🔧 ABOUT TO START SERVER PROMISE');

      // Start Express server in parallel (non-blocking) - only if in embedded mode
      let serverPromise;
      if (SERVER_MODE === 'embedded') {
        log(LogLevel.INFO, 'Starting embedded server mode...');
        serverPromise = startServer().catch(error => {
          log(LogLevel.ERROR, 'Server startup failed:', error.message);
          log(LogLevel.ERROR, 'Server error stack:', error.stack);
          // Don't crash the app, just log the error
          return null;
        });
      } else {
        log(LogLevel.INFO, `Remote server mode - connecting to ${REMOTE_SERVER_URL}`);
        serverPromise = Promise.resolve(); // Skip server startup
      }

      // Create main window immediately (hidden, non-blocking)
      createWindow();

      // Wait for server (but don't block UI)
      const serverResult = await serverPromise;
      if (serverResult === null) {
        log(LogLevel.ERROR, 'Server failed to start - app will run without backend');
      } else {
        log(LogLevel.INFO, 'Server started successfully');
      }

      // Wait briefly for Vite in dev mode (non-blocking)
      if (isDev) {
        await waitForViteServer();
      }

      // CRITICAL FIX: Initialize standalone updater window AFTER main windows are created
      // This ensures the updater runs independently of the main application
      if (isProduction) {
        // Run health check to verify app is working after potential update
        setImmediate(async () => {
          try {
            const healthy = await updater.checkStartupHealth();
            if (healthy) {
              log(LogLevel.INFO, 'Startup health check passed');
            } else {
              log(LogLevel.WARN, 'Startup health check failed - update may have issues');
            }
          } catch (error) {
            log(LogLevel.ERROR, 'Health check error:', error.message);
          }

          // Start automatic update checks in BACKGROUND (non-blocking)
          // Updates will show in dedicated updater window
          updater.startPeriodicUpdateCheck();
          log(LogLevel.INFO, 'Standalone updater system initialized');
        });
      }

    } catch (error) {
      log(LogLevel.ERROR, 'Failed to start application:', error.message);
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
      }

      // Show error dialog
      dialog.showErrorBox(
        'Startup Failed',
        `The application failed to start:\n\n${error.message}\n\nPlease check the logs and try again.`
      );

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

    if (splashTimeout) {
      clearTimeout(splashTimeout);
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

    if (splashTimeout) {
      clearTimeout(splashTimeout);
    }

    shutdownServer();
  });
}

if (ipcMain) {
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
      // Try to get network path from environment or config
      // Default to a common Windows network share path
      const networkPath = process.env.NETWORK_PROJECTS_PATH || '\\\\KMTI-NAS\\Shared\\Public\\PROJECTS';

      // Check if path exists
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

  ipcMain.handle('file:openInApp', async (event, filePath) => {
    try {
      // SECURITY: Validate input
      if (!filePath || typeof filePath !== 'string') {
        log(LogLevel.WARN, 'Invalid file path provided');
        return { success: false, error: 'Invalid file path' };
      }

      // Normalize the path for Windows
      const normalizedPath = path.normalize(filePath);

      // SECURITY: Check if file exists before attempting to open
      // This prevents attempting to open non-existent or invalid paths
      if (!fs.existsSync(normalizedPath)) {
        log(LogLevel.WARN, 'File not found:', normalizedPath);
        return { success: false, error: 'File not found or has been deleted/moved' };
      }

      // SECURITY: Verify it's actually a file, not a directory
      const stats = fs.statSync(normalizedPath);
      if (stats.isDirectory()) {
        log(LogLevel.WARN, 'Attempted to open directory as file:', normalizedPath);
        return { success: false, error: 'Cannot open directory as file' };
      }

      log(LogLevel.DEBUG, `Opening file with system default application: ${normalizedPath}`);

      // Use shell.openPath to open with default application
      const result = await shell.openPath(normalizedPath);

      if (result) {
        // If result is not empty, it means there was an error
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

  // Handle window flashing for notifications - DISABLED to prevent blinking
  ipcMain.on('window:flashFrame', (event, shouldFlash) => {
    // DISABLED: Window flashing was causing the entire app to blink
    // if (mainWindow && !mainWindow.isDestroyed()) {
    //   log(LogLevel.DEBUG, `Window flash: ${shouldFlash ? 'START' : 'STOP'}`);
    //   mainWindow.flashFrame(shouldFlash);
    // }
    log(LogLevel.DEBUG, `Window flash request ignored (disabled to prevent blinking)`);
  });

  // Updater IPC handlers - now handled by updater-window module
  ipcMain.on('updater:quit-and-install', () => {
    if (isProduction) {
      const updater = require('./updater');
      updater.quitAndInstall();
    }
  });

  ipcMain.on('updater:check-for-updates', () => {
    if (isProduction) {
      const updater = require('./updater');
      updater.checkForUpdates();
    }
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });
}

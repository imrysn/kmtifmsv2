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
  // Get primary display dimensions for fullscreen splash
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  splashWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'client/src/assets/fms-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load gear icon and convert to base64
  const gearIconPath = path.join(__dirname, 'client/src/assets/gearicon.png');
  let gearIconBase64 = '';
  try {
    const gearIconBuffer = require('fs').readFileSync(gearIconPath);
    gearIconBase64 = `data:image/png;base64,${gearIconBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Failed to load gear icon:', err);
  }

  const splashHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KMTI File Management System - Loading...</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
          background: #ffffff;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .container {
          text-align: center;
          animation: fadeIn 0.3s ease-out;
          width: 100%;
          max-width: 500px;
          padding: 40px;
        }
        
        .logo-wrapper {
          margin-bottom: 50px;
        }
        
        .logo {
          font-size: 38px;
          font-weight: 600;
          color: #1c1e21;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        
        .subtitle {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        
        .gear-wrapper {
          margin: 40px 0;
          position: relative;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .gear {
          width: 60px;
          height: 60px;
          animation: rotate 2s linear infinite;
        }
        
        .progress-section {
          margin-top: 50px;
        }
        
        .progress-label {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 12px;
          font-weight: 500;
        }
        
        .progress-bar-container {
          width: 100%;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        
        .progress-bar {
          height: 100%;
          background: #1c1e21;
          border-radius: 2px;
          width: 0%;
          transition: width 0.3s ease-out;
        }
        
        .progress-percent {
          margin-top: 8px;
          font-size: 14px;
          color: #1c1e21;
          font-weight: 600;
        }
        
        @keyframes rotate {
          0% { 
            transform: rotate(0deg); 
          }
          100% { 
            transform: rotate(360deg); 
          }
        }
        
        @keyframes fadeIn {
          from { 
            opacity: 0;
          }
          to { 
            opacity: 1;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-wrapper">
          <div class="logo">KMTI</div>
          <div class="subtitle">File Management System</div>
        </div>
        
        <div class="gear-wrapper">
          <img src="${gearIconBase64}" class="gear" alt="Loading">
        </div>
        
        <div class="progress-section">
          <div class="progress-label">Initializing application...</div>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="progress-percent" id="progressPercent">0%</div>
        </div>
      </div>
      
      <script>
        // Simulate loading progress
        let progress = 0;
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressLabel = document.querySelector('.progress-label');
        
        const stages = [
          { percent: 20, label: 'Loading resources...' },
          { percent: 40, label: 'Connecting to database...' },
          { percent: 60, label: 'Initializing services...' },
          { percent: 80, label: 'Starting server...' },
          { percent: 100, label: 'Ready!' }
        ];
        
        let currentStage = 0;
        
        const updateProgress = () => {
          if (currentStage < stages.length) {
            const stage = stages[currentStage];
            const targetProgress = stage.percent;
            
            const interval = setInterval(() => {
              if (progress < targetProgress) {
                progress += 2;
                if (progress > targetProgress) progress = targetProgress;
                
                progressBar.style.width = progress + '%';
                progressPercent.textContent = progress + '%';
                progressLabel.textContent = stage.label;
              } else {
                clearInterval(interval);
                currentStage++;
                setTimeout(updateProgress, 200);
              }
            }, 30);
          }
        };
        
        // Start progress animation after a short delay
        setTimeout(updateProgress, 300);
      </script>
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
    backgroundColor: '#ffffff',
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

  // ── ZOOM LOCK ── Prevent any zoom in the entire app window
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.setZoomFactor(1);

  // Block Ctrl+Plus / Ctrl+Minus / Ctrl+0 / Ctrl+scroll keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && (input.key === '+' || input.key === '-' || input.key === '=' || input.key === '0')) {
      event.preventDefault();
    }
  });

  // Re-lock after every navigation (SPA route changes, hot reloads in dev, etc.)
  mainWindow.webContents.on('did-finish-load', () => {
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.setZoomFactor(1);
  });

  mainWindow.once('ready-to-show', () => {
    // Clear splash timeout
    if (splashTimeout) {
      clearTimeout(splashTimeout);
      splashTimeout = null;
    }

    // Close splash window after minimum display time
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
        log(LogLevel.INFO, 'Splash window closed');
      }
    }, 3000); // Keep splash visible for 3 seconds

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
async function startServer() {
  log(LogLevel.INFO, 'Starting Express server...');

  // Load .env from resources (packaged) or project root (dev) explicitly
  const envFilePath = app.isPackaged && process.resourcesPath
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '.env');

  let dotenvVars = {};
  try {
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const value = trimmed.substring(eqIdx + 1).trim();
            dotenvVars[key] = value;
          }
        }
      });
      log(LogLevel.INFO, `Loaded .env from: ${envFilePath}`);
    } else {
      log(LogLevel.WARN, `.env not found at: ${envFilePath}`);
    }
  } catch (e) {
    log(LogLevel.WARN, 'Could not read .env file:', e.message);
  }

  // Always inject env vars into process.env
  Object.assign(process.env, dotenvVars);
  process.env.NODE_ENV = isProduction ? 'production' : 'development';
  process.env.PORT = String(SERVER_PORT);
  process.env.SERVER_PORT = String(SERVER_PORT);
  if (app.isPackaged && process.resourcesPath) {
    process.env.DB_BASE_PATH = path.join(process.resourcesPath, 'database');
  }

  if (app.isPackaged) {
    // PRODUCTION: Run server IN-PROCESS inside Electron's Node.js runtime.
    log(LogLevel.INFO, 'Using in-process server (packaged mode)');

    const serverModulePath = path.join(process.resourcesPath, 'app-server', 'index.js');
    log(LogLevel.INFO, `Server module path: ${serverModulePath}`);
    log(LogLevel.INFO, `resourcesPath: ${process.resourcesPath}`);

    // Debug log file for production server errors
    const debugLogPath = path.join(app.getPath('userData'), 'server-debug.log');
    function writeDebugLog(msg) {
      try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(debugLogPath, `[${timestamp}] ${msg}\n`);
      } catch (_) {}
    }
    writeDebugLog(`=== Server startup attempt ===`);
    writeDebugLog(`resourcesPath: ${process.resourcesPath}`);
    writeDebugLog(`serverModulePath: ${serverModulePath}`);
    writeDebugLog(`Server module exists: ${fs.existsSync(serverModulePath)}`);
    writeDebugLog(`ENV DB_HOST: ${process.env.DB_HOST}`);
    writeDebugLog(`ENV DB_NAME: ${process.env.DB_NAME}`);

    // Check if the server module actually exists
    if (!fs.existsSync(serverModulePath)) {
      const errMsg = `Server module NOT FOUND at: ${serverModulePath}`;
      writeDebugLog(`FATAL: ${errMsg}`);
      log(LogLevel.ERROR, errMsg);
      // List what IS in app-server to help debug
      const appServerDir = path.join(process.resourcesPath, 'app-server');
      if (fs.existsSync(appServerDir)) {
        const files = fs.readdirSync(appServerDir);
        writeDebugLog(`app-server contents: ${files.join(', ')}`);
        log(LogLevel.ERROR, `app-server dir contents: ${files.join(', ')}`);
      } else {
        writeDebugLog(`app-server dir does NOT exist!`);
        log(LogLevel.ERROR, 'app-server directory does not exist!');
      }
      throw new Error(errMsg);
    }

    // Capture console output from the in-process server
    const _origConsoleLog = console.log;
    const _origConsoleError = console.error;
    const _origConsoleWarn = console.warn;
    console.log = (...args) => { _origConsoleLog(...args); writeDebugLog('[SERVER LOG] ' + args.join(' ')); };
    console.error = (...args) => { _origConsoleError(...args); writeDebugLog('[SERVER ERR] ' + args.join(' ')); };
    console.warn = (...args) => { _origConsoleWarn(...args); writeDebugLog('[SERVER WARN] ' + args.join(' ')); };

    // Temporarily patch process.exit so server startup failures don't kill Electron
    let serverExitError = null;
    const _originalExit = process.exit.bind(process);
    process.exit = (code) => {
      if (code !== 0) {
        const exitMsg = `Server called process.exit(${code}) — captured for debugging`;
        writeDebugLog(`FATAL EXIT: ${exitMsg}`);
        log(LogLevel.ERROR, exitMsg);
        serverExitError = new Error(`Server exited with code ${code}`);
      } else {
        _originalExit(code);
      }
    };

    // Free port before loading server module (prevents EADDRINUSE)
    await new Promise((resolvePort) => {
      const { exec } = require('child_process');
      const net = require('net');

      function getPids(cb) {
        exec(`netstat -ano | findstr :${SERVER_PORT}`, (err, stdout) => {
          if (err || !stdout) { cb(new Set()); return; }
          const pids = new Set();
          stdout.split('\n').forEach(line => {
            if (line.toUpperCase().includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              const pid = parseInt(parts[parts.length - 1]);
              if (!isNaN(pid) && pid !== process.pid) pids.add(pid);
            }
          });
          cb(pids);
        });
      }

      function isPortFree(cb) {
        const tester = net.createServer();
        tester.once('error', () => cb(false));
        tester.once('listening', () => { tester.close(); cb(true); });
        tester.listen(SERVER_PORT, '127.0.0.1');
      }

      function killAndWait(attempt) {
        if (attempt > 10) { log(LogLevel.WARN, `Port ${SERVER_PORT} still busy after retries — proceeding anyway`); resolvePort(); return; }
        getPids((pids) => {
          const killAll = (cb) => {
            if (pids.size === 0) { cb(); return; }
            let n = pids.size;
            pids.forEach(pid => exec(`taskkill /PID ${pid} /F`, () => { if (--n === 0) cb(); }));
          };
          killAll(() => {
            setTimeout(() => {
              isPortFree((free) => {
                if (free) { resolvePort(); }
                else { killAndWait(attempt + 1); }
              });
            }, 500);
          });
        });
      }

      killAndWait(1);
    });
    log(LogLevel.INFO, `Port ${SERVER_PORT} cleared`);
    writeDebugLog(`Port ${SERVER_PORT} cleared, loading server module...`);

    try {
      require(serverModulePath);
      log(LogLevel.INFO, 'Server module loaded in-process successfully');
      writeDebugLog('Server module require() completed (async startup continuing...)');
    } catch (e) {
      process.exit = _originalExit;
      console.log = _origConsoleLog;
      console.error = _origConsoleError;
      console.warn = _origConsoleWarn;
      writeDebugLog(`FATAL: require() threw: ${e.message}\n${e.stack}`);
      log(LogLevel.ERROR, 'Failed to load server module in-process:', e.message);
      throw e;
    }

    // Restore real process.exit after server has had time to initialize
    setTimeout(() => {
      process.exit = _originalExit;
      console.log = _origConsoleLog;
      console.error = _origConsoleError;
      console.warn = _origConsoleWarn;
    }, 20000);

    // Poll localhost until the server is actually responding
    await new Promise((resolveReady, rejectReady) => {
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const ready = await checkExpressServer();
          if (ready) {
            clearInterval(pollInterval);
            writeDebugLog(`Server ready after ${attempts * 500}ms`);
            log(LogLevel.INFO, `In-process server ready after ${attempts * 500}ms`);
            resolveReady();
            return;
          }
        } catch (_e) { /* keep polling */ }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          const timeoutMsg = `Server did NOT respond on port ${SERVER_PORT} after 30s. Check server-debug.log at: ${debugLogPath}`;
          writeDebugLog(`TIMEOUT: ${timeoutMsg}`);
          log(LogLevel.ERROR, timeoutMsg);
          // Show dialog with the debug log path so user can report it
          dialog.showMessageBox({
            type: 'error',
            title: 'Server Startup Failed',
            message: 'The application server failed to start.',
            detail: `The server did not respond after 30 seconds.\n\nDebug log saved at:\n${debugLogPath}\n\nCommon causes:\n• Cannot connect to MySQL (${process.env.DB_HOST}:${process.env.DB_PORT})\n• Missing server files\n• Port conflict on ${SERVER_PORT}`,
            buttons: ['OK']
          }).catch(() => {});
          resolveReady(); // Don't reject — still show the app
        }
      }, 500);
    });

  } else {
    // DEVELOPMENT: spawn a separate node process
    await new Promise((resolve, reject) => {
      // DEVELOPMENT: spawn a separate node process (existing behavior)
      const serverPath = path.join(__dirname, 'server.js');
      log(LogLevel.INFO, `Spawning dev server: ${serverPath}`);

      const serverEnv = { ...process.env };
      const serverCwd = __dirname;

      serverProcess = spawn('node', [serverPath], {
        stdio: 'pipe',
        env: serverEnv,
        cwd: serverCwd
      });

      let serverReady = false;
      let startTimeout;

      serverProcess.stdout.on('data', (data) => {
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
    }); // end dev Promise
  } // end else (dev mode)
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
  // GPU crashes confirmed on this system - must use software rendering
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

      // Determine if this is a UNC/network path (\\server\share\...)
      const isUNCPath = normalizedPath.startsWith('\\\\') || filePath.startsWith('\\\\');

      if (isUNCPath) {
        // For UNC/network paths, skip fs.existsSync (unreliable on network drives)
        // and go straight to shell.openPath — Windows will handle the error if missing
        log(LogLevel.DEBUG, `Opening UNC/network file directly: ${normalizedPath}`);
        const result = await shell.openPath(normalizedPath);
        if (result) {
          log(LogLevel.ERROR, 'Error opening UNC file:', result);
          return { success: false, error: result };
        }
        log(LogLevel.INFO, 'UNC file opened successfully');
        return { success: true, method: 'system-default-unc' };
      }

      // For local paths: check existence first
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

  ipcMain.handle('folder:openInExplorer', async (event, folderPath) => {
    try {
      if (!folderPath || typeof folderPath !== 'string') {
        return { success: false, error: 'Invalid folder path' };
      }

      const normalizedPath = path.normalize(folderPath);

      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: 'Folder not found' };
      }

      // If it's a file path, get the parent directory
      const stats = fs.statSync(normalizedPath);
      const targetPath = stats.isDirectory() ? normalizedPath : path.dirname(normalizedPath);

      log(LogLevel.DEBUG, `Opening folder in Explorer: ${targetPath}`);
      // showItemInFolder highlights the item inside explorer
      shell.showItemInFolder(targetPath);
      return { success: true };
    } catch (error) {
      log(LogLevel.ERROR, 'Error opening folder:', error.message);
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
// Handle opening external links
ipcMain.handle('app:open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';
const SERVER_PORT = process.env.EXPRESS_PORT || 3001;
const VITE_URL = 'http://localhost:5173';
const EXPRESS_CHECK_INTERVAL = 500;
const MAX_EXPRESS_WAIT = 30000; // 30 seconds
const MAX_VITE_WAIT = 60000; // 60 seconds for Vite startup

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // icon: path.join(__dirname, 'assets/kmti_logo.png'),
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready
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
      disableBlinkFeatures: 'AutoplayPolicy' // Prevent autoplay issues
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Electron window opened!');
  });

  if (isDev) {
    console.log(`🔗 Loading React app from ${VITE_URL}`);
    
    // Better error handling for load failures
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`❌ Failed to load: ${errorCode} - ${errorDescription}`);
      // Retry after a delay
      setTimeout(() => {
        console.log('🔄 Retrying connection to Vite...');
        mainWindow.loadURL(VITE_URL);
      }, 2000);
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Page loaded successfully');
      // Open DevTools AFTER page loads
      setTimeout(() => {
        mainWindow.webContents.openDevTools();
      }, 500);
    });
    
    mainWindow.webContents.on('crashed', () => {
      console.error('❌ Renderer process crashed!');
      mainWindow.reload();
    });
    
    // Enable remote debugging for troubleshooting
    mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
      console.log(`🖼️  [Renderer]: ${message}`);
    });
    
    mainWindow.loadURL(VITE_URL);
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, 'client/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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
 * Wait for Vite server to be ready
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
        resolve(); // Continue to show error in Electron
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

app.whenReady().then(async () => {
  console.log('⚡ Electron app is ready!');
  
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

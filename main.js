const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';

if (process.env.SILENCE_ELECTRON_CONSOLE === 'true') {
  ['log', 'info', 'warn', 'error', 'debug'].forEach(fn => {
    console[fn] = () => {}
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // icon: path.join(__dirname, 'assets/kmti_logo.png'), // Uncomment if you have the logo
    backgroundColor: '#1a1a1a', // Prevents white flash on load
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      backgroundThrottling: false, // Keep animations smooth
      spellcheck: false, // Disable spellcheck for better performance
    },
    show: false, // Don't show until ready
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('🖥️  Electron window opened!');
  });

  if (isDev) {
    console.log('🔗 Loading React app from http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    if (process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Production: load from built files
    mainWindow.loadFile(path.join(__dirname, 'client/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Express server...');
    
    // Start the Express server
    serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });

    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // Check if server is ready
      if (output.includes('Express server running') && !serverReady) {
        serverReady = true;
        console.log('✅ Express server is ready!');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        console.log('⚠️  Server timeout, creating window anyway...');
        resolve();
      }
    }, 10000);
  });
}

function waitForViteServer() {
  return new Promise((resolve) => {
    if (!isDev) {
      resolve();
      return;
    }
    
    console.log('⏳ Waiting for Vite dev server...');
    const checkServer = () => {
      const req = http.get('http://localhost:5173', (res) => {
        console.log('✅ Vite dev server is ready!');
        resolve();
      });
      
      req.on('error', () => {
        setTimeout(checkServer, 1000);
      });
    };
    
    checkServer();
  });
}

app.whenReady().then(async () => {
  console.log('⚡ Electron app is ready!');
  
  try {
    // Start the Express server and wait for it to be ready
    await startServer();
    
    // In development, wait for Vite server to be ready
    await waitForViteServer();
    
    // Now create the window
    createWindow();
  } catch (error) {
    console.error('❌ Failed to start application:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill the server process when the app is closing
  if (serverProcess) {
    console.log('🛑 Stopping Express server...');
    serverProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill the server process when the app is quitting
  if (serverProcess) {
    console.log('🛑 Stopping Express server...');
    serverProcess.kill();
  }
});

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  return { canceled: false, filePaths: result.filePaths };
});

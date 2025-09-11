const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('🖥️  Electron window opened!');
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    console.log('🔗 Loading React app from http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
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

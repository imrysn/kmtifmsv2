/**
 * ⚡ OPTIMIZED Electron-Vite Startup Script
 * Parallel startup for maximum speed - NO MORE WHITE SCREEN
 * All services start simultaneously for fastest possible loading
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const net = require('net');

const VITE_PORT = 5173;
const EXPRESS_PORT = 3001;
const MAX_VITE_WAIT = 60000; // 60 seconds - enough time for Vite to start

let viteProcess = null;
let electronProcess = null;
let startupTime = Date.now();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset, prefix = '→') {
  const time = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${time}]${colors.reset} ${prefix} ${color}${message}${colors.reset}`);
}

/**
 * Check if a port is already in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Check if server is responding
 */
function checkServer(port, timeout = 2000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, { timeout }, (res) => {
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
 * Wait for server with smart polling
 */
async function waitForServer(port, name, maxWait = 20000) {
  const startTime = Date.now();
  log(`Waiting for ${name} on port ${port}...`, colors.cyan, '⏳');
  
  let attempt = 0;
  while (Date.now() - startTime < maxWait) {
    attempt++;
    
    if (await checkServer(port)) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log(`${name} is ready! (${elapsed}s)`, colors.green, '✅');
      return true;
    }
    
    if (attempt % 8 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log(`Still waiting... ${elapsed}s elapsed`, colors.yellow, '⏳');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log(`${name} startup timeout (${maxWait / 1000}s) - Electron will retry`, colors.yellow, '⚠️');
  return false;
}

/**
 * Start Vite dev server
 */
function startVite() {
  return new Promise((resolve) => {
    log('Starting Vite dev server...', colors.magenta, '🚀');
    
    const isWindows = process.platform === 'win32';
    viteProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'client'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    viteProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('Local:') || output.includes('ready in')) {
        const lines = output.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          if (line.includes('Local:') || line.includes('ready')) {
            log(line.trim(), colors.cyan, '🔗');
          }
        });
      }
    });
    
    viteProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('esbuild') && !error.includes('DeprecationWarning')) {
        // Only show actual errors
        if (error.includes('Error') || error.includes('EADDRINUSE')) {
          log(`Vite: ${error.trim()}`, colors.yellow, '⚠️');
        }
      }
    });
    
    viteProcess.on('error', (error) => {
      log(`Failed to start Vite: ${error.message}`, colors.red, '❌');
    });
    
    // Resolve immediately - don't wait for Vite to be ready
    setTimeout(resolve, 500);
  });
}

/**
 * Start Electron
 */
function startElectron() {
  return new Promise((resolve) => {
    log('Starting Electron app...', colors.magenta, '🖥️');
    
    const isWindows = process.platform === 'win32';
    electronProcess = spawn(
      isWindows ? 'npm.cmd' : 'npm',
      ['run', 'electron:dev'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, NODE_ENV: 'development' }
      }
    );
    
    electronProcess.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // Only show important messages
        if (line.includes('✅') || line.includes('❌') || line.includes('🖥️') || 
            line.includes('Electron') || line.includes('ready')) {
          console.log(line);
        }
      });
    });
    
    electronProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      // Filter out noise
      if (error && 
          !error.includes('ExperimentalWarning') &&
          !error.includes('DeprecationWarning') &&
          !error.includes('Debugger listening')) {
        log(error, colors.yellow, '⚠️');
      }
    });
    
    electronProcess.on('exit', (code) => {
      const elapsed = Math.floor((Date.now() - startupTime) / 1000);
      log(`Electron exited with code ${code} after ${elapsed}s`, colors.yellow, '👋');
      cleanup();
    });
    
    resolve();
  });
}

/**
 * Cleanup all processes
 */
function cleanup() {
  log('Shutting down...', colors.yellow, '🛑');
  
  if (viteProcess && !viteProcess.killed) {
    log('Stopping Vite...', colors.yellow, '  •');
    if (process.platform === 'win32') {
      try { require('child_process').execSync(`taskkill /pid ${viteProcess.pid} /T /F`, { stdio: 'ignore' }); } catch (e) {}
    } else {
      viteProcess.kill('SIGTERM');
      setTimeout(() => viteProcess.killed || viteProcess.kill('SIGKILL'), 1000);
    }
  }
  
  if (electronProcess && !electronProcess.killed) {
    log('Stopping Electron...', colors.yellow, '  •');
    if (process.platform === 'win32') {
      try { require('child_process').execSync(`taskkill /pid ${electronProcess.pid} /T /F`, { stdio: 'ignore' }); } catch (e) {}
    } else {
      electronProcess.kill('SIGTERM');
      setTimeout(() => electronProcess.killed || electronProcess.kill('SIGKILL'), 1000);
    }
  }
  
  log('Done!', colors.green, '✅');
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

/**
 * OPTIMIZED: Start everything in parallel
 */
async function main() {
  try {
    log('═'.repeat(70), colors.bright, '');
    log('KMTI File Management System - OPTIMIZED STARTUP', colors.bright, '█');
    log('No more white screen! Parallel startup enabled.', colors.green, '█');
    log('═'.repeat(70), colors.bright, '');

    // Step 1: Check port availability
    log('Step 1/3: Checking port availability...', colors.cyan, '📋');
    const viteInUse = await isPortInUse(VITE_PORT);
    const expressInUse = await isPortInUse(EXPRESS_PORT);

    if (viteInUse) {
      log(`⚠️  Port ${VITE_PORT} is in use. Vite may fail to start.`, colors.yellow, '');
    }
    if (expressInUse) {
      log(`⚠️  Port ${EXPRESS_PORT} is in use. Express may use alternate port.`, colors.yellow, '');
    }

    // Step 2: Start Vite and Electron IN PARALLEL (fastest approach)
    log('Step 2/3: Starting Vite and Electron in parallel...', colors.cyan, '⚡');
    
    // Start both simultaneously
    const vitePromise = startVite();
    await vitePromise; // Wait just 500ms for Vite to spawn
    
    // Start Electron immediately after Vite spawns
    // Electron will show splash screen while waiting for Vite
    const electronPromise = startElectron();
    
    // Wait for Electron to spawn (very quick)
    await electronPromise;

    // Step 3: Optional - wait for Vite in background
    // This doesn't block Electron from starting
    log('Step 3/3: Monitoring Vite startup...', colors.cyan, '👀');
    waitForServer(VITE_PORT, 'Vite', MAX_VITE_WAIT).then(ready => {
      if (ready) {
        log('Vite is fully ready!', colors.green, '✨');
      } else {
        log('Vite took longer than expected, but Electron is handling it.', colors.yellow, '⚠️');
      }
    });

    log('═'.repeat(70), colors.bright, '');
    log('Startup sequence completed! Application is launching...', colors.green, '✅');
    log('═'.repeat(70), colors.bright, '');

  } catch (error) {
    log(`Startup failed: ${error.message}`, colors.red, '❌');
    cleanup();
  }
}

// Start the application
main();

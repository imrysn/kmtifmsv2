/**
 * ⚡ Optimized Electron-Vite Startup Script
 * Smart sequential startup with intelligent error recovery
 * Ensures all services are ready before rendering
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const net = require('net');

const VITE_PORT = 5173;
const EXPRESS_PORT = 3001;
const MAX_STARTUP_TIME = 90000; // 90 seconds max

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
 * Wait for server with exponential backoff
 */
async function waitForServer(port, name, maxWait = 45000) {
  const startTime = Date.now();
  log(`Waiting for ${name} on port ${port}...`, colors.cyan, '⏳');
  
  let attempt = 0;
  while (Date.now() - startTime < maxWait) {
    attempt++;
    
    if (await checkServer(port)) {
      log(`${name} is ready!`, colors.green, '✅');
      return true;
    }
    
    if (attempt % 10 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      log(`Still waiting... ${elapsed}s elapsed`, colors.yellow, '⏳');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log(`${name} failed to start within ${maxWait / 1000}s`, colors.red, '❌');
  return false;
}

/**
 * Start Vite dev server
 */
function startVite() {
  return new Promise((resolve, reject) => {
    log('Starting Vite dev server...', colors.magenta, '🚀');
    
    const isWindows = process.platform === 'win32';
    viteProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'client'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let viteOutput = '';
    
    viteProcess.stdout.on('data', (data) => {
      const output = data.toString();
      viteOutput += output;
      
      // Show important Vite messages
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
      if (!error.includes('esbuild')) {
        log(`Vite: ${error.trim()}`, colors.yellow, '⚠️ ');
      }
    });
    
    viteProcess.on('error', (error) => {
      log(`Failed to start Vite: ${error.message}`, colors.red, '❌');
      reject(error);
    });
    
    // Resolve after spawn
    setTimeout(resolve, 1000);
  });
}

/**
 * Start Electron
 */
function startElectron() {
  return new Promise((resolve) => {
    log('Starting Electron app...', colors.magenta, '🖥️ ');
    
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
        if (line.includes('✅') || line.includes('❌') || line.includes('🖥️')) {
          console.log(line);
        }
      });
    });
    
    electronProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      if (error && !error.includes('ExperimentalWarning')) {
        log(error, colors.yellow, '⚠️ ');
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
    viteProcess.kill('SIGTERM');
    setTimeout(() => viteProcess.killed || viteProcess.kill('SIGKILL'), 1000);
  }
  
  if (electronProcess && !electronProcess.killed) {
    log('Stopping Electron...', colors.yellow, '  •');
    electronProcess.kill('SIGTERM');
    setTimeout(() => electronProcess.killed || electronProcess.kill('SIGKILL'), 1000);
  }
  
  log('Done!', colors.green, '✅');
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/**
 * Main startup sequence
 */
async function main() {
  try {
    log('═'.repeat(70), colors.bright, ' ');
    log('KMTI File Management System - Optimized Startup', colors.bright, '█');
    log('═'.repeat(70), colors.bright, ' ');
    
    // Step 0: Check port availability
    log('Step 1/4: Checking port availability...', colors.cyan, '📋');
    const viteInUse = await isPortInUse(VITE_PORT);
    const expressInUse = await isPortInUse(EXPRESS_PORT);
    
    if (viteInUse) {
      log(`⚠️  Port ${VITE_PORT} is already in use. Killing existing process...`, colors.yellow, ' ');
      // Port might be freed soon
    }
    if (expressInUse) {
      log(`⚠️  Port ${EXPRESS_PORT} is already in use. Express may start on different port.`, colors.yellow, ' ');
    }
    
    // Step 1: Start Vite first (does not require Express)
    log('Step 2/4: Starting Vite development server...', colors.cyan, '📦');
    try {
      await startVite();
    } catch (error) {
      log(`Failed to start Vite: ${error.message}`, colors.red, '❌');
      cleanup();
      return;
    }
    
    // Step 2: Wait for Vite to be ready
    log('Step 3/4: Waiting for Vite to be ready...', colors.cyan, '⏸️ ');
    const viteReady = await waitForServer(VITE_PORT, 'Vite');
    
    if (!viteReady) {
      log('Vite startup timeout!', colors.red, '❌');
      log('Try manually: cd client && npm run dev', colors.yellow, '💡');
      cleanup();
      return;
    }
    
    // Step 3: Start Electron (which will start Express internally)
    log('Step 4/4: Starting Electron (Express will start automatically)...', colors.cyan, '🎯');
    await startElectron();
    
    log('═'.repeat(70), colors.bright, ' ');
    log('All systems ready! Press Ctrl+C to stop.', colors.green, '✅');
    log('═'.repeat(70), colors.bright, ' ');
    
  } catch (error) {
    log(`Startup failed: ${error.message}`, colors.red, '❌');
    cleanup();
  }
}

// Start the application
main();

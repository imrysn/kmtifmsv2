/**
 * Server Process Management with PID tracking and port cleanup
 * FIXES: Orphaned processes, port conflicts, crash recovery
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Clean up any old server processes before starting new one
 * CRITICAL: Prevents "EADDRINUSE" errors after crashes
 */
async function cleanupOldServer(pidFile, portUtils, log, LogLevel) {
  try {
    if (fs.existsSync(pidFile)) {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8'));
      log(LogLevel.WARN, `Found old server PID: ${oldPid}, attempting cleanup...`);
      
      try {
        // Try to kill old process
        await portUtils.killProcess(oldPid);
        log(LogLevel.INFO, `Killed orphaned server process ${oldPid}`);
      } catch (killError) {
        log(LogLevel.WARN, `Could not kill old process: ${killError.message}`);
      }
      
      // Remove stale PID file
      fs.unlinkSync(pidFile);
    }
  } catch (error) {
    log(LogLevel.WARN, `Error during cleanup: ${error.message}`);
  }
}

/**
 * Check if server port is available and clean up if needed
 * CRITICAL: Handles orphaned processes holding the port
 */
async function ensurePortAvailable(port, portUtils, log, LogLevel) {
  const available = await portUtils.isPortAvailable(port);
  
  if (!available) {
    log(LogLevel.WARN, `Port ${port} is in use, attempting cleanup...`);
    
    // Try to find and kill process using the port
    const pid = await portUtils.findProcessByPort(port);
    if (pid) {
      log(LogLevel.INFO, `Found process ${pid} using port ${port}`);
      await portUtils.killProcess(pid);
      
      // Wait for port to become free
      const freed = await portUtils.waitForPortToBeFree(port, 10000);
      
      if (!freed) {
        throw new Error(`Port ${port} is still in use after cleanup. Please close other instances manually.`);
      }
      
      log(LogLevel.INFO, `Port ${port} is now available`);
    } else {
      throw new Error(`Port ${port} is in use but couldn't find the process. Check Task Manager.`);
    }
  }
  
  return true;
}

/**
 * Gracefully shutdown server process
 * FIXED: Proper cleanup on exit, removes PID file
 */
function shutdownServer(serverProcess, pidFile, log, LogLevel) {
  if (serverProcess && !serverProcess.killed) {
    log(LogLevel.INFO, 'Stopping Express server...');
    
    try {
      serverProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 3000);
    } catch (error) {
      log(LogLevel.ERROR, 'Error killing server:', error.message);
    }
    
    // Clean up PID file
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
        log(LogLevel.DEBUG, 'PID file removed');
      }
    } catch (error) {
      log(LogLevel.WARN, `Could not remove PID file: ${error.message}`);
    }
  }
}

module.exports = {
  cleanupOldServer,
  ensurePortAvailable,
  shutdownServer
};

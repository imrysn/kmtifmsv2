const net = require('net');
const fs = require('fs');
const path = require('path');

/**
 * Check if a port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

/**
 * Wait for a port to become available
 * @param {number} port - Port to wait for
 * @param {number} maxWait - Maximum time to wait in ms
 * @returns {Promise<boolean>} - True if port became available
 */
async function waitForPortToBeFree(port, maxWait = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (await isPortAvailable(port)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

/**
 * Kill process by PID
 * @param {number} pid - Process ID to kill
 * @returns {Promise<boolean>} - True if killed successfully
 */
function killProcess(pid) {
  return new Promise((resolve) => {
    try {
      process.kill(pid, 'SIGTERM');

      // Give it 2 seconds to die gracefully
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL'); // Force kill
        } catch (e) {
          // Already dead, that's fine
        }
        resolve(true);
      }, 2000);

    } catch (error) {
      if (error.code === 'ESRCH') {
        // Process doesn't exist
        resolve(true);
      } else {
        console.error('Failed to kill process:', error);
        resolve(false);
      }
    }
  });
}

/**
 * Find process using a specific port (Windows only)
 * @param {number} port - Port number
 * @returns {Promise<number|null>} - PID or null if not found
 */
function findProcessByPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }

    const { exec } = require('child_process');
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1]);
          if (!isNaN(pid)) {
            resolve(pid);
            return;
          }
        }
      }
      resolve(null);
    });
  });
}

module.exports = {
  isPortAvailable,
  waitForPortToBeFree,
  killProcess,
  findProcessByPort
};

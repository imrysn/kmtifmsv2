const express = require('express');
const path = require('path');
const fs = require('fs');
const { dbPath, networkDataPath, closeDatabase } = require('./config/database');
const { setupMiddleware } = require('./config/middleware');
const { initializeDatabase, verifyUploadsDirectory } = require('./db/initialize');
const runMigrations = require('./migrations/runMigrations');
const { errorHandler, notFoundHandler, handleUnhandledRejection, handleUncaughtException } = require('./middleware/errorHandler');
const { logRequest, logInfo, logError } = require('./utils/logger');
const { apiLimiter, authLimiter, uploadLimiter } = require('./config/rateLimiter');

// Hide console window on Windows when running as executable - MUST BE FIRST
if (process.platform === 'win32' && process.pkg) {
  // Execute immediately to hide console before any output
  try {
    const { execSync } = require('child_process');
    // Use PowerShell to hide the current console window
    // eslint-disable-next-line no-useless-escape
    execSync('powershell -command "(Get-Process -Id $PID).MainWindowHandle | ForEach-Object { $hwnd = $_; Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }\'; [Win32]::ShowWindow($hwnd, 0) }" 2>nul', { stdio: 'ignore' });
  } catch (_e) {
    // If PowerShell method fails, try direct API calls
    try {
      const ffi = require('ffi-napi');
      const _ref = require('ref-napi');

      const user32 = ffi.Library('user32', {
        'ShowWindow': ['bool', ['pointer', 'int32']],
        'GetConsoleWindow': ['pointer', []]
      });

      const kernel32 = ffi.Library('kernel32', {
        'FreeConsole': ['bool', []]
      });

      // Try to free console first
      kernel32.FreeConsole();

      // Then hide any remaining console window
      const SW_HIDE = 0;
      const consoleWindow = user32.GetConsoleWindow();
      if (consoleWindow && !consoleWindow.isNull()) {
        user32.ShowWindow(consoleWindow, SW_HIDE);
      }
    } catch (_e2) {
      // Continue silently
    }
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');
const activityLogsRoutes = require('./routes/activityLogs');
const fileSystemRoutes = require('./routes/fileSystem');
const filesRoutes = require('./routes/files');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const fileViewerRoutes = require('./routes/fileViewer');
const { router: notificationsRoutes } = require('./routes/notifications');
const assignmentsRoutes = require('./routes/assignments');
const customTagsRoutes = require('./routes/customTags');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Setup middleware
setupMiddleware(app);

// Add request logging
app.use(logRequest);

// Apply general API rate limiting to all /api routes
app.use('/api/', apiLimiter);

// Watcher status debug endpoint
app.get('/api/watcher-status', (req, res) => {
  try {
    const { getWatcherStatus } = require('./services/fileWatcher');
    res.json(getWatcherStatus());
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Health check endpoint — always responds (even before DB is ready)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: _dbReady ? 'healthy' : 'starting',
    dbReady: _dbReady,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Version endpoint - returns app version from package.json
app.get('/api/version', (req, res) => {
  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    res.status(200).json({
      success: true,
      version: packageJson.version,
      name: packageJson.name,
      description: packageJson.description
    });
  } catch (error) {
    logError(error, { context: 'version-endpoint' });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve version information'
    });
  }
});

// Register routes
// Auth routes with strict rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/team-members', usersRoutes); // Alias for team members endpoint
app.use('/api/teams', teamsRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/file-system', fileSystemRoutes);
// File routes with upload rate limiting
app.use('/api/files', uploadLimiter, filesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/file-viewer', fileViewerRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/custom-tags', customTagsRoutes);

// Serve static files from the React app build directory
// In bundled mode, client files are in client-dist, otherwise in ../client/dist
const clientBuildPath = path.join(__dirname, 'client-dist');
const fallbackClientPath = path.join(__dirname, '../client/dist');

// Check which path exists (bundled vs development)
const actualClientPath = fs.existsSync(clientBuildPath) ? clientBuildPath : fallbackClientPath;

if (fs.existsSync(actualClientPath)) {
  logInfo('Serving frontend', { path: actualClientPath });
  app.use(express.static(actualClientPath));

  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(actualClientPath, 'index.html'));
  });
} else {
  console.warn('⚠️  Frontend build not found. Server will only serve API endpoints.');
}

// 404 handler for API routes
app.use('/api/*', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Setup global error handlers
handleUnhandledRejection();
handleUncaughtException();

// Cleanup leftover temp files from previous sessions (prevents ghost Electron multipart replays)
function cleanupTempFiles() {
  try {
    const { uploadsDir } = require('./config/middleware');
    if (!fs.existsSync(uploadsDir)) return;
    const files = fs.readdirSync(uploadsDir);
    let cleaned = 0;
    const ONE_HOUR = 60 * 60 * 1000;
    for (const file of files) {
      if (!file.startsWith('temp_')) continue;
      const filePath = require('path').join(uploadsDir, file);
      try {
        const stat = fs.statSync(filePath);
        // Only delete temp files older than 1 hour (not currently-uploading files)
        if (Date.now() - stat.mtimeMs > ONE_HOUR) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (_e) { /* ignore */ }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} leftover temp file(s) from uploads directory`);
    }
  } catch (e) {
    console.warn('⚠️ Could not clean temp files:', e.message);
  }
}

// Kill any process already using our port (Windows-safe, with retry)
async function freePort(port) {
  if (process.platform !== 'win32') return;

  const { exec } = require('child_process');

  // Helper: get all PIDs listening on the port
  function getPidsOnPort() {
    return new Promise((resolve) => {
      exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (err || !stdout) { resolve(new Set()); return; }
        const pids = new Set();
        stdout.split('\n').forEach(line => {
          // Only kill LISTENING processes, not TIME_WAIT / CLOSE_WAIT
          if (line.toUpperCase().includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1]);
            if (!isNaN(pid) && pid !== process.pid) pids.add(pid);
          }
        });
        resolve(pids);
      });
    });
  }

  // Helper: wait N ms
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Helper: check if port is free by trying to bind it
  function isPortFree() {
    return new Promise((resolve) => {
      const net = require('net');
      const tester = net.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => { tester.close(); resolve(true); });
      tester.listen(port, '127.0.0.1');
    });
  }

  // Kill all PIDs currently occupying the port
  const pids = await getPidsOnPort();
  if (pids.size > 0) {
    console.log(`⚠️  Port ${port} in use by PID(s): ${[...pids].join(', ')} — killing...`);
    await Promise.all([...pids].map(pid =>
      new Promise(resolve => exec(`taskkill /PID ${pid} /F`, () => resolve()))
    ));
  }

  // Wait up to 5 seconds for the port to actually become free
  for (let i = 0; i < 10; i++) {
    await wait(500);
    if (await isPortFree()) {
      console.log(`✅ Port ${port} is now free.`);
      return;
    }
    // Retry kill in case the process didn't die fast enough
    const remaining = await getPidsOnPort();
    if (remaining.size > 0) {
      await Promise.all([...remaining].map(pid =>
        new Promise(resolve => exec(`taskkill /PID ${pid} /F`, () => resolve()))
      ));
    }
  }

  console.warn(`⚠️  Port ${port} may still be in use — attempting to start anyway.`);
}

// ── DB initialisation with background retry ────────────────────────────────
let _dbReady = false;

async function initDbWithRetry(attempt = 1) {
  try {
    // Try uploads dir (non-fatal if NAS unreachable)
    await verifyUploadsDirectory().catch(err =>
      console.warn('⚠️  Uploads directory not ready:', err.message)
    );

    const ok = await initializeDatabase();
    if (ok === false) {
      throw new Error('initializeDatabase returned false — MySQL unreachable');
    }

    cleanupTempFiles();
    await runMigrations();

    _dbReady = true;
    console.log('\n' + '='.repeat(70));
    console.log(`✅ Database connected: ${dbPath}`);
    console.log(`🌐 Network Data Path: ${networkDataPath}`);
    console.log('='.repeat(70) + '\n');

    // ── Start file system watcher ─────────────────────────────────────────
    // Watch uploads dir + NAS approved dirs for deletions
    try {
      const { startWatcher } = require('./services/fileWatcher');
      const { uploadsDir } = require('./config/middleware');
      const watchPaths = [
        uploadsDir,                                          // pending uploads
        require('path').join(networkDataPath, 'user_approvals'), // approved files
        require('path').join(networkDataPath, 'PROJECTS'),       // moved-to-projects files
      ].filter(Boolean);
      startWatcher(watchPaths);
    } catch (watchErr) {
      console.warn('⚠️  File watcher could not start:', watchErr.message);
    }
  } catch (error) {
    const delay = Math.min(30000, attempt * 5000); // 5s, 10s, 15s … max 30s
    console.error(`❌ DB init attempt ${attempt} failed: ${error.message}`);
    console.warn(`🔄 Retrying database connection in ${delay / 1000}s…`);
    setTimeout(() => initDbWithRetry(attempt + 1), delay);
  }
}

// Start server — Express binds FIRST so the client never gets
// "Unable to connect to server". DB connects in the background.
async function startServer() {
  try {
    // 1. Free the port first
    await freePort(PORT);

    // 2. Bind Express immediately (retry up to 10 times)
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const MAX_ATTEMPTS = 10;
      const RETRY_DELAY = 1000;

      function tryListen() {
        attempts++;
        const server = app.listen(PORT);
        server.once('listening', () => {
          console.log('\n' + '='.repeat(70));
          console.log(`🚀 Express server running on http://localhost:${PORT}`);
          console.log(`🗄️  Database Type: MySQL (connecting in background…)`);
          console.log('='.repeat(70) + '\n');
          resolve(server);
        });
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE' && attempts < MAX_ATTEMPTS) {
            console.warn(`⚠️  Port ${PORT} busy (attempt ${attempts}/${MAX_ATTEMPTS}), retrying in ${RETRY_DELAY}ms…`);
            server.close();
            setTimeout(tryListen, RETRY_DELAY);
          } else {
            reject(err);
          }
        });
      }
      tryListen();
    });

    // 3. Start DB init in background — does NOT block server startup
    initDbWithRetry();

  } catch (error) {
    console.error('\n❌ Failed to bind Express server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`);

  try {
    // Stop file watcher
    try {
      const { stopWatcher } = require('./services/fileWatcher');
      await stopWatcher();
    } catch (_) {}
    // Close database connection
    await closeDatabase();
    console.log('✅ Database connection closed');

    // Exit successfully
    console.log('👋 Server stopped\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle various shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// Note: uncaughtException and unhandledRejection are handled by
// handleUnhandledRejection() / handleUncaughtException() called above.

module.exports = app;

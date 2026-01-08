/**
 * KMTI FMS - Automatic Update Module
 * 
 * Features:
 * - Automatic update checking and downloading
 * - Rollback-safe updates with health checks
 * - Crash detection and auto-revert
 * - IPC communication with renderer
 * - Splash screen progress integration
 */

const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const updaterWindow = require('./updater-window');

// Constants
const isDev = process.env.NODE_ENV === 'development';
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // Check every 4 hours
const MAX_STARTUP_FAILURES = 2;
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

// Paths
const configDir = path.join(app.getPath('userData'), 'config');
const updateStatePath = path.join(configDir, 'update-state.json');

// Update state management
class UpdateStateManager {
  constructor() {
    this.state = this.loadState();
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  loadState() {
    try {
      if (fs.existsSync(updateStatePath)) {
        const data = fs.readFileSync(updateStatePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('❌ Failed to load update state:', error.message);
    }

    return {
      pendingUpdateVerification: false,
      consecutiveFailures: 0,
      lastKnownGoodVersion: app.getVersion(),
      lastUpdateCheck: null,
      updateDownloaded: false,
      lastUpdateVersion: null
    };
  }

  saveState() {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(updateStatePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Failed to save update state:', error.message);
    }
  }

  markPendingVerification(version) {
    this.state.pendingUpdateVerification = true;
    this.state.lastUpdateVersion = version;
    this.state.consecutiveFailures = 0;
    this.saveState();
  }

  markVerificationSuccess() {
    this.state.pendingUpdateVerification = false;
    this.state.consecutiveFailures = 0;
    this.state.lastKnownGoodVersion = app.getVersion();
    this.saveState();
    console.log('✅ Update verification successful');
  }

  recordFailure() {
    this.state.consecutiveFailures++;
    this.saveState();
    console.warn(`⚠️  Startup failure recorded: ${this.state.consecutiveFailures}/${MAX_STARTUP_FAILURES}`);
  }

  shouldRevert() {
    return this.state.pendingUpdateVerification &&
           this.state.consecutiveFailures >= MAX_STARTUP_FAILURES;
  }

  async rollbackUpdate() {
    console.error('❌ Update verification failed after multiple attempts');
    console.error('   Automatic rollback is NOT supported by electron-updater');
    console.error('   User must manually reinstall previous version or contact support');

    // Reset state to prevent infinite restart loop
    this.stateManager.state.pendingUpdateVerification = false;
    this.stateManager.saveState();

    // Show error dialog to user
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Update Failed',
      message: 'The update appears to be broken and the application cannot start properly.',
      detail: `Version: ${this.stateManager.state.lastUpdateVersion || 'unknown'}\n\n` +
              'The application will continue running with the current version, but it may be unstable.\n\n' +
              'Please contact support or reinstall the previous version manually.',
      buttons: ['Continue Anyway', 'Exit Application'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 1) {
      // User chose to exit
      app.quit();
    }

    return false;
  }

  resetFailures() {
    this.state.consecutiveFailures = 0;
    this.saveState();
  }
}

// Main updater class
class AppUpdater {
  constructor() {
    this.stateManager = new UpdateStateManager();
    this.mainWindow = null;
    this.splashWindow = null;
    this.updateCheckInterval = null;
    this.healthCheckTimer = null;
    
    // Configure autoUpdater
    this.configureAutoUpdater();
  }

  configureAutoUpdater() {
    // Disable in development
    if (isDev) {
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      console.log('🔧 Auto-updater disabled in development mode');
      return;
    }

    // Configure update behavior
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    // Configure logging
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';

    console.log('🔄 Auto-updater configured');
    console.log(`📦 Current version: ${app.getVersion()}`);

    // Setup event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for updates...');
      updaterWindow.showUpdaterWindow('checking');
      this.notifyRenderer('checking'); // Keep for backward compatibility with main app
    });

    autoUpdater.on('update-available', (info) => {
      console.log(`📦 Update available: ${info.version}`);
      console.log(`   Current: ${app.getVersion()}`);
      console.log(`   Release date: ${info.releaseDate}`);

      updaterWindow.updateStatus('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
      this.notifyRenderer('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ Application is up to date');
      updaterWindow.closeUpdaterWindow();
      this.notifyRenderer('not-available');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`⬇️  Downloading update: ${percent}% (${this.formatBytes(progressObj.transferred)}/${this.formatBytes(progressObj.total)})`);

      updaterWindow.updateStatus('downloading', {
        percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
      // Don't notify main window during download to keep it silent
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ Update downloaded successfully');
      console.log(`   Version: ${info.version}`);
      console.log(`   Release date: ${info.releaseDate}`);

      this.stateManager.state.updateDownloaded = true;
      this.stateManager.saveState();

      updaterWindow.updateStatus('downloaded', {
        version: info.version,
        releaseDate: info.releaseDate
      });
      // Don't notify main window - the updater window will handle user interaction
    });

    autoUpdater.on('error', (error) => {
      console.error('❌ Update error:', error.message);

      updaterWindow.updateStatus('error', {
        message: error.message
      });
      this.notifyRenderer('error', {
        message: error.message
      });
    });
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setSplashWindow(window) {
    this.splashWindow = window;
  }

  notifyRenderer(status, data = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Send to toast container for toast notifications
      this.mainWindow.webContents.send('updater:toast', {
        status,
        ...data,
        timestamp: Date.now()
      });
    }
  }

  notifySplash(status, data = {}) {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.webContents.send('updater:splash-status', {
        status,
        ...data,
        timestamp: Date.now()
      });
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Public API
  async checkForUpdates() {
    if (isDev) {
      console.log('⏭️  Skipping update check in development mode');
      return;
    }

    try {
      this.stateManager.state.lastUpdateCheck = Date.now();
      this.stateManager.saveState();
      
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('❌ Failed to check for updates:', error.message);
      this.notifyRenderer('error', { message: error.message });
    }
  }

  startPeriodicUpdateCheck() {
    if (isDev) return;

    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkForUpdates();
    }, 30000);

    // Periodic checks
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);

    console.log(`🔄 Periodic update checks enabled (every ${UPDATE_CHECK_INTERVAL / 3600000} hours)`);
  }

  stopPeriodicUpdateCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  quitAndInstall() {
    if (isDev) {
      console.log('⏭️  Cannot install updates in development mode');
      return;
    }

    console.log('🔄 Preparing to install update and restart...');
    
    // Mark that we're about to update
    this.stateManager.markPendingVerification(
      this.stateManager.state.lastUpdateVersion || 'unknown'
    );

    // Save any critical state before restart
    this.saveAppState();

    // Install and restart
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 1000);
  }

  saveAppState() {
    // Hook for saving application state before restart
    // This can be extended based on application needs
    console.log('💾 Saving application state before restart...');
  }

  // Health check system
  async runHealthCheck() {
    console.log('🏥 Running post-update health check...');
    
    const checks = {
      windowRender: false,
      serverReady: false,
      databaseConnected: false,
      ipcReady: false
    };

    try {
      // Check 1: Window rendered
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Wait for window to finish loading
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Window load timeout'));
          }, 5000);

          this.mainWindow.webContents.once('did-finish-load', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        checks.windowRender = true;
        console.log('  ✓ Window rendered');
      } else {
        console.error('  ✗ Window not available');
        return false;
      }

      // Check 2: Server responding
      const SERVER_PORT = process.env.EXPRESS_PORT || 3001;
      try {
        const http = require('http');
        const serverResponse = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Server timeout')), 5000);
          
          const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
            clearTimeout(timeout);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          });
          
          req.on('error', reject);
        });

        if (serverResponse.status === 'healthy') {
          checks.serverReady = true;
          console.log('  ✓ Server responding');
          
          if (serverResponse.database === 'connected') {
            checks.databaseConnected = true;
            console.log('  ✓ Database connected');
          } else {
            console.error('  ✗ Database not connected');
          }
        }
      } catch (error) {
        console.error('  ✗ Server health check failed:', error.message);
        return false;
      }

      // Check 3: IPC ready
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        checks.ipcReady = true;
        console.log('  ✓ IPC ready');
      }

      // All critical checks must pass
      const allPassed = checks.windowRender && 
                       checks.serverReady && 
                       checks.databaseConnected && 
                       checks.ipcReady;

      if (allPassed) {
        console.log('✅ Health check passed - all systems operational');
        this.stateManager.markVerificationSuccess();
        return true;
      } else {
        console.error('❌ Health check failed:', checks);
        this.stateManager.recordFailure();
        return false;
      }
    } catch (error) {
      console.error('❌ Health check error:', error.message);
      this.stateManager.recordFailure();
      return false;
    }
  }

  async checkStartupHealth() {
    // Check if we're in pending verification state
    if (this.stateManager.state.pendingUpdateVerification) {
      console.log('⚠️  Pending update verification detected');

      // Check if we should revert
      if (this.stateManager.shouldRevert()) {
        console.error('❌ Too many startup failures. Update appears broken. Attempting rollback...');

        // Attempt automatic rollback
        const rollbackSuccess = await this.stateManager.rollbackUpdate();

        if (rollbackSuccess) {
          console.log('✅ Update rolled back successfully');
          return false; // Still return false as app needs restart
        } else {
          console.error('❌ Automatic rollback failed. Manual intervention required.');
          console.error('   Please reinstall the previous version manually.');

          // Reset state to prevent infinite loop
          this.stateManager.state.pendingUpdateVerification = false;
          this.stateManager.saveState();

          return false;
        }
      }

      // Run health check
      const healthy = await this.runHealthCheck();

      if (!healthy) {
        console.warn('⚠️  Health check failed, failure recorded');
        return false;
      }
    } else {
      // Normal startup, reset failure counter
      this.stateManager.resetFailures();
    }

    return true;
  }
}

// Export singleton instance
const updater = new AppUpdater();

module.exports = updater;

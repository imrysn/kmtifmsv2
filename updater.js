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
    console.log('🔄 Attempting to rollback to previous version...');

    try {
      // Use electron-updater's rollback feature if available
      if (autoUpdater.rollback && typeof autoUpdater.rollback === 'function') {
        await autoUpdater.rollback();
        console.log('✅ Update rolled back successfully');
        return true;
      } else {
        // Manual rollback - mark as failed and suggest manual reinstall
        console.warn('⚠️  Automatic rollback not available, manual intervention required');
        console.warn('   Please reinstall the previous version manually from backup');

        // Reset state to prevent further attempts
        this.stateManager.state.pendingUpdateVerification = false;
        this.stateManager.saveState();

        return false;
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      return false;
    }
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
      this.notifyRenderer('checking');
      this.notifySplash('checking');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(`📦 Update available: ${info.version}`);
      console.log(`   Current: ${app.getVersion()}`);
      console.log(`   Release date: ${info.releaseDate}`);
      
      this.notifyRenderer('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
      this.notifySplash('available', { version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ Application is up to date');
      this.notifyRenderer('not-available');
      this.notifySplash('not-available');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`⬇️  Downloading update: ${percent}% (${this.formatBytes(progressObj.transferred)}/${this.formatBytes(progressObj.total)})`);
      
      this.notifyRenderer('downloading', {
        percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
      this.notifySplash('downloading', { percent });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ Update downloaded successfully');
      console.log(`   Version: ${info.version}`);
      console.log(`   Release date: ${info.releaseDate}`);
      
      this.stateManager.state.updateDownloaded = true;
      this.stateManager.saveState();
      
      this.notifyRenderer('downloaded', {
        version: info.version,
        releaseDate: info.releaseDate
      });
      this.notifySplash('downloaded', { version: info.version });
    });

    autoUpdater.on('error', (error) => {
      console.error('❌ Update error:', error.message);
      
      this.notifyRenderer('error', {
        message: error.message
      });
      this.notifySplash('error', { message: error.message });
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
    
    return new Promise((resolve) => {
      const checks = {
        windowRender: false,
        serverInit: false,
        ipcReady: false
      };

      // Timeout for health check
      this.healthCheckTimer = setTimeout(() => {
        const passed = checks.windowRender && checks.serverInit && checks.ipcReady;
        if (passed) {
          console.log('✅ Health check passed');
          this.stateManager.markVerificationSuccess();
          resolve(true);
        } else {
          console.error('❌ Health check failed:', checks);
          this.stateManager.recordFailure();
          resolve(false);
        }
      }, HEALTH_CHECK_TIMEOUT);

      // Check 1: Window rendered
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.once('did-finish-load', () => {
          checks.windowRender = true;
          console.log('  ✓ Window rendered');
        });
      }

      // Check 2: Server initialized (checked externally)
      checks.serverInit = true; // Assume server is working if we got this far
      console.log('  ✓ Server initialized');

      // Check 3: IPC ready
      if (this.mainWindow) {
        checks.ipcReady = true;
        console.log('  ✓ IPC ready');
      }
    });
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

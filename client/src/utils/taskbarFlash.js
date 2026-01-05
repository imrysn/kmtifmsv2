/**
 * Taskbar Flash Utility for Notifications
 * Provides cross-browser and Electron support for flashing the taskbar/dock icon when notifications arrive
 */

// Track if the page is currently visible
let isPageVisible = true;
let flashInterval = null;
let originalTitle = document.title;
let isElectron = false;
let electronAPI = null;

// Detect if running in Electron
try {
  if (window.electron && window.electron.flashFrame) {
    isElectron = true;
    electronAPI = window.electron;
    console.log('✅ Electron environment detected - using native window flashing');
  }
} catch (e) {
  console.log('ℹ️ Browser environment detected - using title flashing');
}

// Update visibility state
document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
  
  // Stop flashing when user returns to the page
  if (isPageVisible) {
    stopFlashing();
  }
});

// For Electron: also listen to focus events
if (isElectron) {
  window.addEventListener('focus', () => {
    isPageVisible = true;
    stopFlashing();
  });
  
  window.addEventListener('blur', () => {
    isPageVisible = false;
  });
}

// Store original title on load
window.addEventListener('load', () => {
  originalTitle = document.title;
});

/**
 * Flash the taskbar by alternating the page title (browser) or using native flash (Electron)
 * @param {string} message - The notification message to display
 * @param {number} duration - How long to flash in milliseconds (default: 10000ms = 10 seconds)
 */
export const flashTaskbar = (message = 'New Notification', duration = 10000) => {
  console.log(`🔔 flashTaskbar called: "${message}" (isElectron: ${isElectron}, isVisible: ${isPageVisible})`);
  
  // DISABLED to prevent page blinking - document.title changes were causing React re-renders
  console.log('⚠️ Taskbar flash disabled to prevent page blinking');
  return;
  
  // Only flash if the page is not visible
  if (isPageVisible) {
    console.log('⚠️ Page is visible, skipping flash');
    return;
  }

  // Stop any existing flash
  stopFlashing();

  // Use Electron native flashing if available
  if (isElectron && electronAPI && electronAPI.flashFrame) {
    console.log('⚡ Using Electron native window flashing');
    
    // Flash the window frame - true means continuous flashing
    electronAPI.flashFrame(true);
    
    // Also update title for additional visibility
    let toggle = false;
    flashInterval = setInterval(() => {
      document.title = toggle ? originalTitle : `🔔 ${message}`;
      toggle = !toggle;
    }, 1000);
    
    // Auto-stop after duration
    if (duration > 0) {
      setTimeout(() => {
        stopFlashing();
      }, duration);
    }
  } else {
    // Browser mode: Flash the title only
    console.log('🌐 Using browser title flashing');
    
    let toggle = false;
    flashInterval = setInterval(() => {
      document.title = toggle ? originalTitle : `🔔 ${message}`;
      toggle = !toggle;
    }, 1000); // Flash every second

    // Auto-stop after duration
    if (duration > 0) {
      setTimeout(() => {
        stopFlashing();
      }, duration);
    }
  }
};

/**
 * Stop flashing the taskbar and restore original title
 */
export const stopFlashing = () => {
  console.log('⏹️ Stopping taskbar flash');
  
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  
  // Stop Electron flashing if active
  if (isElectron && electronAPI && electronAPI.flashFrame) {
    electronAPI.flashFrame(false);
  }
  
  document.title = originalTitle;
};

/**
 * Update the original title (useful when navigating between pages)
 * @param {string} newTitle - The new page title
 */
export const updateOriginalTitle = (newTitle) => {
  originalTitle = newTitle;
  if (isPageVisible) {
    document.title = newTitle;
  }
};

/**
 * Flash taskbar for multiple notifications
 * @param {number} count - Number of new notifications
 */
export const flashForNotifications = (count) => {
  if (count > 0) {
    const message = count === 1 ? 'New Notification' : `${count} New Notifications`;
    flashTaskbar(message);
  }
};

/**
 * Check if the page is currently visible
 * @returns {boolean}
 */
export const isVisible = () => isPageVisible;

export default {
  flashTaskbar,
  stopFlashing,
  updateOriginalTitle,
  flashForNotifications,
  isVisible
};

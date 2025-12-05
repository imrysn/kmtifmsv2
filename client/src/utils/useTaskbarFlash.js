/**
 * Custom React Hook for Taskbar Flashing
 * Simplifies integration of taskbar flash functionality in React components
 */

import { useEffect, useRef } from 'react';
import { flashForNotifications, stopFlashing, updateOriginalTitle } from './taskbarFlash';

/**
 * Hook to automatically flash taskbar when notification count increases
 * @param {number} unreadCount - Current unread notification count
 * @param {object} options - Configuration options
 * @returns {object} - Control functions
 */
export const useTaskbarFlash = (unreadCount, options = {}) => {
  const {
    enabled = true,           // Enable/disable flashing
    duration = 10000,         // Duration to flash in ms
    pageTitle = null          // Custom page title (optional)
  } = options;

  const previousCount = useRef(unreadCount);

  useEffect(() => {
    // Update page title if provided
    if (pageTitle) {
      updateOriginalTitle(pageTitle);
    }
  }, [pageTitle]);

  useEffect(() => {
    if (!enabled) return;

    // Check if count increased (new notifications arrived)
    const newNotifications = unreadCount - previousCount.current;
    
    if (newNotifications > 0) {
      console.log(`📢 ${newNotifications} new notification(s) - Flashing taskbar`);
      flashForNotifications(newNotifications);
    }

    // Update previous count
    previousCount.current = unreadCount;
  }, [unreadCount, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlashing();
    };
  }, []);

  return {
    stopFlashing
  };
};

/**
 * Hook to flash taskbar on specific events
 * @param {object} options - Configuration options
 * @returns {function} - Manual flash trigger function
 */
export const useManualTaskbarFlash = (options = {}) => {
  const {
    duration = 10000
  } = options;

  const flash = (message = 'New Notification') => {
    console.log(`📢 Manual flash: ${message}`);
    import('./taskbarFlash').then(module => {
      module.flashTaskbar(message, duration);
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlashing();
    };
  }, []);

  return flash;
};

export default useTaskbarFlash;

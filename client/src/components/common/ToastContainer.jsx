import React, { useState, useCallback, useEffect } from 'react';
import './UpdateAlert.css';

/**
 * Individual Toast Component
 * Displays a single notification with auto-dismiss and close button
 */
const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

const Toast = ({ id, type, title, message, duration = 5000, onClose, action }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  return (
    <div className={`kmti-toast kmti-toast--${type || 'info'} ${isExiting ? 'kmti-toast--exit' : 'kmti-toast--enter'}`}>
      <span className="kmti-toast__icon">{TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <div className="kmti-toast__body">
        <div className="kmti-toast__title">{title}</div>
        <div className="kmti-toast__message">{message}</div>
        {action && (
          <button className="update-install-btn" style={{ marginTop: 8, fontSize: 12 }} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <button className="kmti-toast__close" onClick={handleClose}>✕</button>
    </div>
  );
};

/**
 * ToastContainer Component
 * Manages all toast notifications - TOAST ONLY, NO MODALS/BANNERS
 * - Handles automatic update notifications
 * - Provides toast API for general notifications
 * - Manages toast lifecycle and positioning
 */
const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showUpdateToast = useCallback((status, data) => {
    switch (status) {
      case 'available':
        addToast({
          type: 'info',
          title: 'Update Available',
          message: `Version ${data.version} is available for download.`,
          duration: 10000
        });
        break;

      case 'downloading':
        // Silent background download - no toast
        break;

      case 'downloaded':
        // Show toast with install action button - NO MODAL
        addToast({
          type: 'success',
          title: 'Update Ready',
          message: `Update ${data.version} has been downloaded and is ready to install. This application will restart to apply the update.`,
          duration: 0, // Don't auto-dismiss - let user decide
          action: {
            label: 'Install & Restart',
            onClick: () => {
              if (window.updater) {
                window.updater.restartAndInstall();
              }
            }
          }
        });
        break;

      case 'error':
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: data.message || 'Failed to check for updates.',
          duration: 8000,
          action: {
            label: 'Retry',
            onClick: () => {
              if (window.updater) {
                window.updater.checkForUpdates();
              }
            }
          }
        });
        break;

      default:
        break;
    }
  }, [addToast]);

  // Listen for updater events and show toasts
  useEffect(() => {
    if (window.updater) {
      const unsubscribe = window.updater.onStatus((data) => {
        showUpdateToast(data.status, data);
      });

      return unsubscribe;
    }
  }, [showUpdateToast]);

  // Expose methods to window for external use
  useEffect(() => {
    window.toastContainer = {
      addToast,
      showUpdateToast
    };

    return () => {
      delete window.toastContainer;
    };
  }, [addToast, showUpdateToast]);

  return (
    <div className="kmti-toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;

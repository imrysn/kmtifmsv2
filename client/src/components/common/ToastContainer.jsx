import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import './UpdateAlert.css';

/**
 * Individual Toast Component
 * Displays a single notification with auto-dismiss and close button
 */
const Toast = ({ id, type, title, message, duration = 5000, onClose, action }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose(id);
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`max-w-sm w-full animate-slide-in ${isExiting ? 'animate-slide-out' : ''}`}
      style={{
        animation: isExiting
          ? 'slideOut 0.3s ease-in forwards'
          : 'slideIn 0.3s ease-out'
      }}
    >
      <div className={`${getBgColor()} border rounded-lg shadow-lg p-4`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">
              {title}
            </div>
            <div className="text-sm text-gray-700 mt-1">
              {message}
            </div>
            {action && (
              <button
                onClick={action.onClick}
                className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium"
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
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
    <div className="fixed top-0 right-0 z-50 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto mb-2"
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 50 + index
          }}
        >
          <Toast
            {...toast}
            onClose={removeToast}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;

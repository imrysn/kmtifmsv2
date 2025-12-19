import React, { useState, useCallback } from 'react';
import Toast from './Toast';

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
        addToast({
          type: 'info',
          title: 'Downloading Update',
          message: `Downloading update: ${data.percent || 0}% complete`,
          duration: 0 // Don't auto-close while downloading
        });
        break;

      case 'downloaded':
        addToast({
          type: 'success',
          title: 'Update Ready',
          message: `Version ${data.version} has been downloaded and is ready to install.`,
          duration: 0,
          action: {
            label: 'Restart & Install',
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
  React.useEffect(() => {
    if (window.updater) {
      const unsubscribe = window.updater.onStatus((data) => {
        showUpdateToast(data.status, data);
      });

      return unsubscribe;
    }
  }, [showUpdateToast]);

  // Expose methods to window for external use
  React.useEffect(() => {
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

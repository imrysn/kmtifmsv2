import React, { useState, useCallback } from 'react';
import Toast from './Toast';
import AlertMessage from '../user/AlertMessage';
import './UpdateAlert.css';

// Custom Update Alert Component using AlertMessage
const UpdateAlert = ({ version, onInstall, onClose }) => {
  return (
    <div className="update-alert-overlay">
      <div className="update-alert-modal">
        <AlertMessage
          type="success"
          message={`Update ${version} has been downloaded and is ready to install. The application will restart to apply the update.`}
          onClose={onClose}
        />
        <div className="update-alert-buttons">
          <button
            onClick={onInstall}
            className="update-install-btn"
          >
            Install & Restart
          </button>
          <button
            onClick={onClose}
            className="update-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  const [updateAlert, setUpdateAlert] = useState(null);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleUpdateInstall = useCallback(() => {
    if (window.updater) {
      window.updater.restartAndInstall();
    }
    setUpdateAlert(null);
  }, []);

  const handleAlertClose = useCallback(() => {
    setUpdateAlert(null);
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
        // Removed downloading toast - runs in background
        break;

      case 'downloaded':
        // Show custom update alert using AlertMessage component
        setUpdateAlert({ version: data.version });
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
    <>
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

      {/* Update Alert Modal */}
      {updateAlert && (
        <UpdateAlert
          version={updateAlert.version}
          onInstall={handleUpdateInstall}
          onClose={handleAlertClose}
        />
      )}
    </>
  );
};

export default ToastContainer;

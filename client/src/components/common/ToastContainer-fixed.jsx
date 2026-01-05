import React, { useState, useCallback } from 'react';
import Toast from './Toast';
import AlertMessage from '../user/AlertMessage';
import UpdateStatusBanner from '../updater/UpdateStatusBanner-fixed';
import './UpdateAlert.css';

/**
 * FIXED: Update Alert Modal
 * 
 * Now uses proper fixed positioning that doesn't push content down
 */
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
            type="button"
          >
            Install & Restart
          </button>
          <button
            onClick={onClose}
            className="update-cancel-btn"
            type="button"
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
  const [showBanner, setShowBanner] = useState(false);

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
      case 'checking':
        // Show banner for checking status
        setShowBanner(true);
        break;

      case 'available':
        // Show banner for available update
        setShowBanner(true);
        addToast({
          type: 'info',
          title: 'Update Available',
          message: `Version ${data.version} is available for download.`,
          duration: 10000
        });
        break;

      case 'downloading':
        // Show banner during download
        setShowBanner(true);
        break;

      case 'downloaded':
        // Hide banner and show modal
        setShowBanner(false);
        setUpdateAlert({ version: data.version });
        break;

      case 'error':
        // Hide banner and show error toast
        setShowBanner(false);
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

      case 'not-available':
        // Hide banner for not available
        setShowBanner(false);
        break;

      default:
        break;
    }
  }, [addToast]);

  // Listen for updater events
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
      {/* Update Status Banner - Fixed position, won't push content */}
      {showBanner && <UpdateStatusBanner />}

      {/* Toast Notifications - Top right corner */}
      <div className="fixed top-4 right-4 z-[9998] pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto mb-2"
            style={{
              transform: `translateY(${index * 10}px)`,
              zIndex: 9998 + index
            }}
          >
            <Toast
              {...toast}
              onClose={removeToast}
            />
          </div>
        ))}
      </div>

      {/* Update Alert Modal - Overlay */}
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

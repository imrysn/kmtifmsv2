import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';

/**
 * UpdateStatusBanner Component
 * 
 * Displays update status and progress in the React renderer.
 * - Non-intrusive toast-style notification
 * - Real-time update progress
 * - Dismissible where appropriate
 * - Production-only visibility
 */
const UpdateStatusBanner = () => {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in production Electron environment
    if (!window.updater) {
      return;
    }

    // Subscribe to update events
    const unsubscribe = window.updater.onStatus((data) => {
      console.log('📦 Update status:', data);
      setUpdateStatus(data);
      setIsVisible(true);
      setIsDismissed(false);
    });

    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Auto-hide after 5 seconds for non-critical statuses
  useEffect(() => {
    if (updateStatus?.status === 'not-available' || updateStatus?.status === 'checking') {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  const handleInstallUpdate = () => {
    if (window.updater && updateStatus?.status === 'downloaded') {
      window.updater.restartAndInstall();
    }
  };

  const handleCheckForUpdates = () => {
    if (window.updater) {
      window.updater.checkForUpdates();
    }
  };

  // Don't render if no updater available (dev mode) or dismissed
  if (!window.updater || isDismissed || !isVisible) {
    return null;
  }

  // Don't show for not-available status (no need to inform user)
  if (updateStatus?.status === 'not-available') {
    return null;
  }

  const getStatusConfig = () => {
    switch (updateStatus?.status) {
      case 'checking':
        return {
          icon: <RefreshCw className="w-5 h-5 animate-spin" />,
          title: 'Checking for updates...',
          message: null,
          bgColor: 'bg-gradient-to-r from-blue-500 to-blue-600',
          dismissible: true,
          actionButton: null
        };

      case 'available':
        return {
          icon: <Download className="w-5 h-5" />,
          title: 'New Update Available!',
          message: `Version ${updateStatus.version} is ready to download`,
          bgColor: 'bg-gradient-to-r from-purple-500 to-purple-600',
          dismissible: true,
          actionButton: null
        };

      case 'downloading':
        return {
          icon: <Download className="w-5 h-5 animate-bounce" />,
          title: 'Downloading Update',
          message: `${updateStatus.percent || 0}% complete`,
          bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-600',
          dismissible: false,
          actionButton: null,
          showProgress: true,
          progress: updateStatus.percent || 0
        };

      case 'downloaded':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          title: 'Update Ready to Install',
          message: `Version ${updateStatus.version} has been downloaded`,
          bgColor: 'bg-gradient-to-r from-green-500 to-green-600',
          dismissible: true,
          actionButton: {
            label: 'Restart & Install',
            onClick: handleInstallUpdate
          }
        };

      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          title: 'Update Check Failed',
          message: updateStatus.message || 'Unable to check for updates',
          bgColor: 'bg-gradient-to-r from-red-500 to-red-600',
          dismissible: true,
          actionButton: {
            label: 'Retry',
            onClick: handleCheckForUpdates
          }
        };

      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] animate-slide-up"
      style={{
        animation: 'slideUp 0.3s ease-out',
        maxWidth: '400px',
        minWidth: '320px'
      }}
    >
      <div className={`${config.bgColor} text-white rounded-lg shadow-2xl overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm mb-1">
                {config.title}
              </div>
              {config.message && (
                <div className="text-xs opacity-90">
                  {config.message}
                </div>
              )}
              {config.showProgress && (
                <div className="mt-3 w-full bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${config.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Dismiss Button */}
            {config.dismissible && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Button */}
          {config.actionButton && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={config.actionButton.onClick}
                className="px-4 py-2 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-opacity-90 transition-all hover:scale-105 shadow-lg"
              >
                {config.actionButton.label}
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default UpdateStatusBanner;

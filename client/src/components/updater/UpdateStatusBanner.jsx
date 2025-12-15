import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';

/**
 * UpdateStatusBanner Component
 * 
 * Displays update status and progress in the React renderer.
 * - Non-intrusive banner design
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
    if (updateStatus?.status === 'not-available' || updateStatus?.status === 'error') {
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
          title: 'Checking for updates',
          message: 'Please wait...',
          bgColor: 'bg-blue-500',
          dismissible: true,
          actionButton: null
        };

      case 'available':
        return {
          icon: <Download className="w-5 h-5" />,
          title: 'Update available',
          message: `Version ${updateStatus.version} is available`,
          bgColor: 'bg-purple-500',
          dismissible: true,
          actionButton: null
        };

      case 'downloading':
        return {
          icon: <Download className="w-5 h-5 animate-bounce" />,
          title: 'Downloading update',
          message: `${updateStatus.percent || 0}% complete`,
          bgColor: 'bg-blue-500',
          dismissible: false,
          actionButton: null,
          showProgress: true,
          progress: updateStatus.percent || 0
        };

      case 'downloaded':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          title: 'Update ready',
          message: `Version ${updateStatus.version} has been downloaded`,
          bgColor: 'bg-green-500',
          dismissible: true,
          actionButton: {
            label: 'Restart & Install',
            onClick: handleInstallUpdate
          }
        };

      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          title: 'Update check failed',
          message: updateStatus.message || 'Unable to check for updates',
          bgColor: 'bg-red-500',
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
      className="fixed top-0 left-0 right-0 z-50 animate-slide-down"
      style={{ animation: 'slideDown 0.3s ease-out' }}
    >
      <div className={`${config.bgColor} text-white shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Icon and Content */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  {config.title}
                </div>
                <div className="text-xs opacity-90 truncate">
                  {config.message}
                </div>
                {config.showProgress && (
                  <div className="mt-2 w-full bg-white bg-opacity-20 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${config.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {config.actionButton && (
              <button
                onClick={config.actionButton.onClick}
                className="flex-shrink-0 px-4 py-1.5 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
              >
                {config.actionButton.label}
              </button>
            )}

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
        </div>
      </div>
    </div>
  );
};

export default UpdateStatusBanner;

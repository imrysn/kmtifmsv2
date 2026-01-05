import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';
import './UpdateStatusBanner.css';

/**
 * UpdateStatusBanner Component
 * 
 * FIXED: Now properly overlays content without pushing it down
 * 
 * Features:
 * - Non-intrusive overlay banner (position: fixed, doesn't affect layout)
 * - Real-time update progress
 * - Dismissible where appropriate
 * - Smooth animations
 * - Production-only visibility
 */
const UpdateStatusBanner = () => {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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
      setIsAnimating(true);
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
        handleDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);

  const handleDismiss = () => {
    setIsAnimating(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsDismissed(true);
      setIsVisible(false);
    }, 200);
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
      className={`update-status-banner ${isAnimating ? 'entering' : 'exiting'}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`${config.bgColor} text-white shadow-lg banner-content`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Icon and Content */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0" aria-hidden="true">
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
                      role="progressbar"
                      aria-valuenow={config.progress}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {config.actionButton && (
              <button
                onClick={config.actionButton.onClick}
                className="flex-shrink-0 px-4 py-1.5 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                type="button"
              >
                {config.actionButton.label}
              </button>
            )}

            {/* Dismiss Button */}
            {config.dismissible && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Dismiss notification"
                type="button"
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

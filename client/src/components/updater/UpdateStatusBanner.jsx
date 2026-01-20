import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * UpdateStatusBanner Component
 * 
 * Displays update notifications using toast system.
 * - Uses existing ToastContainer
 * - Non-intrusive toast notifications
 * - Real-time update progress
 * - Production-only visibility
 */
const UpdateStatusBanner = () => {
  useEffect(() => {
    // Only show in production Electron environment
    if (!window.updater) {
      return;
    }

    // Subscribe to update events
    const unsubscribe = window.updater.onStatus((data) => {
      console.log('📦 Update status:', data);
      handleUpdateStatus(data);
    });

    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleUpdateStatus = (status) => {
    // Dismiss any existing update toasts
    toast.dismiss('update-notification');

    switch (status.status) {
      case 'checking':
        toast.info(
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
            <div>
              <div className="font-semibold">Checking for updates...</div>
            </div>
          </div>,
          {
            toastId: 'update-notification',
            autoClose: 5000,
            closeButton: true
          }
        );
        break;

      case 'available':
        toast.info(
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-semibold">New Update Available!</div>
              <div className="text-sm opacity-90">Version {status.version} is ready to download</div>
            </div>
          </div>,
          {
            toastId: 'update-notification',
            autoClose: false,
            closeButton: true
          }
        );
        break;

      case 'downloading':
        toast.info(
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 animate-bounce flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold">Downloading Update</div>
              <div className="text-sm opacity-90 mb-2">{status.percent || 0}% complete</div>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${status.percent || 0}%` }}
                />
              </div>
            </div>
          </div>,
          {
            toastId: 'update-notification',
            autoClose: false,
            closeButton: false
          }
        );
        break;

      case 'downloaded':
        toast.success(
          <div>
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Update Ready to Install</div>
                <div className="text-sm opacity-90">Version {status.version} has been downloaded</div>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.updater) {
                  window.updater.restartAndInstall();
                }
              }}
              className="w-full px-4 py-2 bg-white text-gray-900 rounded-md text-sm font-semibold hover:bg-opacity-90 transition-all hover:scale-105 shadow-lg"
            >
              Restart & Install Now
            </button>
          </div>,
          {
            toastId: 'update-notification',
            autoClose: false,
            closeButton: true
          }
        );
        break;

      case 'error':
        toast.error(
          <div>
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Update Check Failed</div>
                <div className="text-sm opacity-90">{status.message || 'Unable to check for updates'}</div>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.updater) {
                  window.updater.checkForUpdates();
                }
              }}
              className="w-full px-4 py-2 bg-white text-red-900 rounded-md text-sm font-semibold hover:bg-opacity-90 transition-all"
            >
              Retry
            </button>
          </div>,
          {
            toastId: 'update-notification',
            autoClose: 10000,
            closeButton: true
          }
        );
        break;

      case 'not-available':
        // Don't show toast for no updates
        break;

      default:
        break;
    }
  };

  // This component doesn't render anything - it just manages toasts
  return null;
};

export default UpdateStatusBanner;

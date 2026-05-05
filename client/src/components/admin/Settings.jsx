import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './Settings.css'
import { AlertMessage } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Sub-components
import SystemInfo from './subcomponents/SystemInfo'

const Settings = ({ clearMessages, error, success, setError, setSuccess, user }) => {
  const { isConnected } = useNetwork()
  const [appVersion, setAppVersion] = useState('Loading...')
  const [updateStatus, setUpdateStatus] = useState({
    state: 'idle', // idle, checking, available, downloading, downloaded, error, up-to-date
    info: null
  });

  useEffect(() => {
    // Listen for updater events
    if (window.updater) {
      const unsubscribe = window.updater.onStatus((data) => {
        switch (data.status) {
          case 'checking': setUpdateStatus(prev => ({ ...prev, state: 'checking' })); break;
          case 'available': setUpdateStatus({ state: 'available', info: data }); break;
          case 'not-available': setUpdateStatus({ state: 'up-to-date', info: null }); 
            setTimeout(() => setUpdateStatus({ state: 'idle', info: null }), 3000); break;
          case 'downloading': setUpdateStatus({ state: 'downloading', info: data }); break;
          case 'downloaded': setUpdateStatus({ state: 'downloaded', info: data }); break;
          case 'error': setUpdateStatus({ state: 'error', info: data });
            setTimeout(() => setUpdateStatus({ state: 'idle', info: null }), 5000); break;
          default: break;
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleUpdateClick = () => {
    if (!window.updater) return;
    if (updateStatus.state === 'downloaded') {
      window.updater.restartAndInstall();
    } else {
      window.updater.checkForUpdates();
      setUpdateStatus(prev => ({ ...prev, state: 'checking' }));
    }
  };

  const getUpdateButtonText = () => {
    switch (updateStatus.state) {
      case 'checking': return 'Checking...';
      case 'available': return 'Downloading...';
      case 'downloading': return updateStatus.info?.percent ? `Downloading (${updateStatus.info.percent}%)` : 'Downloading...';
      case 'downloaded': return 'Restart & Install';
      case 'up-to-date': return 'Up to Date';
      case 'error': return 'Error (Retry)';
      default: return 'Check for Updates';
    }
  };

  const isUpdateActionDisabled = () => {
    if (!window.updater) return true;
    return ['checking', 'downloading', 'available', 'up-to-date'].includes(updateStatus.state);
  };

  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        if (window.updater?.getVersion) {
          const version = await window.updater.getVersion()
          setAppVersion(`v${version}`)
        } else {
          const response = await fetch(`${API_BASE_URL}/api/version`)
          const data = await response.json()
          if (data.success && data.version) setAppVersion(`v${data.version}`)
          else setAppVersion('Unknown')
        }
      } catch (error) {
        setAppVersion('Unknown')
      }
    }
    fetchAppVersion()
  }, [])

  return (
    <div className="settings-section">
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="admin-header">
        <div className="header-title">
          <h1>System Settings</h1>
          <p className="header-subtitle">Manage application configuration and updates</p>
        </div>
      </div>

      <div className="settings-grid">
        <SystemInfo
          appVersion={appVersion}
          updateStatus={updateStatus}
          handleUpdateClick={handleUpdateClick}
          isUpdateActionDisabled={isUpdateActionDisabled}
          getUpdateButtonText={getUpdateButtonText}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(Settings, { componentName: 'Settings' })

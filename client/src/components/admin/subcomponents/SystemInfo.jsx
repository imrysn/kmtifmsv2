import React from 'react'
import './SystemInfo.css'

const SystemInfo = ({
  appVersion,
  updateStatus,
  handleUpdateClick,
  isUpdateActionDisabled,
  getUpdateButtonText
}) => {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <h3>System Information</h3>
      </div>
      <div className="settings-card-body">
        <div className="system-info">
          <div className="info-row">
            <span className="info-label">Application Version:</span>
            <div className="version-info">
              <span className="info-value">{appVersion}</span>
              <div className="version-actions">
                <button
                  className={`btn btn-sm ${updateStatus.state === 'downloaded' ? 'btn-success' : 'btn-primary'}`}
                  onClick={handleUpdateClick}
                  disabled={isUpdateActionDisabled()}
                  title={updateStatus.state === 'downloaded' ? 'Click to restart and install update' : 'Check for automatic updates'}
                >
                  {getUpdateButtonText()}
                </button>
              </div>
            </div>
          </div>
          <div className="info-row">
            <span className="info-label">Database Version:</span>
            <span className="info-value">MySQL</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(SystemInfo)

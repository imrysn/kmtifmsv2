import './css/FileReviewTab.css'
import FileIcon from '../shared/FileIcon'

const FileReviewTab = ({
  analyticsData,
  selectedStatusFilter,
  handleStatusFilter,
  selectedFileIds,
  filteredFiles,
  selectAllFiles,
  handleBulkAction,
  hasActiveFilters,
  setShowFilterModal,
  sortConfig,
  setSortConfig,
  applyFilters,
  isLoading,
  toggleFileSelection,
  openReviewModal,
  formatFileSize,
  user,
  openPriorityModal,
  openMenuId,
  toggleMenu,
  handleOpenInExplorer
}) => {
  // Extract file extension helper - EXACT Admin match
  const getFileExtension = (filename, fileType) => {
    if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) {
        return parts[parts.length - 1].toLowerCase()
      }
    }
    if (fileType) {
      return fileType.replace(/^\./, '').toLowerCase()
    }
    return ''
  }

  return (
    <div className="tl-content">
      {/* Page Header with Stat Cards */}
      <div className="tl-page-header-with-stats">
        <div className="tl-page-header">
          <h1>File Approval</h1>
          <p>Review and manage team file submissions</p>
        </div>

        {/* Status Cards - EXACT Admin Match */}
        <div className="file-status-cards">
          <div className="file-status-card">
            <div className="status-icon pending-icon">TL</div>
            <div className="status-info">
              <div className="status-number">{analyticsData?.pendingTeamLeaderReview || 0}</div>
              <div className="status-label">Pending Team Leader</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon pending-admin-icon">AD</div>
            <div className="status-info">
              <div className="status-number">{analyticsData?.pendingAdminReview || 0}</div>
              <div className="status-label">Pending Admin</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon approved-icon">AP</div>
            <div className="status-info">
              <div className="status-number">{analyticsData?.approvedFiles || 0}</div>
              <div className="status-label">Approved Files</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon rejected-icon">RE</div>
            <div className="status-info">
              <div className="status-number">{analyticsData?.rejectedFiles || 0}</div>
              <div className="status-label">Rejected Files</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="tl-toolbar">
        {/* Bulk Actions */}
        <div className="tl-toolbar-section">
          <button className="tl-btn secondary" onClick={selectAllFiles}>
            {selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          {selectedFileIds.length > 0 && (
            <>
              <button className="tl-btn success" onClick={() => handleBulkAction('approve')}>
                Bulk Approve ({selectedFileIds.length})
              </button>
              <button className="tl-btn danger" onClick={() => handleBulkAction('reject')}>
                Bulk Reject ({selectedFileIds.length})
              </button>
            </>
          )}
        </div>
        
        {/* Filter & Sort */}
        <div className="tl-toolbar-section">
          <button className="tl-btn secondary" onClick={() => setShowFilterModal(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 5.83333H17.5M5.83333 10H14.1667M8.33333 14.1667H11.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Filters
            {hasActiveFilters() && <span className="tl-badge active" style={{marginLeft: '8px'}}>Active</span>}
          </button>
          <select 
            className="tl-form-select"
            value={sortConfig.field} 
            onChange={(e) => {
              setSortConfig({...sortConfig, field: e.target.value})
              applyFilters()
            }}
          >
            <option value="uploaded_at">Sort by Date</option>
            <option value="original_name">Sort by Name</option>
            <option value="file_size">Sort by Size</option>
            <option value="priority">Sort by Priority</option>
            <option value="due_date">Sort by Due Date</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="tl-loading">
          <div className="tl-spinner"></div>
          <p>Loading files...</p>
        </div>
      ) : filteredFiles.length > 0 ? (
        <div className="tl-files-list">
          <table className="tl-files-table">
            <thead>
              <tr>
                <th style={{width: '40px'}}>
                  <input 
                    type="checkbox" 
                    checked={selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0} 
                    onChange={selectAllFiles} 
                  />
                </th>
                <th>Filename</th>
                <th>Date & Time</th>
                <th>Submitted By</th>
                <th>Team</th>
                <th>Priority</th>
                <th>Status</th>
                <th style={{width: '80px', textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const fileExtension = getFileExtension(file.original_name, file.file_type)
                
                return (
                <tr key={file.id} className="tl-clickable-row" onClick={() => openReviewModal(file, null)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedFileIds.includes(file.id)} 
                      onChange={() => toggleFileSelection(file.id)}
                    />
                  </td>
                  <td>
                    <div className="file-cell">
                      <div className="file-icon">
                        <FileIcon
                          fileType={fileExtension}
                          isFolder={false}
                          altText={`Icon for ${file.original_name}`}
                          size="medium"
                        />
                      </div>
                      <div className="file-details">
                        <span className="file-name">{file.original_name}</span>
                        <span className="file-size">{formatFileSize(file.file_size)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="datetime-cell">
                      <div className="date">{new Date(file.created_at || file.upload_date).toLocaleDateString()}</div>
                      <div className="time">{new Date(file.created_at || file.upload_date).toLocaleTimeString()}</div>
                    </div>
                  </td>
                  <td>{file.username}</td>
                  <td>
                    <span className="team-badge">
                      {file.team || user.team}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap'}}>
                      {file.priority && file.priority !== 'normal' && (
                        <span className="tl-badge" style={{
                          background: file.priority === 'urgent' ? 'var(--status-rejected)' : 'var(--status-pending)',
                          color: file.priority === 'urgent' ? 'var(--status-rejected-text)' : 'var(--status-pending-text)',
                          fontSize: '11px',
                          padding: '4px 8px'
                        }}>
                          {file.priority.toUpperCase()}
                        </span>
                      )}
                      {file.due_date && (
                        <span className="tl-badge" style={{
                          background: new Date(file.due_date) < new Date() ? 'var(--status-rejected)' : '#E0E7FF',
                          color: new Date(file.due_date) < new Date() ? 'var(--status-rejected-text)' : 'var(--primary-color)',
                          fontSize: '11px',
                          padding: '4px 8px'
                        }}>
                          {new Date(file.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <button 
                        className="tl-btn-mini secondary" 
                        onClick={() => openPriorityModal(file.id)}
                        title="Set priority/deadline"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 5.33333V8L10 10M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${
                      file.status === 'approved' || file.status === 'final_approved' ? 'approved' : 
                      file.status === 'rejected' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'rejected' : 
                      'pending'
                    }`}>
                      {
                        file.status === 'approved' || file.status === 'final_approved' ? 'Approved' : 
                        file.status === 'rejected' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' ? 'Rejected' : 
                        file.current_stage?.includes('pending_team_leader') || file.status === 'uploaded' ? 'Pending Team Leader' : 
                        file.current_stage?.includes('pending_admin') || file.status === 'team_leader_approved' ? 'Pending Admin' : 
                        file.status?.toUpperCase() || 'PENDING'
                      }
                    </span>
                  </td>
                  <td style={{textAlign: 'center'}}>
                    <div className="tl-actions-menu-wrapper">
                      <button 
                        className="tl-menu-button" 
                        onClick={(e) => toggleMenu(file.id, e)}
                        title="Options"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="3" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="13" cy="8" r="1.5" fill="currentColor"/>
                        </svg>
                      </button>
                      {openMenuId === file.id && (
                        <div className="tl-dropdown-menu">
                          <button 
                            className="tl-dropdown-item"
                            onClick={(e) => handleOpenInExplorer(file.file_path, e)}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M14 5.33333H8.66667L7.33333 4H2C1.63181 4 1.33333 4.29848 1.33333 4.66667V11.3333C1.33333 11.7015 1.63181 12 2 12H14C14.3682 12 14.6667 11.7015 14.6667 11.3333V6C14.6667 5.63181 14.3682 5.33333 14 5.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Open in File Explorer
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tl-empty">
          <h3>No files to review</h3>
          <p>Your team has no pending file submissions.</p>
        </div>
      )}
    </div>
  )
}

export default FileReviewTab

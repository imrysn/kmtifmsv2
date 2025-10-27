import fileReviewIcon from '../../assets/Icon-6.svg'

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
  return (
    <div className="tl-content" style={{position: 'relative'}}>
      <div className="tl-page-header">
        <div className="tl-page-icon">
          <img src={fileReviewIcon} alt="" width="20" height="20" />
        </div>
        <h1>File Review</h1>
      </div>

      {/* Analytics Cards */}
      <div className="tl-stats file-review-analytics">
        <div className={`tl-stat-card blue clickable ${selectedStatusFilter === 'total' ? 'active' : ''}`} onClick={() => handleStatusFilter('total')}>
          <p className="tl-stat-label">All Files</p>
          <div className="tl-stat-bottom">
            <h2 className="tl-stat-value">{(analyticsData?.approvedFiles || 0) + (analyticsData?.rejectedFiles || 0) + (analyticsData?.pendingTeamLeaderReview || 0) + (analyticsData?.pendingAdminReview || 0)}</h2>
            <div className="tl-stat-icon-box blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>

        <div className={`tl-stat-card green clickable ${selectedStatusFilter === 'approved' ? 'active' : ''}`} onClick={() => handleStatusFilter('approved')}>
          <p className="tl-stat-label">Approved</p>
          <div className="tl-stat-bottom">
            <h2 className="tl-stat-value">{analyticsData?.approvedFiles || 0}</h2>
            <div className="tl-stat-icon-box green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12L11 14L15 10M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>

        <div className={`tl-stat-card yellow clickable ${selectedStatusFilter === 'pending' ? 'active' : ''}`} onClick={() => handleStatusFilter('pending')}>
          <p className="tl-stat-label">Pending</p>
          <div className="tl-stat-bottom">
            <h2 className="tl-stat-value">{(analyticsData?.pendingTeamLeaderReview || 0) + (analyticsData?.pendingAdminReview || 0)}</h2>
            <div className="tl-stat-icon-box yellow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>

        <div className={`tl-stat-card red clickable ${selectedStatusFilter === 'rejected' ? 'active' : ''}`} onClick={() => handleStatusFilter('rejected')}>
          <p className="tl-stat-label">Rejected</p>
          <div className="tl-stat-bottom">
            <h2 className="tl-stat-value">{analyticsData?.rejectedFiles || 0}</h2>
            <div className="tl-stat-icon-box red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            className="tl-sort-select"
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
                <th><input type="checkbox" checked={selectedFileIds.length === filteredFiles.length && filteredFiles.length > 0} onChange={selectAllFiles} /></th>
                <th>FILE NAME</th>
                <th>DATE & TIME</th>
                <th>TYPE</th>
                <th>SUBMITTED BY</th>
                <th>TEAM</th>
                <th>SIZE</th>
                <th>PRIORITY / DEADLINE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr key={file.id} className="tl-clickable-row" onClick={() => openReviewModal(file, null)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedFileIds.includes(file.id)} 
                      onChange={() => toggleFileSelection(file.id)}
                    />
                  </td>
                  <td>
                    <div className="tl-file-name-cell">
                      <strong>{file.original_name}</strong>
                      <span className="tl-file-type-text">{file.file_type}</span>
                    </div>
                  </td>
                  <td>
                    <div className="tl-date-time-cell">
                      <div>{new Date(file.created_at || file.upload_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/')}</div>
                      <div className="tl-time-text">{new Date(file.created_at || file.upload_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                    </div>
                  </td>
                  <td>
                    <div className="tl-file-type-badge">
                      {file.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                    </div>
                  </td>
                  <td>{file.username}</td>
                  <td>
                    <div className="tl-team-badge">
                      {file.team || user.team}
                    </div>
                  </td>
                  <td>{formatFileSize(file.file_size)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="tl-priority-cell">
                      {file.priority && file.priority !== 'normal' && (
                        <span className={`tl-priority-badge ${file.priority}`}>
                          {file.priority.toUpperCase()}
                        </span>
                      )}
                      {file.due_date && (
                        <span className={`tl-due-date ${new Date(file.due_date) < new Date() ? 'overdue' : ''}`}>
                          {new Date(file.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <button 
                        className="tl-btn-mini secondary" 
                        onClick={() => openPriorityModal(file.id)}
                        title="Set priority/deadline"
                        style={{marginLeft: '4px'}}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 5.33333V8L10 10M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`tl-status-badge ${file.status === 'approved' ? 'approved' : file.status === 'rejected' ? 'rejected' : 'pending'}`}>
                      {file.status === 'approved' ? 'APPROVED' : file.status === 'rejected' ? 'REJECTED' : file.current_stage?.includes('pending_team_leader') ? 'PENDING TEAM LEADER' : file.current_stage?.includes('pending_admin') ? 'PENDING ADMIN' : file.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td>
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tl-empty">
          <div className="tl-empty-icon">✅</div>
          <h3>No files to review</h3>
          <p>Your team has no pending file submissions.</p>
        </div>
      )}
    </div>
  )
}

export default FileReviewTab

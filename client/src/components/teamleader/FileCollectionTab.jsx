import './css/FileCollectionTab.css'
import FileIcon from '../admin/FileIcon'

const FileCollectionTab = ({
  submittedFiles,
  isLoading,
  openFileViewModal,
  formatFileSize,
  user,
  openMenuId,
  toggleMenu,
  handleOpenInExplorer
}) => {
  // Extract file extension helper
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

  // Calculate statistics from submitted files
  const calculateStats = () => {
    const total = submittedFiles.length
    const approved = submittedFiles.filter(f => 
      f.status === 'approved' || f.status === 'final_approved'
    ).length
    const rejected = submittedFiles.filter(f => 
      f.status === 'rejected' || 
      f.status === 'rejected_by_team_leader' || 
      f.status === 'rejected_by_admin'
    ).length
    const pending = total - approved - rejected

    return { total, approved, rejected, pending }
  }

  const stats = calculateStats()

  return (
    <div className="tl-content">
      {/* Page Header */}
      <div className="tl-page-header-with-stats">
        <div className="tl-page-header">
          <h1>File Collection</h1>
          <p>View all submitted files from assignments in one place</p>
        </div>

        {/* Status Cards */}
        <div className="file-status-cards">
          <div className="file-status-card">
            <div className="status-icon total-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="status-info">
              <div className="status-number">{stats.total}</div>
              <div className="status-label">Total Submissions</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon pending-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="status-info">
              <div className="status-number">{stats.pending}</div>
              <div className="status-label">Pending Review</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon approved-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="status-info">
              <div className="status-number">{stats.approved}</div>
              <div className="status-label">Approved</div>
            </div>
          </div>

          <div className="file-status-card">
            <div className="status-icon rejected-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="status-info">
              <div className="status-number">{stats.rejected}</div>
              <div className="status-label">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="tl-toolbar">
        <div className="tl-toolbar-section">
          <div className="collection-info">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 6.66667H17.5M2.5 10H17.5M2.5 13.3333H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{submittedFiles.length} {submittedFiles.length === 1 ? 'submission' : 'submissions'} in collection</span>
          </div>
        </div>
      </div>

      {/* Files Table */}
      {isLoading ? (
        <div className="tl-loading">
          <div className="tl-spinner"></div>
          <p>Loading submissions...</p>
        </div>
      ) : submittedFiles.length > 0 ? (
        <div className="tl-files-list">
          <table className="tl-files-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Assignment</th>
                <th>Submitted By</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th style={{width: '80px', textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submittedFiles.map((submission) => {
                const fileExtension = getFileExtension(submission.original_name, submission.file_type)
                
                return (
                <tr key={submission.id} className="tl-clickable-row" onClick={() => openFileViewModal(submission)}>
                  <td>
                    <div className="file-cell">
                      <div className="file-icon">
                        <FileIcon
                          fileType={fileExtension}
                          isFolder={false}
                          altText={`Icon for ${submission.original_name}`}
                          size="medium"
                        />
                      </div>
                      <div className="file-details">
                        <span className="file-name">{submission.original_name}</span>
                        <span className="file-size">{formatFileSize(submission.file_size)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="assignment-cell">
                      <span className="assignment-title">{submission.assignment_title}</span>
                      {submission.assignment_due_date && (
                        <span className="assignment-due-date">
                          Due: {new Date(submission.assignment_due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="user-cell">
                      <span className="user-name">{submission.fullName || submission.username}</span>
                    </div>
                  </td>
                  <td>
                    <div className="datetime-cell">
                      <div className="date">{new Date(submission.submitted_at || submission.uploaded_at).toLocaleDateString()}</div>
                      <div className="time">{new Date(submission.submitted_at || submission.uploaded_at).toLocaleTimeString()}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${
                      submission.status === 'approved' || submission.status === 'final_approved' ? 'approved' : 
                      submission.status === 'rejected' || submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'rejected' : 
                      'pending'
                    }`}>
                      {
                        submission.status === 'approved' || submission.status === 'final_approved' ? 'Approved' : 
                        submission.status === 'rejected' || submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'Rejected' : 
                        submission.status === 'team_leader_approved' ? 'Pending Admin' : 
                        'Pending Review'
                      }
                    </span>
                  </td>
                  <td style={{textAlign: 'center'}}>
                    <div className="tl-actions-menu-wrapper">
                      <button 
                        className="tl-menu-button" 
                        onClick={(e) => toggleMenu(submission.id, e)}
                        title="Options"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="3" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="13" cy="8" r="1.5" fill="currentColor"/>
                        </svg>
                      </button>
                      {openMenuId === submission.id && (
                        <div className="tl-dropdown-menu">
                          <button 
                            className="tl-dropdown-item"
                            onClick={(e) => handleOpenInExplorer(submission.file_path, e)}
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
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{marginBottom: '16px', opacity: 0.3}}>
            <path d="M24 16H13.3333C11.4924 16 10 17.4924 10 19.3333V50.6667C10 52.5076 11.4924 54 13.3333 54H50.6667C52.5076 54 54 52.5076 54 50.6667V19.3333C54 17.4924 52.5076 16 50.6667 16H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M40 10H24V22H40V10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M32 32V42M32 42L37 37M32 42L27 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3>No submissions yet</h3>
          <p>Assignment submissions from your team will appear here</p>
        </div>
      )}
    </div>
  )
}

export default FileCollectionTab

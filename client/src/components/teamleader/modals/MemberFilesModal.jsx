const MemberFilesModal = ({
  showMemberFilesModal,
  setShowMemberFilesModal,
  selectedMember,
  setSelectedMember,
  memberFiles,
  setMemberFiles,
  isLoading,
  formatFileSize
}) => {
  if (!showMemberFilesModal || !selectedMember) return null

  const handleClose = () => {
    setShowMemberFilesModal(false)
    setSelectedMember(null)
    setMemberFiles([])
  }

  return (
    <div className="tl-modal-overlay" onClick={handleClose}>
      <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Files by {selectedMember.name}</h3>
          <button onClick={handleClose}>×</button>
        </div>
        
        <div className="tl-modal-body-large">
          {isLoading ? (
            <div className="tl-loading">
              <div className="tl-spinner"></div>
              <p>Loading files...</p>
            </div>
          ) : memberFiles && memberFiles.length > 0 ? (
            <div className="tl-files-list">
              <table className="tl-member-files-table">
                <thead>
                  <tr>
                    <th>FILE NAME</th>
                    <th>DATE & TIME</th>
                    <th>TYPE</th>
                    <th>SIZE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {memberFiles.map((file) => (
                    <tr key={file.id}>
                      <td>
                        <div className="tl-file-name-cell">
                          <strong>{file.original_name}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="tl-date-time-cell">
                          <div>{new Date(file.uploaded_at || file.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
                          <div className="tl-time-text">{new Date(file.uploaded_at || file.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                        </div>
                      </td>
                      <td>
                        <div className="tl-file-type-badge">
                          {file.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() || 'FILE'}
                        </div>
                      </td>
                      <td>{formatFileSize(file.file_size)}</td>
                      <td>
                        <span className={`tl-status-badge ${file.current_stage?.includes('pending_team_leader') ? 'pending-tl' : file.current_stage?.includes('pending_admin') ? 'pending-admin' : 'pending'}`}>
                          {file.current_stage?.includes('pending_team_leader') ? 'PENDING TL' : file.current_stage?.includes('pending_admin') ? 'PENDING ADMIN' : file.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tl-empty">
              <div className="tl-empty-icon">📄</div>
              <h3>No files</h3>
              <p>This team member has not uploaded any files yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MemberFilesModal

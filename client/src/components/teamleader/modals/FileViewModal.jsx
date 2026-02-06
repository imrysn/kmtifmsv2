import './css/AssignmentDetailsModal.css'
import { API_BASE_URL } from '@/config/api'
import { getDisplayFileType } from '../../../utils/fileTypeUtils'

const FileViewModal = ({
  showModal,
  setShowModal,
  selectedFile,
  formatFileSize,
  user
}) => {
  if (!showModal || !selectedFile) return null

  const handleClose = () => {
    setShowModal(false)
  }

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
      case 'approved':
        return 'Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      case 'rejected':
        return 'Rejected'
      default:
        return 'Pending Review'
    }
  }

  const mapFileStatus = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted':
      case 'team_leader_approved':
        return 'pending'
      case 'final_approved':
      case 'approved':
        return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
      case 'rejected':
        return 'rejected'
      default:
        return 'pending'
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="file-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>File Details</h3>
          <button onClick={handleClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {/* File Details Section */}
          <div className="file-details-section">
            <h4 className="section-title">File Information</h4>
            <div className="file-details-grid">
              <div className="detail-item">
                <span className="detail-label">FILE NAME:</span>
                <span className="detail-value">{selectedFile.original_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE TYPE:</span>
                <span className="detail-value">{getDisplayFileType(selectedFile.file_type, selectedFile.original_name)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">FILE SIZE:</span>
                <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">SUBMITTED BY:</span>
                <span className="detail-value">{selectedFile.fullName || selectedFile.username}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">TEAM:</span>
                <span className="detail-value team-badge-inline">
                  {selectedFile.user_team || selectedFile.team || user.team}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">SUBMITTED DATE:</span>
                <span className="detail-value">
                  {new Date(selectedFile.submitted_at || selectedFile.uploaded_at || selectedFile.created_at).toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">STATUS:</span>
                <span className={`detail-value status-badge status-${mapFileStatus(selectedFile.status)}`}>
                  {getStatusDisplayName(selectedFile.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Assignment Details */}
          {selectedFile.assignment_title && (
            <div className="description-section">
              <h4 className="section-title">Assignment</h4>
              <div className="file-details-grid">
                <div className="detail-item">
                  <span className="detail-label">TITLE:</span>
                  <span className="detail-value">{selectedFile.assignment_title}</span>
                </div>
                {selectedFile.assignment_due_date && (
                  <div className="detail-item">
                    <span className="detail-label">DUE DATE:</span>
                    <span className="detail-value">
                      {new Date(selectedFile.assignment_due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description Section */}
          {selectedFile.description && (
            <div className="description-section">
              <h4 className="section-title">Description</h4>
              <div className="description-box">
                <p className="description-text">{selectedFile.description}</p>
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="actions-section">
            <div className="action-buttons-large">
              <button
                type="button"
                onClick={() => window.open(`${API_BASE_URL}${selectedFile.file_path}`, '_blank')}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Open File
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileViewModal

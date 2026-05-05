import './ApprovalModals.css'
import { ConfirmationModal, AlertMessage, FileDetailsModal } from '../modals'

const ApprovalModals = ({
  // File Details Modal Props
  showFileModal,
  closeFileModal,
  selectedFile,
  isOpeningFile,
  handleOpenFile,
  onApproveFile,
  onRejectFile,
  
  // Delete Modal Props
  showDeleteModal,
  setShowDeleteModal,
  deleteFile,
  fileToDelete,
  folderToDelete,
  isLoading,
  
  // Reject Modal Props
  showRejectModal,
  closeRejectModal,
  confirmReject,
  rejectComment,
  setRejectComment,
  
  // Folder Review Modal Props
  folderReviewModal,
  setFolderReviewModal,
  confirmFolderReview,
  folderReviewComment,
  setFolderReviewComment,
  
  // Messages
  error,
  success,
  deleteAlert,
  clearMessages,
  setDeleteAlert
}) => {
  return (
    <>
      {/* Notifications */}
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}
      {deleteAlert && <AlertMessage type="success" message={deleteAlert} onClose={() => setDeleteAlert(null)} />}

      {/* File Details Modal */}
      <FileDetailsModal
        isOpen={showFileModal}
        onClose={closeFileModal}
        file={selectedFile}
        onApprove={() => onApproveFile(selectedFile)}
        onReject={() => onRejectFile(selectedFile)}
        onOpenFile={() => handleOpenFile(selectedFile.file_path, selectedFile.id)}
        isOpening={isOpeningFile}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deleteFile}
        title={folderToDelete ? "Delete Folder" : "Delete File"}
        confirmText={isLoading ? "Deleting..." : "Delete"}
        confirmColor="#ef4444"
        isLoading={isLoading}
      >
        {folderToDelete ? (
          <>
            <p>Are you sure you want to delete the folder <strong>"{folderToDelete.folderName}"</strong>?</p>
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
              This will delete all <strong>{folderToDelete.folderFiles.length}</strong> files within this folder.
            </p>
          </>
        ) : (
          <p>Are you sure you want to delete <strong>"{fileToDelete?.original_name}"</strong>?</p>
        )}
      </ConfirmationModal>

      {/* Single File Reject Comment Modal */}
      <ConfirmationModal
        isOpen={showRejectModal}
        onClose={closeRejectModal}
        onConfirm={confirmReject}
        title="Reject File"
        confirmText="Confirm Rejection"
        confirmColor="#ef4444"
      >
        <p>Please provide a reason for rejecting <strong>"{selectedFile?.original_name}"</strong>:</p>
        <textarea
          className="reject-textarea"
          placeholder="Enter rejection reason..."
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          autoFocus
        />
      </ConfirmationModal>

      {/* Folder Review Modal (Approve/Reject) */}
      <ConfirmationModal
        isOpen={!!folderReviewModal}
        onClose={() => setFolderReviewModal(null)}
        onConfirm={confirmFolderReview}
        title={folderReviewModal?.action === 'approve' ? 'Approve Folder' : 'Reject Folder'}
        confirmText={folderReviewModal?.action === 'approve' ? 'Approve All' : 'Reject All'}
        confirmColor={folderReviewModal?.action === 'approve' ? '#22c55e' : '#ef4444'}
      >
        <p>
          {folderReviewModal?.action === 'approve'
            ? `Are you sure you want to approve all files in folder "${folderReviewModal?.folderName}"?`
            : `Are you sure you want to reject all files in folder "${folderReviewModal?.folderName}"?`
          }
        </p>
        <textarea
          className="reject-textarea"
          placeholder={folderReviewModal?.action === 'approve' ? 'Optional comments...' : 'Reason for rejection (Required)...'}
          value={folderReviewComment}
          onChange={(e) => setFolderReviewComment(e.target.value)}
          autoFocus
        />
      </ConfirmationModal>
    </>
  )
}

export default ApprovalModals

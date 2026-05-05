import './TaskModals.css'
import { ConfirmationModal, CommentsModal, FileOpenModal } from '../modals'

const TaskModals = ({
  // Comments Modal Props
  showCommentsModal,
  closeCommentsModal,
  selectedAssignment,
  comments,
  loadingComments,
  newComment,
  setNewComment,
  handlePostComment,
  handleCommentKeyDown,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  handlePostReply,
  handleReplyKeyDown,
  visibleReplies,
  toggleRepliesVisibility,
  
  // Delete Modal Props
  showDeleteModal,
  handleCloseDeleteModal,
  handleDeleteAssignment,
  assignmentToDelete,
  isDeleting,
  
  // File Open Modal Props
  showOpenFileConfirmation,
  setShowOpenFileConfirmation,
  fileToOpen,
  setFileToOpen,
  handleOpenFile,
  
  // Download Toast Props
  downloadToast,
  setDownloadToast,
  
  // Utilities & Context
  user,
  formatTimeAgo,
  formatDateTime
}) => {
  return (
    <>
      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={selectedAssignment}
        comments={comments}
        loading={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={handlePostComment}
        onKeyDown={handleCommentKeyDown}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        replyText={replyText}
        setReplyText={setReplyText}
        onPostReply={handlePostReply}
        onReplyKeyDown={handleReplyKeyDown}
        visibleReplies={visibleReplies}
        toggleRepliesVisibility={toggleRepliesVisibility}
        formatTimeAgo={formatTimeAgo}
        formatDateTime={formatDateTime}
        user={user}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteAssignment}
        title="Delete Assignment"
        confirmText={isDeleting ? "Deleting..." : "Delete Assignment"}
        confirmColor="#ef4444"
        isLoading={isDeleting}
      >
        <p>Are you sure you want to delete the assignment <strong>"{assignmentToDelete?.title}"</strong>?</p>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
          This will permanently delete the assignment and all associated student submissions. This action cannot be undone.
        </p>
      </ConfirmationModal>

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileConfirmation}
        onClose={() => {
          setShowOpenFileConfirmation(false)
          setFileToOpen(null)
        }}
        onConfirm={async () => {
          if (!fileToOpen) return
          try {
            await handleOpenFile(fileToOpen.file_path, fileToOpen.id)
          } finally {
            setShowOpenFileConfirmation(false)
            setFileToOpen(null)
          }
        }}
        file={fileToOpen}
      />

      {/* Download Success Toast */}
      {downloadToast.show && (
        <div className="download-toast-container">
          <div className="download-toast-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div className="download-toast-content">
            <div className="download-toast-title">Success</div>
            <div className="download-toast-message">
              {downloadToast.fileName
                ? `"${downloadToast.fileName}" downloaded successfully!`
                : 'File downloaded successfully!'}
            </div>
            <div className="download-toast-progress">
              <div className="download-toast-progress-bar" />
            </div>
          </div>
          <button
            className="download-toast-close"
            onClick={() => setDownloadToast({ show: false, fileName: '' })}
          >×</button>
        </div>
      )}
    </>
  )
}

export default TaskModals

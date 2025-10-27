const BulkActionModal = ({
  showBulkActionModal,
  setShowBulkActionModal,
  bulkAction,
  selectedFileIds,
  bulkComments,
  setBulkComments,
  isProcessing,
  submitBulkAction
}) => {
  if (!showBulkActionModal) return null

  return (
    <div className="tl-modal-overlay" onClick={() => setShowBulkActionModal(false)}>
      <div className="tl-modal" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Bulk {bulkAction === 'approve' ? 'Approve' : 'Reject'} ({selectedFileIds.length} files)</h3>
          <button onClick={() => setShowBulkActionModal(false)}>×</button>
        </div>
        <div className="tl-modal-body">
          <div className="tl-form-group">
            <label>Comments {bulkAction === 'reject' && '(Required)'}</label>
            <textarea 
              value={bulkComments} 
              onChange={(e) => setBulkComments(e.target.value)} 
              rows="4" 
              required={bulkAction === 'reject'}
              placeholder={bulkAction === 'approve' ? 'Add optional comments...' : 'Please provide a reason for rejection...'}
            />
          </div>
        </div>
        <div className="tl-modal-footer">
          <button className="tl-btn secondary" onClick={() => setShowBulkActionModal(false)}>Cancel</button>
          <button 
            className={`tl-btn ${bulkAction === 'approve' ? 'success' : 'danger'}`} 
            onClick={submitBulkAction} 
            disabled={isProcessing || (bulkAction === 'reject' && !bulkComments.trim())}
          >
            {isProcessing ? 'Processing...' : `Confirm ${bulkAction}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkActionModal

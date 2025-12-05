const PriorityModal = ({
  showPriorityModal,
  setShowPriorityModal,
  priorityValue,
  setPriorityValue,
  dueDateValue,
  setDueDateValue,
  isProcessing,
  submitPriority
}) => {
  if (!showPriorityModal) return null

  return (
    <div className="tl-modal-overlay" onClick={() => setShowPriorityModal(false)}>
      <div className="tl-modal" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Set Priority & Deadline</h3>
          <button onClick={() => setShowPriorityModal(false)}>×</button>
        </div>
        <div className="tl-modal-body">
          <div className="tl-form-group">
            <label>Priority</label>
            <select 
              value={priorityValue} 
              onChange={(e) => setPriorityValue(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="tl-form-group">
            <label>Due Date</label>
            <input 
              type="date" 
              value={dueDateValue} 
              onChange={(e) => setDueDateValue(e.target.value)}
            />
          </div>
        </div>
        <div className="tl-modal-footer">
          <button className="tl-btn secondary" onClick={() => setShowPriorityModal(false)}>Cancel</button>
          <button className="tl-btn success" onClick={submitPriority} disabled={isProcessing}>
            {isProcessing ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PriorityModal

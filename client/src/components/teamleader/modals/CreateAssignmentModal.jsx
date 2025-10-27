const CreateAssignmentModal = ({
  showCreateAssignmentModal,
  setShowCreateAssignmentModal,
  assignmentForm,
  setAssignmentForm,
  teamMembers,
  isProcessing,
  createAssignment
}) => {
  if (!showCreateAssignmentModal) return null

  const handleClose = () => {
    setShowCreateAssignmentModal(false)
    setAssignmentForm({
      title: '',
      description: '',
      dueDate: '',
      fileTypeRequired: '',
      assignedTo: 'all',
      maxFileSize: 10485760,
      assignedMembers: []
    })
  }

  return (
    <div className="tl-modal-overlay" onClick={handleClose}>
      <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header">
          <h3>Create New Assignment</h3>
          <button onClick={handleClose}>×</button>
        </div>
        <div className="tl-modal-body-large">
          <form>
            <div className="tl-form-group">
              <label>Assignment Title *</label>
              <input
                type="text"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})}
                placeholder="Enter assignment title..."
                required
              />
            </div>

            <div className="tl-form-group">
              <label>Description</label>
              <textarea
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
                placeholder="Enter assignment description..."
                rows="4"
              />
            </div>

            <div className="tl-form-row">
              <div className="tl-form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({...assignmentForm, dueDate: e.target.value})}
                />
              </div>

              <div className="tl-form-group">
                <label>File Type Required</label>
                <select
                  value={assignmentForm.fileTypeRequired}
                  onChange={(e) => setAssignmentForm({...assignmentForm, fileTypeRequired: e.target.value})}
                >
                  <option value="">Any file type</option>
                  <option value="PDF">PDF</option>
                  <option value="Word">Word Document</option>
                  <option value="Excel">Excel Spreadsheet</option>
                  <option value="PowerPoint">PowerPoint Presentation</option>
                  <option value="Image">Image Files</option>
                  <option value="Video">Video Files</option>
                  <option value="Audio">Audio Files</option>
                </select>
              </div>
            </div>

            <div className="tl-form-row">
              <div className="tl-form-group">
                <label>Max File Size (MB)</label>
                <input
                  type="number"
                  value={assignmentForm.maxFileSize / (1024*1024)}
                  onChange={(e) => setAssignmentForm({...assignmentForm, maxFileSize: e.target.value * 1024 * 1024})}
                  placeholder="10"
                  min="1"
                  max="100"
                />
              </div>

              <div className="tl-form-group">
                <label>Assign To</label>
                <select
                  value={assignmentForm.assignedTo}
                  onChange={(e) => setAssignmentForm({...assignmentForm, assignedTo: e.target.value})}
                >
                  <option value="all">All Team Members</option>
                  <option value="specific">Specific Members</option>
                </select>
              </div>
            </div>

            {assignmentForm.assignedTo === 'specific' && teamMembers.length > 0 && (
              <div className="tl-form-group">
                <label>Select Members</label>
                <div className="tl-member-selector">
                  {teamMembers.map(member => (
                    <label key={member.id} className="tl-member-checkbox">
                      <input
                        type="checkbox"
                        checked={assignmentForm.assignedMembers.includes(member.id)}
                        onChange={(e) => {
                          const updatedMembers = e.target.checked
                            ? [...assignmentForm.assignedMembers, member.id]
                            : assignmentForm.assignedMembers.filter(id => id !== member.id);
                          setAssignmentForm({...assignmentForm, assignedMembers: updatedMembers});
                        }}
                      />
                      <span className="tl-checkbox-mark"></span>
                      {member.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="tl-modal-footer">
              <button
                type="button"
                className="tl-btn secondary"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tl-btn success"
                onClick={createAssignment}
                disabled={isProcessing || !assignmentForm.title.trim()}
              >
                {isProcessing ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateAssignmentModal

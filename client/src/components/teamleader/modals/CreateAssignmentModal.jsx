import React from 'react'

const CreateAssignmentModal = ({
  showCreateAssignmentModal,
  setShowCreateAssignmentModal,
  assignmentForm,
  setAssignmentForm,
  teamMembers,
  isProcessing,
  createAssignment
}) => {
  const [showMemberDropdown, setShowMemberDropdown] = React.useState(false)
  const [showFileTypeDropdown, setShowFileTypeDropdown] = React.useState(false)
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const [fileTypeDropdownPosition, setFileTypeDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const buttonRef = React.useRef(null)
  const fileTypeButtonRef = React.useRef(null)

  const fileTypeOptions = [
    { value: '', label: 'Any file type' },
    { value: 'PDF', label: 'PDF' },
    { value: 'Word', label: 'Word Document' },
    { value: 'Excel', label: 'Excel Spreadsheet' },
    { value: 'PowerPoint', label: 'PowerPoint Presentation' },
    { value: 'Image', label: 'Image Files' },
    { value: 'Video', label: 'Video Files' },
    { value: 'Audio', label: 'Audio Files' }
  ]

  if (!showCreateAssignmentModal) return null

  const handleClose = () => {
    setShowCreateAssignmentModal(false)
    setShowMemberDropdown(false)
    setShowFileTypeDropdown(false)
    setAssignmentForm({
      title: '',
      description: '',
      dueDate: '',
      fileTypeRequired: '',
      assignedMembers: []
    })
  }

  const toggleMemberSelection = (memberId) => {
    const updatedMembers = assignmentForm.assignedMembers.includes(memberId)
      ? assignmentForm.assignedMembers.filter(id => id !== memberId)
      : [...assignmentForm.assignedMembers, memberId]
    setAssignmentForm({...assignmentForm, assignedMembers: updatedMembers})
  }

  const getSelectedMembersText = () => {
    if (assignmentForm.assignedMembers.length === 0) {
      return 'Select members...'
    }
    if (assignmentForm.assignedMembers.length === 1) {
      const member = teamMembers.find(m => m.id === assignmentForm.assignedMembers[0])
      return member ? member.name : '1 member selected'
    }
    return `${assignmentForm.assignedMembers.length} members selected`
  }

  const handleDropdownToggle = () => {
    if (!showMemberDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      })
    }
    setShowMemberDropdown(!showMemberDropdown)
  }

  const handleFileTypeDropdownToggle = () => {
    if (!showFileTypeDropdown && fileTypeButtonRef.current) {
      const rect = fileTypeButtonRef.current.getBoundingClientRect()
      setFileTypeDropdownPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      })
    }
    setShowFileTypeDropdown(!showFileTypeDropdown)
  }

  const handleFileTypeSelect = (value) => {
    setAssignmentForm({...assignmentForm, fileTypeRequired: value})
    setShowFileTypeDropdown(false)
  }

  const getFileTypeLabel = () => {
    const option = fileTypeOptions.find(opt => opt.value === assignmentForm.fileTypeRequired)
    return option ? option.label : 'Any file type'
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
                <div className="tl-member-dropdown-wrapper">
                  <button
                    ref={fileTypeButtonRef}
                    type="button"
                    className="tl-member-dropdown-button"
                    onClick={handleFileTypeDropdownToggle}
                  >
                    <span>{getFileTypeLabel()}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={showFileTypeDropdown ? 'rotated' : ''}>
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  {showFileTypeDropdown && (
                    <div 
                      className="tl-member-dropdown-menu"
                      style={{
                        top: `${fileTypeDropdownPosition.top}px`,
                        left: `${fileTypeDropdownPosition.left}px`,
                        width: `${fileTypeDropdownPosition.width}px`
                      }}
                    >
                      {fileTypeOptions.map(option => (
                        <div 
                          key={option.value} 
                          className="tl-file-type-dropdown-item"
                          onClick={() => handleFileTypeSelect(option.value)}
                        >
                          <span>{option.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="tl-form-row">
              <div className="tl-form-group">
                <label>Assign To Members *</label>
                <div className="tl-member-dropdown-wrapper">
                  <button
                    ref={buttonRef}
                    type="button"
                    className="tl-member-dropdown-button"
                    onClick={handleDropdownToggle}
                  >
                    <span>{getSelectedMembersText()}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={showMemberDropdown ? 'rotated' : ''}>
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  {showMemberDropdown && (
                    <div 
                      className="tl-member-dropdown-menu"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`
                      }}
                    >
                      {teamMembers.length > 0 ? (
                        teamMembers.map(member => (
                          <label key={member.id} className="tl-member-dropdown-item">
                            <input
                              type="checkbox"
                              checked={assignmentForm.assignedMembers.includes(member.id)}
                              onChange={() => toggleMemberSelection(member.id)}
                            />
                            <span>{member.name}</span>
                          </label>
                        ))
                      ) : (
                        <div className="tl-member-dropdown-empty">No team members available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="tl-form-group">
                {/* Empty column for alignment */}
              </div>
            </div>

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
                disabled={isProcessing || !assignmentForm.title.trim() || assignmentForm.assignedMembers.length === 0}
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
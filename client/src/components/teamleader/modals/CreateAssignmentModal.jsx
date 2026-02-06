import React from 'react'

const CreateAssignmentModal = ({
  showCreateAssignmentModal,
  setShowCreateAssignmentModal,
  assignmentForm,
  setAssignmentForm,
  teamMembers,
  isProcessing,
  createAssignment,
  currentUserId,
  isEditMode = false,
  onClose
}) => {
  const [showMemberDropdown, setShowMemberDropdown] = React.useState(false)
  const [showFileTypeDropdown, setShowFileTypeDropdown] = React.useState(false)
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const [fileTypeDropdownPosition, setFileTypeDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const [attachedFiles, setAttachedFiles] = React.useState([])
  const buttonRef = React.useRef(null)
  const fileTypeButtonRef = React.useRef(null)
  const fileInputRef = React.useRef(null)

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
    if (onClose) {
      onClose()
    } else {
      setShowCreateAssignmentModal(false)
      setAssignmentForm({
        title: '',
        description: '',
        dueDate: '',
        fileTypeRequired: '',
        assignedMembers: []
      })
    }
    setShowMemberDropdown(false)
    setShowFileTypeDropdown(false)
    setAttachedFiles([])
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setAttachedFiles(prevFiles => [...prevFiles, ...files])
    }
  }

  const handleRemoveFile = (index) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const toggleMemberSelection = (memberId) => {
    const updatedMembers = assignmentForm.assignedMembers.includes(memberId)
      ? assignmentForm.assignedMembers.filter(id => id !== memberId)
      : [...assignmentForm.assignedMembers, memberId]
    setAssignmentForm({ ...assignmentForm, assignedMembers: updatedMembers })
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
    setAssignmentForm({ ...assignmentForm, fileTypeRequired: value })
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
          <h3>{isEditMode ? 'Edit Task' : 'Create New Task'}</h3>
          <button onClick={handleClose}>×</button>
        </div>
        <div className="tl-modal-body-large">
          <form>
            <div className="tl-form-group">
              <label>Task Title *</label>
              <input
                type="text"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                placeholder="Enter task title..."
                required
              />
            </div>

            <div className="tl-form-group">
              <label>Description</label>
              <textarea
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                placeholder="Enter task description..."
                rows="4"
              />
            </div>

            <div className="tl-form-row">
              <div className="tl-form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
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
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              {teams && teams.length > 1 && (
                <div className="tl-form-group">
                  <label>Assign to Team *</label>
                  <select
                    className="tl-form-select" // Ensure you have this class or use inline styles/standard select
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: 'white',
                      height: '42px'
                    }}
                    value={assignmentForm.selectedTeam}
                    onChange={(e) => {
                      const newTeam = e.target.value;
                      // When team changes, clear assigned members as they belong to specific teams
                      setAssignmentForm({
                        ...assignmentForm,
                        selectedTeam: newTeam,
                        assignedMembers: []
                      });
                    }}
                    required
                  >
                    <option value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tl-form-group">
                <label>Assign To Members *</label>
                <div className="tl-member-dropdown-wrapper">
                  <button
                    ref={buttonRef}
                    type="button"
                    className="tl-member-dropdown-button"
                    onClick={handleDropdownToggle}
                    disabled={teams && teams.length > 1 && !assignmentForm.selectedTeam}
                  >
                    <span>{getSelectedMembersText()}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={showMemberDropdown ? 'rotated' : ''}>
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                      {teamMembers.filter(m => {
                        // If multiple teams exist, filter by selected team.
                        // If no team selected yet (and multiple exist), show none (disabled above) or all?
                        // If only 1 team exists, show all.
                        if (teams && teams.length > 1) {
                          return m.team === assignmentForm.selectedTeam;
                        }
                        return true;
                      }).length > 0 ? (
                        teamMembers
                          .filter(m => {
                            if (teams && teams.length > 1) {
                              return m.team === assignmentForm.selectedTeam;
                            }
                            return true;
                          })
                          .map(member => (
                            <label key={member.id} className="tl-member-dropdown-item">
                              <input
                                type="checkbox"
                                checked={assignmentForm.assignedMembers.includes(member.id)}
                                onChange={() => toggleMemberSelection(member.id)}
                              />
                              <span>
                                {member.name}
                                {member.id === currentUserId && (
                                  <span style={{
                                    marginLeft: '6px',
                                    fontSize: '12px',
                                    color: '#6B7280',
                                    fontWeight: '500'
                                  }}>
                                    (You)
                                  </span>
                                )}
                              </span>
                            </label>
                          ))
                      ) : (
                        <div className="tl-member-dropdown-empty">
                          {teams && teams.length > 1 && !assignmentForm.selectedTeam
                            ? "Please select a team first"
                            : "No team members available"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="tl-form-group">
              <label>Attach Files (Optional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="tl-btn secondary"
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Attach Files
                </button>

                {attachedFiles.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    {attachedFiles.map((file, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#6B7280' }}>
                            <path d="M9 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V7M9 2L14 7M9 2V7H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          style={{
                            padding: '4px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                onClick={() => createAssignment(attachedFiles)}
                disabled={isProcessing || !assignmentForm.title.trim() || assignmentForm.assignedMembers.length === 0}
              >
                {isProcessing
                  ? (isEditMode ? 'Updating...' : 'Creating...')
                  : (isEditMode ? 'Update Task' : 'Create Assignment')
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateAssignmentModal
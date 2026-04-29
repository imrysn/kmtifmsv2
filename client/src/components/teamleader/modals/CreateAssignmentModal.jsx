import React from 'react'
import { FileIcon } from '../../shared';

const CreateAssignmentModal = ({
  showCreateAssignmentModal,
  setShowCreateAssignmentModal,
  assignmentForm,
  setAssignmentForm,
  teamMembers,
  teams,
  isProcessing,
  createAssignment,
  currentUserId,
  isEditMode = false,
  onClose,
  initialAttachments = [] // array of existing attachment objects when editing
}) => {
  const [showMemberDropdown, setShowMemberDropdown] = React.useState(false)
  const [showFileTypeDropdown, setShowFileTypeDropdown] = React.useState(false)
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const [fileTypeDropdownPosition, setFileTypeDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 })
  const [attachedFiles, setAttachedFiles] = React.useState([])
  // track files that are already stored on server when editing
  const [existingAttachments, setExistingAttachments] = React.useState([])
  const [attachmentsToRemove, setAttachmentsToRemove] = React.useState([])
  const [showRemoveConfirmation, setShowRemoveConfirmation] = React.useState(false)
  const [fileToRemove, setFileToRemove] = React.useState(null)

  // populate existing attachments when modal is opened in edit mode
  React.useEffect(() => {
    if (isEditMode && Array.isArray(initialAttachments)) {
      setExistingAttachments(initialAttachments);
    }

    // entering edit mode should clear any previously added new files and removals
    if (isEditMode) {
      setAttachedFiles([]);
      setAttachmentsToRemove([]);
    }
  }, [isEditMode, initialAttachments]);

  const buttonRef = React.useRef(null)
  const fileTypeButtonRef = React.useRef(null)
  const fileInputRef = React.useRef(null)
  const folderInputRef = React.useRef(null)

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

  // if user has only one team we should auto-select it when creating a new task
  React.useEffect(() => {
    if (!isEditMode && teams && teams.length === 1 && !assignmentForm.selectedTeam) {
      setAssignmentForm(prev => ({ ...prev, selectedTeam: teams[0] }))
    }
  }, [teams, isEditMode, assignmentForm.selectedTeam, setAssignmentForm]);

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
    setExistingAttachments([])
    setAttachmentsToRemove([])
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setAttachedFiles(prevFiles => [...prevFiles, ...files])
    }
  }

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      // Tag each file with its relative path for folder structure
      const tagged = files.map(file => {
        Object.defineProperty(file, 'relativeFolderPath', {
          value: file.webkitRelativePath || file.name,
          writable: true
        })
        return file
      })
      setAttachedFiles(prevFiles => [...prevFiles, ...tagged])
    }
  }

  const handleRemoveFile = (index) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const handleRemoveExisting = (index) => {
    const file = existingAttachments[index];
    setFileToRemove({ file, index });
    setShowRemoveConfirmation(true);
  }

  const confirmRemoveExisting = () => {
    if (fileToRemove) {
      const { file, index } = fileToRemove;
      setExistingAttachments(prev => {
        const removed = prev[index];
        if (removed && removed.id) {
          setAttachmentsToRemove(ids => [...ids, removed.id]);
        }
        return prev.filter((_, i) => i !== index);
      });
    }
    setShowRemoveConfirmation(false);
    setFileToRemove(null);
  }

  const cancelRemoveExisting = () => {
    setShowRemoveConfirmation(false);
    setFileToRemove(null);
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
    <div className="tl-modal-overlay">
      <div className="tl-modal-large" onClick={e => e.stopPropagation()}>
        <div className="tl-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>{isEditMode ? 'Edit Task' : 'Create New Task'}</h3>
            {assignmentForm.selectedTeam && (!teams || teams.length <= 1) && (
              <span style={{ fontWeight: 400, fontSize: '0.85rem', color: '#6B7280' }}>
                ({assignmentForm.selectedTeam})
              </span>
            )}
          </div>
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
                <div className="tl-form-group" style={{ flex: 1 }}>
                  <label>Assign To Team *</label>
                  <select
                    value={assignmentForm.selectedTeam}
                    onChange={e => setAssignmentForm({ ...assignmentForm, selectedTeam: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #D1D5DB',
                      background: 'white'
                    }}
                  >
                    <option value="">Select team</option>
                    {teams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tl-form-group" style={{ flex: 1 }}>
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
                        if (teams && teams.length > 1) {
                          return m.team === assignmentForm.selectedTeam;
                        }
                        return true;
                      }).length > 0 ? (
                        teamMembers
                          .filter(m => {
                            if (teams && teams.length > 1) {
                              if (m.id === currentUserId) return true;
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
                            ? 'Please select a team first'
                            : 'No team members available'}
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
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  onChange={handleFolderSelect}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="tl-btn secondary"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Attach Files
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="tl-btn secondary"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L11.7071 6.70711C11.8946 6.89464 12.149 7 12.4142 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Attach Folder
                  </button>
                </div>

                {/* existing attachments from server when editing */}
                {existingAttachments.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    {existingAttachments.map((file, index) => (
                      <div key={`existing-${file.id || index}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #E5E7EB'
                      }}>
                        <FileIcon
                          fileType={(file.original_name || '').split('.').pop()}
                          size="small"
                          style={{ color: '#6B7280' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.original_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {formatFileSize(file.file_size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExisting(index)}
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
                          {/* file icon based on type */}
                          <FileIcon
                            fileType={(file.name || file.webkitRelativePath || '').split('.').pop()}
                            size="small"
                            style={{ color: '#6B7280' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.webkitRelativePath || file.name}
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
                onClick={() => createAssignment(attachedFiles, attachmentsToRemove)}
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

      {/* Remove Confirmation Modal */}
      {showRemoveConfirmation && fileToRemove && (
        <div className="tl-modal-overlay" style={{ zIndex: 1001 }}>
          <div className="tl-modal-small" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Remove File</h3>
            </div>
            <div className="tl-modal-body">
              <p style={{ margin: 0, color: '#374151' }}>
                Are you sure you want to remove <strong>{fileToRemove.file.original_name}</strong> from this task?
                This action cannot be undone.
              </p>
            </div>
            <div className="tl-modal-footer">
              <button
                type="button"
                className="tl-btn secondary"
                onClick={cancelRemoveExisting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tl-btn danger"
                onClick={confirmRemoveExisting}
              >
                Remove File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateAssignmentModal
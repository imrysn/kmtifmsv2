import { FileIcon } from '../../shared';

const recursiveGroupByPath = (files, pathKey = 'relative_path') => {
  const result = { subfolders: {}, rootFiles: [] };
  files.forEach((item, originalIdx) => {
    // 'item' might be a File, an existing attachment object, or our internal wrapper
    const file = item.file || item;
    const info = {
      _original_idx: item._original_idx !== undefined ? item._original_idx : originalIdx,
      _temp_path: item._temp_path
    };

    const getPath = (f) => f[pathKey] || f.webkitRelativePath || '';
    const currentPath = info._temp_path !== undefined ? info._temp_path : getPath(file);
    
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 1) {
      const folderName = parts[0].trim();
      if (!result.subfolders[folderName]) result.subfolders[folderName] = [];
      const remainingPath = parts.slice(1).join('/');
      result.subfolders[folderName].push({ file, _original_idx: info._original_idx, _temp_path: remainingPath });
    } else {
      result.rootFiles.push({ file, _original_idx: info._original_idx });
    }
  });
  return result;
};

const CreateAssignmentModal = ({
  showCreateAssignmentModal,
  setShowCreateAssignmentModal,
  assignmentForm,
  setAssignmentForm,
  teamMembers,
  teams,
  isProcessing,
  uploadProgress = null,
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
  const [expandedFolders, setExpandedFolders] = React.useState({})
  const [folderFileLimits, setFolderFileLimits] = React.useState({})

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
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setAttachedFiles(prev => {
      // For each incoming file, replace any existing loose file with the same name
      const replaced = new Set()
      const updated = prev.map(existing => {
        const match = files.find(f => !f.webkitRelativePath.includes('/') && f.name === existing.name && !existing.webkitRelativePath?.includes('/'))
        if (match) { replaced.add(match.name); return match }
        return existing
      })
      // Append files that didn't replace anything
      const newOnes = files.filter(f => !replaced.has(f.name) && !f.webkitRelativePath?.includes('/'))
      return [...updated, ...newOnes]
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFolderSelect = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const newFolderName = files[0]?.webkitRelativePath?.split('/')[0]
    if (!newFolderName) return

    // Tag each file with its relative path
    const tagged = files.map(file => {
      Object.defineProperty(file, 'relativeFolderPath', {
        value: file.webkitRelativePath || file.name,
        writable: true
      })
      return file
    })

    setAttachedFiles(prev => {
      // Remove all files that belong to the same folder name (replace, not merge)
      const withoutOld = prev.filter(f => {
        const existingFolder = f.webkitRelativePath?.split('/')[0]
        return existingFolder !== newFolderName
      })
      return [...withoutOld, ...tagged]
    })

    // Also auto-queue removal of the matching existing server attachment folder
    setExistingAttachments(prev => {
      const toRemove = prev.filter(f => f.folder_name === newFolderName)
      if (toRemove.length > 0) {
        setAttachmentsToRemove(ids => [
          ...ids,
          ...toRemove.map(f => f.id).filter(Boolean)
        ])
        return prev.filter(f => f.folder_name !== newFolderName)
      }
      return prev
    })

    if (folderInputRef.current) folderInputRef.current.value = ''
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
    // remove any stale __ALL__ when picking specific members
    const current = assignmentForm.assignedMembers.filter(id => id !== '__ALL__')
    const updatedMembers = current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId]
    setAssignmentForm({ ...assignmentForm, assignedMembers: updatedMembers })
  }

  const ALL_MEMBERS_VALUE = '__ALL__'

  const getSelectedMembersText = () => {
    const realMembers = assignmentForm.assignedMembers.filter(id => id !== '__ALL__')
    if (realMembers.length === 0) {
      return 'Select members...'
    }
    if (realMembers.length === 1) {
      const member = teamMembers.find(m => m.id === realMembers[0])
      return member ? member.name : '1 member selected'
    }
    return `${realMembers.length} members selected`
  }

  const toggleAllMembers = () => {
    if (assignmentForm.assignedMembers.includes(ALL_MEMBERS_VALUE)) {
      setAssignmentForm({ ...assignmentForm, assignedMembers: [] })
    } else {
      setAssignmentForm({ ...assignmentForm, assignedMembers: [ALL_MEMBERS_VALUE] })
    }
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

  const FolderTree = ({ files, level = 0, parentKey = '', onRemoveFile, onRemoveFolder, isExisting = false, pathKey = 'relative_path' }) => {
    const { subfolders, rootFiles } = recursiveGroupByPath(files, pathKey);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {Object.entries(subfolders).map(([folderName, folderFiles]) => {
          const currentKey = parentKey ? `${parentKey}__${folderName}` : folderName;
          const isExpanded = !!expandedFolders[currentKey];
          const totalSize = folderFiles.reduce((sum, f) => {
            const af = f.file || f;
            return sum + (isExisting ? (af.file_size || 0) : (af.size || 0));
          }, 0);
          
          return (
            <div key={currentKey} style={{ borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden', background: 'white' }}>
              <div 
                onClick={() => setExpandedFolders(prev => ({ ...prev, [currentKey]: !prev[currentKey] }))}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', userSelect: 'none', background: isExpanded ? '#f8faff' : '#ffffff' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <path d="M6 4L10 8L6 12" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: isExpanded ? '#dbeafe' : '#f1f5f9', borderRadius: '6px', color: isExpanded ? '#2563eb' : '#64748b' }}>
                  {isExpanded ? '📂' : '📁'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folderName}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{folderFiles.length} item{folderFiles.length !== 1 ? 's' : ''} &bull; {formatFileSize(totalSize)}</div>
                </div>
                {onRemoveFolder && level === 0 && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveFolder(folderName); }} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
              
              {isExpanded && (
                <div style={{ background: '#fafafa', padding: '2px 0 2px 24px', borderLeft: '1px solid #f1f5f9' }}>
                  <FolderTree 
                    files={folderFiles} 
                    level={level + 1} 
                    parentKey={currentKey} 
                    onRemoveFile={onRemoveFile}
                    isExisting={isExisting}
                    pathKey={pathKey}
                  />
                </div>
              )}
            </div>
          );
        })}
        
        {rootFiles.map((item, idx) => {
          const actualFile = item.file || item;
          const fileName = actualFile.original_name || actualFile.name || '';
          
          return (
            <div key={`${fileName}-${idx}`} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '8px 12px 8px 12px', 
              background: 'white', 
              borderBottom: idx === rootFiles.length - 1 && level > 0 ? 'none' : '1px solid #f1f5f9', 
              position: 'relative' 
            }}>
              <div style={{ width: '14px', flexShrink: 0 }} /> {/* Spacer to align with chevron/gap */}
              <FileIcon fileType={fileName.split('.').pop()} size="small" style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatFileSize(isExisting ? actualFile.file_size : actualFile.size)}</div>
              </div>
              {onRemoveFile && (
                <button type="button" onClick={() => onRemoveFile(isExisting ? actualFile : item._original_idx)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
          <button onClick={handleClose} disabled={isProcessing} style={{ opacity: isProcessing ? 0.5 : 1, cursor: isProcessing ? 'not-allowed' : 'pointer' }}>×</button>
        </div>
        <div className="tl-modal-body-large">
          <div onSubmit={e => e.preventDefault()}>
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
                      <path d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L11.7071 6.70711C11.8946 6.89464 12.149 7 12.4142 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Attach Folder
                  </button>
                </div>

                {existingAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Existing Server Attachments</div>
                    <FolderTree 
                      files={existingAttachments} 
                      isExisting={true} 
                      onRemoveFile={(file) => {
                        const idx = existingAttachments.indexOf(file);
                        if (idx !== -1) handleRemoveExisting(idx);
                      }}
                      onRemoveFolder={(folderName) => {
                        const filesToRemove = existingAttachments.filter(f => f.folder_name === folderName);
                        filesToRemove.forEach(f => {
                          if (f.id) setAttachmentsToRemove(ids => [...ids, f.id]);
                        });
                        setExistingAttachments(prev => prev.filter(f => f.folder_name !== folderName));
                      }}
                    />
                  </div>
                )}

                {attachedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Newly Added Files</div>
                    <FolderTree 
                      files={attachedFiles} 
                      pathKey="relativeFolderPath"
                      onRemoveFile={(fileIndex) => handleRemoveFile(fileIndex)}
                      onRemoveFolder={(folderName) => {
                        setAttachedFiles(prev => prev.filter(f => {
                          const existingFolder = f.webkitRelativePath?.split('/')[0];
                          return existingFolder !== folderName;
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="tl-modal-footer">
              {isProcessing && (
                <span style={{ fontSize: '13px', color: '#6B7280', display: 'flex', flexDirection: 'column', gap: '4px', marginRight: 'auto', minWidth: '220px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                    </svg>
                    {uploadProgress !== null && uploadProgress < 100
                      ? `Uploading files... ${uploadProgress}%`
                      : uploadProgress === 100
                      ? 'Finalizing…'
                      : (isEditMode ? 'Updating task...' : 'Creating task, please wait...')
                    }
                  </span>
                  {uploadProgress !== null && (
                    <div style={{ width: '100%', height: '4px', background: '#E5E7EB', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: uploadProgress < 100 ? `${uploadProgress}%` : '100%',
                        background: uploadProgress < 100 ? '#16A34A' : '#F59E0B',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease, background 0.3s ease'
                      }} />
                    </div>
                  )}
                  {uploadProgress === 100 && (
                    <span style={{ fontSize: '11px', color: '#92400E' }}>Moving files to server… please wait</span>
                  )}
                </span>
              )}
              <button
                type="button"
                className="tl-btn secondary"
                onClick={handleClose}
                disabled={isProcessing}
                style={{ opacity: isProcessing ? 0.5 : 1, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tl-btn success"
                onClick={() => createAssignment(attachedFiles, attachmentsToRemove)}
                disabled={isProcessing || !assignmentForm.title.trim()}
              >
                {isProcessing
                  ? (isEditMode ? 'Updating...' : 'Creating...')
                  : (isEditMode ? 'Update Task' : 'Create Task')
                }
              </button>
            </div>
          </div>
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
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import './ApprovalTable.css'
import FileIcon from '../../shared/FileIcon'

// Helper: compute folder-level status
const getFolderStatus = (folderFiles) => {
  const statuses = folderFiles.map(f => f.status)
  const allFinalApproved = statuses.every(s => s === 'final_approved')
  if (allFinalApproved) return { status: 'final_approved', label: 'Approved', cls: 'approved' }

  const allRejected = statuses.every(s => s === 'rejected_by_team_leader' || s === 'rejected_by_admin')
  if (allRejected) return { status: 'rejected', label: 'Rejected', cls: 'rejected' }

  const allPassedTL = statuses.every(s => s === 'team_leader_approved' || s === 'final_approved')
  if (allPassedTL) return { status: 'team_leader_approved', label: 'Pending Admin', cls: 'pending' }

  return { status: 'uploaded', label: 'Pending Team Leader', cls: 'pending' }
}

// Hook to compute fixed dropdown position
const useDropdownPosition = (btnRef, isOpen) => {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 145 })
    }
  }, [isOpen, btnRef])
  return pos
}

// Folder Row Component
const FolderRow = memo(({
  folderName,
  folderFiles,
  isExpanded,
  onToggle,
  onDelete,
  onApproveFolder,
  onRejectFolder,
  onOpenFolderPath
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const btnRef = useRef(null)
  const dropdownPos = useDropdownPosition(btnRef, dropdownOpen)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          btnRef.current && !btnRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const firstFile = folderFiles[0]
  const formattedDate = useMemo(() => new Date(firstFile.uploaded_at).toLocaleDateString(), [firstFile.uploaded_at])
  const formattedTime = useMemo(() => new Date(firstFile.uploaded_at).toLocaleTimeString(), [firstFile.uploaded_at])
  const folderStatus = useMemo(() => getFolderStatus(folderFiles), [folderFiles])

  const canApprove = folderStatus.status === 'team_leader_approved'
  const canReject = folderStatus.status !== 'final_approved' && folderStatus.status !== 'rejected'

  return (
    <tr 
      className="file-row folder-row" 
      onClick={() => onToggle(folderName)}
      style={{ 
        cursor: 'pointer', 
        backgroundColor: isExpanded ? '#f9fafb' : '#ffffff',
        fontWeight: '600'
      }}
    >
      <td>
        <div className="file-cell">
          <div className="file-icon">
            <FileIcon fileType="folder" isFolder={true} size="medium" />
          </div>
          <div className="file-details">
            <span className="file-name">{folderName}</span>
          </div>
        </div>
      </td>
      <td><div className="user-cell"><span className="user-name">{firstFile.username}</span></div></td>
      <td><div className="datetime-cell"><div className="date">{formattedDate}</div><div className="time">{formattedTime}</div></div></td>
      <td><span className="team-badge">{firstFile.user_team}</span></td>
      <td><span className={`status-badge status-${folderStatus.cls}`}>{folderStatus.label}</span></td>
      <td>
        <div className="action-dropdown-wrapper">
          <button
            ref={btnRef}
            className="action-dots-btn"
            onClick={(e) => { e.stopPropagation(); setDropdownOpen(prev => !prev) }}
          >⋮</button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="action-dropdown-menu" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}>
              {(canApprove || canReject) && (
                <button
                  className="dropdown-item dropdown-approve-reject"
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onApproveFolder(folderName, folderFiles) }}
                >
                  <span className="dropdown-approve-text">Approve</span>/
                  <span className="dropdown-reject-text">Reject</span>
                </button>
              )}
              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenFolderPath(folderFiles[0]) }}>📂 Open Path</button>
              <div className="dropdown-divider" />
              <button className="dropdown-item dropdown-delete" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onDelete(folderName, folderFiles) }}>Delete</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

// File Row Component
const FileRow = memo(({
  file,
  mapFileStatus,
  getStatusDisplayName,
  onOpenModal,
  onDelete,
  onOpenFilePath,
  isNested = false
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const btnRef = useRef(null)
  const dropdownPos = useDropdownPosition(btnRef, dropdownOpen)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          btnRef.current && !btnRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formattedDate = useMemo(() => new Date(file.uploaded_at).toLocaleDateString(), [file.uploaded_at])
  const formattedTime = useMemo(() => new Date(file.uploaded_at).toLocaleTimeString(), [file.uploaded_at])

  let displayName = file.original_name
  if (isNested && file.relative_path && file.folder_name) {
    displayName = file.relative_path.replace(`${file.folder_name}/`, '')
  }

  return (
    <tr 
      className="file-row" 
      onClick={() => onOpenModal(file)}
      style={isNested ? { backgroundColor: '#fafafa' } : {}}
    >
      <td>
        <div className="file-cell" style={isNested ? { paddingLeft: '40px' } : {}}>
          <div className="file-icon"><FileIcon filename={file.original_name} size="medium" /></div>
          <div className="file-details"><span className="file-name">{displayName}</span></div>
        </div>
      </td>
      <td><div className="user-cell"><span className="user-name">{file.username}</span></div></td>
      <td><div className="datetime-cell"><div className="date">{formattedDate}</div><div className="time">{formattedTime}</div></div></td>
      <td><span className="team-badge">{file.user_team}</span></td>
      <td><span className={`status-badge status-${mapFileStatus(file.status)}`}>{getStatusDisplayName(file.status)}</span></td>
      <td>
        <div className="action-dropdown-wrapper">
          <button ref={btnRef} className="action-dots-btn" onClick={(e) => { e.stopPropagation(); setDropdownOpen(prev => !prev) }}>⋮</button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="action-dropdown-menu" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}>
              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenFilePath(file) }}>📂 Open Path</button>
              <div className="dropdown-divider" />
              <button className="dropdown-item dropdown-delete" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onDelete(file) }}>Delete</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

const ApprovalTable = ({
  currentPageItems,
  expandedFolders,
  toggleFolder,
  openDeleteModal,
  openFolderDeleteModal,
  onApproveFolder,
  onRejectFolder,
  onOpenFilePath,
  onOpenModal,
  mapFileStatus,
  getStatusDisplayName
}) => {
  return (
    <div className="approval-table-wrapper">
      <table className="approval-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Submitted By</th>
            <th>Date & Time</th>
            <th>Team</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentPageItems.map((item, idx) => {
            if (item.type === 'date-header') {
              return (
                <tr key={`date-${item.label}-${idx}`} className="date-header-row">
                  <td colSpan="6">
                    <span className="date-header-label">{item.label}</span>
                  </td>
                </tr>
              )
            }
            if (item.type === 'folder') {
              const isExpanded = expandedFolders[item.folderKey]
              return (
                <React.Fragment key={item.folderKey}>
                  <FolderRow
                    folderName={item.name}
                    folderFiles={item.files}
                    isExpanded={isExpanded}
                    onToggle={() => toggleFolder(item.folderKey)}
                    onDelete={openFolderDeleteModal}
                    onApproveFolder={onApproveFolder}
                    onRejectFolder={onRejectFolder}
                    onOpenFolderPath={onOpenFilePath}
                  />
                  {isExpanded && item.files.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      isNested={true}
                      mapFileStatus={mapFileStatus}
                      getStatusDisplayName={getStatusDisplayName}
                      onOpenModal={onOpenModal}
                      onDelete={openDeleteModal}
                      onOpenFilePath={onOpenFilePath}
                    />
                  ))}
                </React.Fragment>
              )
            }
            return (
              <FileRow
                key={item.file.id}
                file={item.file}
                mapFileStatus={mapFileStatus}
                getStatusDisplayName={getStatusDisplayName}
                onOpenModal={onOpenModal}
                onDelete={openDeleteModal}
                onOpenFilePath={onOpenFilePath}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default memo(ApprovalTable)

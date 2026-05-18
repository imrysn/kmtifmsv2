import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { apiFetch } from '@/config/api'
import FileIcon from '../shared/FileIcon'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileApproval-Optimized.css'
import { ConfirmationModal, AlertMessage, FileDetailsModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { recursiveGroupByPath } from '@utils/folderUtils'

const API_BASE = '/api'

const StatusCard = memo(({ icon, label, count, className }) => (
  <div className={`file-status-card ${className}`}>
    <div className={`status-icon ${className}-icon`}>{icon}</div>
    <div className="status-info">
      <div className="status-number">{count}</div>
      <div className="status-label">{label}</div>
    </div>
  </div>
))

const FileRowSkeleton = memo(() => (
  <tr className="file-row-skeleton">
    <td><div className="skeleton skeleton-text-lg"></div></td>
    <td><div className="skeleton skeleton-text"></div></td>
    <td><div className="skeleton skeleton-text"></div></td>
    <td><div className="skeleton skeleton-badge"></div></td>
    <td><div className="skeleton skeleton-badge"></div></td>
    <td><div className="skeleton skeleton-btn"></div></td>
  </tr>
))

// Helper: compute folder-level status
const getFolderStatus = (folderFiles) => {
  const statuses = folderFiles.map(f => f.status)

  if (statuses.every(s => s === 'final_approved'))
    return { status: 'final_approved', label: 'Approved', cls: 'approved' }

  if (statuses.every(s => s === 'rejected_by_team_leader' || s === 'rejected_by_admin'))
    return { status: 'rejected', label: 'Rejected', cls: 'rejected' }

  if (statuses.every(s => s === 'team_leader_approved' || s === 'final_approved'))
    return { status: 'team_leader_approved', label: 'Pending Admin', cls: 'pending' }

  if (statuses.some(s => s === 'revision'))
    return { status: 'revision', label: 'Revision', cls: 'pending' }

  return { status: 'uploaded', label: 'Pending Team Leader', cls: 'pending' }
}

// Hook to compute fixed dropdown position
const useDropdownPosition = (btnRef, isOpen) => {
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
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
  onOpenFolderPath,
  isReference = false,
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

  const handleClick = useCallback(() => {
    onToggle(folderName)
  }, [folderName, onToggle])

  const firstFile = folderFiles[0]
  const formattedDate = useMemo(() => new Date(firstFile.uploaded_at).toLocaleDateString(), [firstFile.uploaded_at])
  const formattedTime = useMemo(() => new Date(firstFile.uploaded_at).toLocaleTimeString(), [firstFile.uploaded_at])
  const folderStatus = useMemo(() => getFolderStatus(folderFiles), [folderFiles])

  const canApprove = folderStatus.status === 'team_leader_approved'
  const canReject = folderStatus.status !== 'final_approved' && folderStatus.status !== 'rejected'

  return (
    <tr
      className="file-row folder-row"
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        backgroundColor: isExpanded ? '#f9fafb' : '#ffffff',
        fontWeight: '600'
      }}
    >
      <td>
        <div className="file-cell">
          <div className="file-icon" style={{ width: '34px', height: '34px', position: 'relative', zIndex: 2 }}>
            <FileIcon fileType="folder" isFolder={true} altText={`Folder: ${folderName}`} size="medium" style={{ position: 'relative', zIndex: 2 }} />
          </div>
          <div className="file-details">
            <span className="file-name">{folderName}</span>
          </div>
        </div>
      </td>
      <td><div className="user-cell"><span className="user-name">{firstFile.user_fullname || firstFile.username}</span></div></td>
      <td>
        <div className="datetime-cell">
          <div className="date">{formattedDate}</div>
          <div className="time">{formattedTime}</div>
        </div>
      </td>
      <td><span className="team-badge">{firstFile.user_team}</span></td>
      {!isReference && <td><span className={`status-badge status-${folderStatus.cls}`}>{folderStatus.label}</span></td>}
      <td>
        <div className="action-dropdown-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button
            ref={btnRef}
            className="action-dots-btn"
            onClick={(e) => { e.stopPropagation(); setDropdownOpen(prev => !prev) }}
            title="Actions"
          >
            ⋮
          </button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="action-dropdown-menu" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}>
              {(canApprove || canReject) && (
                <button
                  className="dropdown-item dropdown-approve-reject"
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onApproveFolder(folderName, folderFiles) }}
                >
                  <svg className="dropdown-svg-icon" width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" fill="#16a34a" opacity="0.15"/>
                    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke="#16a34a" strokeWidth="1.5"/>
                    <path d="M6.5 10L9 12.5L13.5 7.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="dropdown-approve-text">Approve</span>
                  <span className="dropdown-slash"> / </span>
                  <span className="dropdown-reject-text">Reject</span>
                  <span className="dropdown-folder-text"> Folder</span>
                </button>
              )}
              <button
                className="dropdown-item dropdown-open"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenFolderPath(folderFiles[0]) }}
              >
                <span className="dropdown-icon">📂</span> Open Folder Path
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item dropdown-delete"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onDelete(folderName, folderFiles) }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{color:'#ef4444',flexShrink:0}}>
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

// SubFolder Row Component
const SubFolderRow = memo(({
  folderName,
  folderFiles,
  isExpanded,
  onToggle,
  onDelete,
  onApproveFolder,
  onOpenFolderPath,
  isLast,
  level,
  parentIsLastArr,
  isReference = false,
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

  const handleClick = useCallback(() => {
    onToggle()
  }, [onToggle])

  const rawFiles = useMemo(() => folderFiles.map(f => f.file || f), [folderFiles])
  const firstFile = rawFiles[0]
  const formattedDate = useMemo(() => new Date(firstFile.uploaded_at).toLocaleDateString(), [firstFile.uploaded_at])
  const formattedTime = useMemo(() => new Date(firstFile.uploaded_at).toLocaleTimeString(), [firstFile.uploaded_at])
  const folderStatus = useMemo(() => getFolderStatus(rawFiles), [rawFiles])

  const canApprove = folderStatus.status === 'team_leader_approved'
  const canReject = folderStatus.status !== 'final_approved' && folderStatus.status !== 'rejected'

  return (
    <tr
      className="file-row folder-row"
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        backgroundColor: isExpanded ? '#f9fafb' : '#ffffff',
        fontWeight: '600'
      }}
    >
      <td>
        <div className="tl-tree-container">
          {parentIsLastArr.map((isLastParent, i) => (
            <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
          ))}
          {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
          <div className="file-cell" style={{ flex: 1 }}>
            <div className="file-icon" style={{ width: '34px', height: '34px', position: 'relative', zIndex: 2 }}>
              <FileIcon fileType="folder" isFolder={true} altText={`Folder: ${folderName}`} size="medium" style={{ position: 'relative', zIndex: 2 }} />
            </div>
            <div className="file-details">
              <span className="file-name">{folderName}</span>
            </div>
          </div>
        </div>
      </td>
      <td><div className="user-cell"><span className="user-name">{firstFile.user_fullname || firstFile.username}</span></div></td>
      <td>
        <div className="datetime-cell">
          <div className="date">{formattedDate}</div>
          <div className="time">{formattedTime}</div>
        </div>
      </td>
      <td><span className="team-badge">{firstFile.user_team}</span></td>
      {!isReference && <td><span className={`status-badge status-${folderStatus.cls}`}>{folderStatus.label}</span></td>}
      {isReference && (
        <td>
          <span className="status-badge" style={{ border: '1px solid #6b7280', color: '#6b7280' }}>
            Reference Task
          </span>
        </td>
      )}
      <td>
        <div className="action-dropdown-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button
            ref={btnRef}
            className="action-dots-btn"
            onClick={(e) => { e.stopPropagation(); setDropdownOpen(prev => !prev) }}
            title="Actions"
          >
            ⋮
          </button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="action-dropdown-menu" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}>
              {(canApprove || canReject) && (
                <button
                  className="dropdown-item dropdown-approve-reject"
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onApproveFolder(folderName, rawFiles) }}
                >
                  <svg className="dropdown-svg-icon" width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" fill="#16a34a" opacity="0.15"/>
                    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke="#16a34a" strokeWidth="1.5"/>
                    <path d="M6.5 10L9 12.5L13.5 7.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="dropdown-approve-text">Approve</span>
                  <span className="dropdown-slash"> / </span>
                  <span className="dropdown-reject-text">Reject</span>
                  <span className="dropdown-folder-text"> Folder</span>
                </button>
              )}
              <button
                className="dropdown-item dropdown-open"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenFolderPath(rawFiles[0]) }}
              >
                <span className="dropdown-icon">📂</span> Open Folder Path
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item dropdown-delete"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onDelete(folderName, rawFiles) }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{color:'#ef4444',flexShrink:0}}>
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

const FileRow = memo(({
  file,
  formatFileSize,
  mapFileStatus,
  getStatusDisplayName,
  onOpenModal,
  onDelete,
  onOpenFilePath,
  isNested = false,
  isLast = false,
  parentIsLastArr = [],
  isReference = false,
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

  const handleRowClick = useCallback(() => {
    onOpenModal(file)
  }, [file, onOpenModal])

  const getFileExtension = useCallback((filename, fileType) => {
    if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) return parts[parts.length - 1].toLowerCase()
    }
    return fileType ? fileType.replace(/^\./, '').toLowerCase() : ''
  }, [])

  const fileExtension = getFileExtension(file.original_name, file.file_type)
  const formattedDate = useMemo(() => new Date(file.uploaded_at).toLocaleDateString(), [file.uploaded_at])
  const formattedTime = useMemo(() => new Date(file.uploaded_at).toLocaleTimeString(), [file.uploaded_at])

  let displayName = file.original_name
  if (isNested) {
    const cleanPath = (file.relative_path || file.original_name || '').replace(/\\/g, '/');
    const parts = cleanPath.split('/').filter(Boolean)
    if (parts.length > 0) {
      displayName = parts[parts.length - 1]
    }
  }

  return (
    <tr
      className={`file-row ${isNested ? 'nested-file' : ''}`}
      onClick={handleRowClick}
      style={isNested ? { backgroundColor: '#fafafa' } : {}}
    >
      <td>
        {isNested ? (
          <div className="tl-tree-container">
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />
            <div className="file-cell" style={{ flex: 1 }}>
              <div className="file-icon" style={{ width: '34px', height: '34px', position: 'relative', zIndex: 2 }}>
                <FileIcon fileType={fileExtension} isFolder={false} altText={`Icon for ${file.original_name}`} size="medium" style={{ position: 'relative', zIndex: 2 }} />
              </div>
              <div className="file-details">
                <span className="file-name">{displayName}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="file-cell">
            <div className="file-icon" style={{ width: '34px', height: '34px', position: 'relative', zIndex: 2 }}>
              <FileIcon fileType={fileExtension} isFolder={false} altText={`Icon for ${file.original_name}`} size="medium" style={{ position: 'relative', zIndex: 2 }} />
            </div>
            <div className="file-details">
              <span className="file-name">{displayName}</span>
            </div>
          </div>
        )}
      </td>
      <td><div className="user-cell"><span className="user-name">{file.user_fullname || file.username}</span></div></td>
      <td>
        <div className="datetime-cell">
          <div className="date">{formattedDate}</div>
          <div className="time">{formattedTime}</div>
        </div>
      </td>
      <td><span className="team-badge">{file.user_team}</span></td>
      {!isReference && (
        <td>
          <span className={`status-badge status-${mapFileStatus(file.status)}`}>
            {getStatusDisplayName(file.status)}
          </span>
        </td>
      )}
      <td>
        <div className="action-dropdown-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button
            ref={btnRef}
            className="action-dots-btn"
            onClick={(e) => { e.stopPropagation(); setDropdownOpen(prev => !prev) }}
            title="Actions"
          >
            ⋮
          </button>
          {dropdownOpen && (
            <div ref={dropdownRef} className="action-dropdown-menu" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}>
              <button
                className="dropdown-item dropdown-open"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onOpenFilePath(file) }}
              >
                <span className="dropdown-icon">📂</span> Open File Path
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item dropdown-delete"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); onDelete(file) }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{color:'#ef4444',flexShrink:0}}>
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
})

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const [files, setFiles] = useState([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSearchInput, setFileSearchInput] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [viewMode, setViewMode] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(7)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [fileToReject, setFileToReject] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [folderToDelete, setFolderToDelete] = useState(null)
  const [folderReviewModal, setFolderReviewModal] = useState(null)
  const [folderReviewComment, setFolderReviewComment] = useState('')
  const [deleteAlert, setDeleteAlert] = useState(null)
  const [activeView, setActiveView] = useState('approval') // 'approval' | 'reference'

  const fetchAbortController = useRef(null)

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  const fetchFiles = useCallback(async () => {
    if (fetchAbortController.current) fetchAbortController.current.abort()
    fetchAbortController.current = new AbortController()
    setIsLoading(true)
    try {
      const data = await apiFetch(`${API_BASE}/files/all`, { signal: fetchAbortController.current.signal })
      if (data.success) {
        setFiles(data.files)
      } else {
        setError('Failed to fetch files')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching files:', err)
        setError('Failed to connect to server')
      }
    } finally {
      setIsLoading(false)
    }
  }, [setError])

  useEffect(() => {
    if (isConnected) fetchFiles()
    return () => { if (fetchAbortController.current) fetchAbortController.current.abort() }
  }, [isConnected, fetchFiles])

  useEffect(() => {
    const timer = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(timer)
  }, [fileSearchInput])

  useEffect(() => {
    setCurrentPage(1)
  }, [fileSearchQuery, fileFilter, fileSortBy, viewMode])

  const groupFilesByFolder = useCallback((files) => {
    const folders = {}
    const individualFiles = []
    files.forEach(file => {
      if (file.folder_name && file.folder_name.trim() !== '') {
        const key = `${file.folder_name}||${file.user_id || file.username || ''}`
        if (!folders[key]) folders[key] = []
        folders[key].push(file)
      } else {
        individualFiles.push(file)
      }
    })
    return { folders, individualFiles }
  }, [])

  const statusCounts = useMemo(() => ({
    pendingTeamLeader: files.filter(f => f.status === 'uploaded' || f.status === 'revision').length,
    pendingAdmin: files.filter(f => f.status === 'team_leader_approved').length,
    approved: files.filter(f => f.status === 'final_approved').length,
    rejected: files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
  }), [files])

  const filteredFiles = useMemo(() => {
    // Split by view: approval = member submissions, reference = TL attachments
    const sourceFiles = activeView === 'reference'
      ? files.filter(f => f.source_type === 'assignment_attachment')
      : files.filter(f => f.source_type !== 'assignment_attachment')

    let filtered = sourceFiles

    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        switch (fileFilter) {
          case 'pending-team-leader': return file.status === 'uploaded'
          case 'pending-admin':       return file.status === 'team_leader_approved'
          case 'approved':            return file.status === 'final_approved'
          case 'rejected':            return file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'
          default: return false
        }
      })
    }

    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.original_name.toLowerCase().includes(q) ||
        file.username.toLowerCase().includes(q) ||
        file.user_team.toLowerCase().includes(q) ||
        (file.folder_name && file.folder_name.toLowerCase().includes(q))
      )
    }

    return [...filtered].sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc':     return new Date(b.uploaded_at) - new Date(a.uploaded_at)
        case 'date-asc':      return new Date(a.uploaded_at) - new Date(b.uploaded_at)
        case 'filename-asc':  return a.original_name.localeCompare(b.original_name)
        case 'filename-desc': return b.original_name.localeCompare(a.original_name)
        case 'user-asc':      return a.username.localeCompare(b.username)
        case 'user-desc':     return b.username.localeCompare(a.username)
        default: return 0
      }
    })
  }, [files, fileSearchQuery, fileFilter, fileSortBy, activeView])

  const groupedData = useMemo(() => groupFilesByFolder(filteredFiles), [filteredFiles, groupFilesByFolder])

  const getDateLabel = useCallback((dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((today - itemDay) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return 'This Week'
    if (diffDays <= 30) return 'This Month'
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [])

  const paginationItems = useMemo(() => {
    const items = []

    if (viewMode === 'by-date') {
      const allItems = []
      Object.keys(groupedData.folders).forEach(folderKey => {
        const folderName = folderKey.includes('||') ? folderKey.split('||')[0] : folderKey
        const files = groupedData.folders[folderKey]
        allItems.push({ type: 'folder', folderKey, name: folderName, files, _date: new Date(files[0].uploaded_at) })
      })
      groupedData.individualFiles.forEach(file => {
        allItems.push({ type: 'file', file, _date: new Date(file.uploaded_at) })
      })
      allItems.sort((a, b) => b._date - a._date)

      let lastLabel = null
      allItems.forEach(item => {
        const label = getDateLabel(item._date)
        if (label !== lastLabel) {
          items.push({ type: 'date-header', label })
          lastLabel = label
        }
        items.push(item)
      })
      return items
    }

    const allItems = []

    if (viewMode !== 'files') {
      Object.keys(groupedData.folders).forEach(folderKey => {
        const folderName = folderKey.includes('||') ? folderKey.split('||')[0] : folderKey
        const files = groupedData.folders[folderKey]
        const latestDate = Math.max(...files.map(f => new Date(f.uploaded_at).getTime()))
        allItems.push({ type: 'folder', folderKey, name: folderName, files, _date: latestDate, _name: folderName, _user: files[0]?.username || '' })
      })
    }

    if (viewMode !== 'folders') {
      groupedData.individualFiles.forEach(file => {
        allItems.push({ type: 'file', file, _date: new Date(file.uploaded_at).getTime(), _name: file.original_name, _user: file.username })
      })
    }

    allItems.sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc':     return b._date - a._date
        case 'date-asc':      return a._date - b._date
        case 'filename-asc':  return a._name.localeCompare(b._name)
        case 'filename-desc': return b._name.localeCompare(a._name)
        case 'user-asc':      return a._user.localeCompare(b._user)
        case 'user-desc':     return b._user.localeCompare(a._user)
        default: return b._date - a._date
      }
    })

    return allItems
  }, [groupedData, viewMode, fileSortBy, getDateLabel])

  const currentPageItems = useMemo(() => {
    const start = (currentPage - 1) * filesPerPage
    return paginationItems.slice(start, start + filesPerPage)
  }, [paginationItems, currentPage, filesPerPage])

  const totalPages = useMemo(() => Math.ceil(paginationItems.length / filesPerPage), [paginationItems.length, filesPerPage])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const mapFileStatus = useCallback((dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
      case 'revision':
      case 'team_leader_approved': return 'pending'
      case 'final_approved':       return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':    return 'rejected'
      default: return 'pending'
    }
  }, [])

  const getStatusDisplayName = useCallback((dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':              return 'Pending Team Leader'
      case 'revision':              return 'Revision (New Submission)'
      case 'team_leader_approved':  return 'Pending Admin'
      case 'final_approved':        return 'Approved'
      case 'rejected_by_team_leader': return 'Rejected by Team Leader'
      case 'rejected_by_admin':     return 'Rejected by Admin'
      default: return dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1)
    }
  }, [])

  const toggleFolder = useCallback((folderName) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))
  }, [])

  const openDeleteModal = useCallback((file) => {
    setFileToDelete(file)
    setFolderToDelete(null)
    setShowDeleteModal(true)
  }, [])

  const openFolderDeleteModal = useCallback((folderName, folderFiles) => {
    setFolderToDelete({ folderName, folderFiles })
    setFileToDelete(null)
    setShowDeleteModal(true)
  }, [])

  const openRejectModal = useCallback((file) => {
    setFileToReject(file)
    setShowRejectModal(true)
  }, [])

  const closeRejectModal = useCallback(() => {
    setShowRejectModal(false)
    setFileToReject(null)
  }, [])

  const openFileModal = useCallback((file) => {
    setSelectedFile(file)
    setShowFileModal(true)
  }, [])

  const closeFileModal = useCallback(() => {
    setShowFileModal(false)
    setSelectedFile(null)
    setIsOpeningFile(false)
  }, [])

  const deleteFile = useCallback(async () => {
    if (!fileToDelete && !folderToDelete) return
    setIsLoading(true)
    try {
      if (folderToDelete) {
        const isAttachmentFolder = folderToDelete.folderFiles.some(f => f.source_type === 'assignment_attachment')

        if (isAttachmentFolder) {
          try {
            await apiFetch(`${API_BASE}/files/folder/delete-attachments`, {
              method: 'POST',
              body: JSON.stringify({
                folderName: folderToDelete.folderName,
                fileIds: folderToDelete.folderFiles.map(f => f.id),
                adminId: authUser.id,
                adminUsername: authUser.username,
                adminRole: authUser.role,
                team: authUser.team
              })
            })
          } catch (err) {
            console.warn('Attachment folder delete error:', err)
          }
          setFiles(prev => prev.filter(file => !folderToDelete.folderFiles.some(f => f.id === file.id)))
          setShowDeleteModal(false)
          setFolderToDelete(null)
          setDeleteAlert(`Folder "${folderToDelete.folderName}" deleted successfully`)
        } else {
          const deletePromises = folderToDelete.folderFiles.map(file =>
            apiFetch(`${API_BASE}/files/${file.id}`, {
              method: 'DELETE',
              body: JSON.stringify({
                adminId: authUser.id,
                adminUsername: authUser.username,
                adminRole: authUser.role,
                team: authUser.team
              })
            }).catch(() => ({ success: false }))
          )

          const results = await Promise.all(deletePromises)
          if (results.every(r => r.success)) {
            try {
              await apiFetch(`${API_BASE}/files/folder/delete`, {
                method: 'POST',
                body: JSON.stringify({
                  folderName: folderToDelete.folderName,
                  username: folderToDelete.folderFiles[0].username,
                  fileIds: folderToDelete.folderFiles.map(f => f.id),
                  userId: authUser.id,
                  userRole: authUser.role,
                  team: authUser.team
                })
              })
            } catch (err) {
              console.warn('Error deleting folder directory:', err)
            }
            setFiles(prev => prev.filter(file => !folderToDelete.folderFiles.some(f => f.id === file.id)))
            setShowDeleteModal(false)
            setFolderToDelete(null)
            setDeleteAlert(`Folder "${folderToDelete.folderName}" with ${folderToDelete.folderFiles.length} file(s) deleted successfully`)
          } else {
            throw new Error('Failed to delete some files in the folder')
          }
        }
      } else {
        const data = await apiFetch(`${API_BASE}/files/${fileToDelete.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team
          })
        })
        if (data.success) {
          setFiles(prev => prev.filter(file => file.id !== fileToDelete.id))
          setShowDeleteModal(false)
          setFileToDelete(null)
          setDeleteAlert('File deleted successfully')
        } else {
          setError(data.message || 'Failed to delete file')
        }
      }
    } catch (err) {
      console.error('Error deleting:', err)
      setError(err.message || 'Failed to delete')
    } finally {
      setIsLoading(false)
    }
  }, [fileToDelete, folderToDelete, authUser, setError])

  const openFilePath = useCallback(async (file) => {
    if (!file) return
    setIsOpeningFile(true)
    try {
      const pathData = await apiFetch(`${API_BASE}/files/${file.id}/path`)
      if (!pathData.success) throw new Error('Failed to get file path')
      if (window.electron && typeof window.electron.openFolderInExplorer === 'function') {
        const result = await window.electron.openFolderInExplorer(pathData.filePath)
        if (!result.success) throw new Error(result.error || 'Failed to open folder path')
      } else {
        setError('Folder path opening not available in browser mode')
      }
    } catch (err) {
      console.error('Error opening folder path:', err)
      setError(err.message || 'Failed to open folder path')
    } finally {
      setIsOpeningFile(false)
    }
  }, [setError])

  const openFile = useCallback(async (file) => {
    if (!file) return
    setIsOpeningFile(true)
    try {
      const pathData = await apiFetch(`${API_BASE}/files/${file.id}/path`)
      if (!pathData.success) throw new Error('Failed to get file path')
      if (window.electron && typeof window.electron.openFileInApp === 'function') {
        const result = await window.electron.openFileInApp(pathData.filePath)
        if (!result.success) throw new Error(result.error || 'Failed to open file')
      } else {
        setError('File opening not available')
      }
    } catch (err) {
      console.error('Error opening file:', err)
      setError(err.message || 'Failed to open file')
    } finally {
      setIsOpeningFile(false)
    }
  }, [setError])

  const openFolderReviewModal = useCallback((folderName, folderFiles, action = 'approve') => {
    setFolderReviewModal({ folderName, folderFiles, action })
    setFolderReviewComment('')
  }, [])

  const confirmApproveFolder = useCallback(async () => {
    if (!folderReviewModal) return
    setIsLoading(true)
    try {
      let destinationPath = null
      if (window.electron && typeof window.electron.openDirectoryDialog === 'function') {
        const options = {}
        try {
          if (typeof window.electron.getNetworkProjectsPath === 'function') {
            const dp = await window.electron.getNetworkProjectsPath()
            if (dp) options.defaultPath = dp
          }
        } catch (err) {
          console.warn('Could not get default path', err)
        }
        const result = await window.electron.openDirectoryDialog(options)
        if (!result || result.canceled || !result.filePaths?.length) {
          setIsLoading(false)
          return
        }
        destinationPath = result.filePaths[0]
      } else {
        throw new Error('File system access not available')
      }

      const data = await apiFetch(`${API_BASE}/files/folder/move-to-nas`, {
        method: 'POST',
        body: JSON.stringify({
          folderName: folderReviewModal.folderName,
          username: folderReviewModal.folderFiles[0].username,
          fileIds: folderReviewModal.folderFiles.map(f => f.id),
          destinationPath,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          team: authUser.team,
          comments: folderReviewComment.trim() || null
        })
      })
      if (!data.success) throw new Error(data.message || 'Failed to move folder to NAS')

      setFiles(prev =>
        prev.map(f =>
          folderReviewModal.folderFiles.some(ff => ff.id === f.id) ? { ...f, status: 'final_approved' } : f
        )
      )
      const approvedFolderName = folderReviewModal.folderName
      setFolderReviewModal(null)
      setFolderReviewComment('')
      setSuccess(`Folder "${approvedFolderName}" approved and uploaded to NAS successfully`)
      fetchFiles()
    } catch (err) {
      console.error('Folder approval error:', err)
      setError(err.message || 'Failed to approve folder')
    } finally {
      setIsLoading(false)
    }
  }, [folderReviewModal, folderReviewComment, authUser, setError, setSuccess, fetchFiles])

  // ✅ FIX: Use setError (red) for rejection notifications, not setSuccess (green)
  const confirmRejectFolder = useCallback(async () => {
    if (!folderReviewModal) return
    setIsLoading(true)
    try {
      for (const file of folderReviewModal.folderFiles) {
        try {
          await apiFetch(`${API_BASE}/files/${file.id}/admin-review`, {
            method: 'POST',
            body: JSON.stringify({
              action: 'reject',
              comments: folderReviewComment.trim() || null,
              adminId: authUser.id,
              adminUsername: authUser.username,
              adminRole: authUser.role,
              team: authUser.team
            })
          })
        } catch (err) {
          console.warn(`Failed to reject file ${file.id}:`, err)
        }
      }

      setFiles(prev =>
        prev.map(f =>
          folderReviewModal.folderFiles.some(ff => ff.id === f.id) ? { ...f, status: 'rejected_by_admin' } : f
        )
      )
      const rejectedFolderName = folderReviewModal.folderName
      setFolderReviewModal(null)
      setFolderReviewComment('')
      setError(`Folder "${rejectedFolderName}" rejected successfully`) // ✅ red alert
      fetchFiles()
    } catch (err) {
      console.error('Folder rejection error:', err)
      setError(err.message || 'Failed to reject folder')
    } finally {
      setIsLoading(false)
    }
  }, [folderReviewModal, folderReviewComment, authUser, setError, fetchFiles])

  const approveFile = useCallback(async () => {
    if (!selectedFile) return
    setIsLoading(true)
    try {
      let approvedOnServer = false

      if (window.electron && typeof window.electron.openDirectoryDialog === 'function') {
        const options = {}
        try {
          if (typeof window.electron.getNetworkProjectsPath === 'function') {
            const dp = await window.electron.getNetworkProjectsPath()
            if (dp) options.defaultPath = dp
          }
        } catch (err) {
          console.warn('Could not get default path', err)
        }

        const result = await window.electron.openDirectoryDialog(options)
        if (!result || result.canceled || !result.filePaths?.length) {
          setIsLoading(false)
          return
        }
        const selectedPath = result.filePaths[0]

        const moveData = await apiFetch(`${API_BASE}/files/${selectedFile.id}/move-to-projects`, {
          method: 'POST',
          body: JSON.stringify({
            destinationPath: selectedPath,
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team,
            deleteFromUploads: true
          })
        })
        if (!moveData.success) throw new Error(moveData.message || 'Failed to move file')

        const approveData = await apiFetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'approve',
            comments: null,
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team
          })
        })
        if (!approveData.success) throw new Error(approveData.message || 'Failed to approve file')
        approvedOnServer = true
      } else {
        throw new Error('File system access not available')
      }

      if (approvedOnServer) {
        setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, status: 'final_approved' } : f))
        closeFileModal()
        setSuccess('File approved and moved successfully')
        fetchFiles()
      }
    } catch (err) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve file')
    } finally {
      setIsLoading(false)
    }
  }, [selectedFile, authUser, setError, setSuccess, closeFileModal, fetchFiles])

  // ✅ FIX: Use setError (red) for rejection notifications, not setSuccess (green)
  const confirmRejectFile = useCallback(async () => {
    if (!fileToReject) return
    setIsLoading(true)
    try {
      const data = await apiFetch(`${API_BASE}/files/${fileToReject.id}/admin-review`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject',
          comments: null,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          team: authUser.team
        })
      })

      if (data.success) {
        setFiles(prev => prev.map(f => f.id === fileToReject.id ? { ...f, status: 'rejected_by_admin' } : f))
        closeFileModal()
        closeRejectModal()
        setError('File rejected successfully') // ✅ red alert
        fetchFiles()
      } else {
        setError(data.message || 'Failed to reject file')
      }
    } catch (err) {
      console.error('Error rejecting file:', err)
      setError('Failed to reject file')
    } finally {
      setIsLoading(false)
    }
  }, [fileToReject, authUser, setError, closeFileModal, closeRejectModal, fetchFiles])

  const renderFileRows = useMemo(() => {
    const rows = []

    const renderRecursiveItems = (files, level = 1, parentKey = '', parentIsLastArr = []) => {
      const { subfolders, rootFiles } = recursiveGroupByPath(files);
      const items = [];

      const subfolderEntries = Object.entries(subfolders);
      const totalSubfolders = subfolderEntries.length;
      const totalRootFiles = rootFiles.length;

      // 1. Render subfolders
      subfolderEntries.forEach(([subfolderName, folderFiles], index) => {
        const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
        const currentKey = parentKey ? `${parentKey}__${subfolderName}` : subfolderName;
        const isSubFolderExpanded = expandedFolders[currentKey];

        items.push(
          <React.Fragment key={`folder-${currentKey}`}>
            <SubFolderRow
              folderName={subfolderName}
              folderFiles={folderFiles}
              isExpanded={isSubFolderExpanded}
              onToggle={() => toggleFolder(currentKey)}
              onDelete={openFolderDeleteModal}
              onApproveFolder={(name, files) => openFolderReviewModal(name, files, 'approve')}
              onOpenFolderPath={openFilePath}
              isLast={isLast}
              level={level}
              parentIsLastArr={parentIsLastArr}
              isReference={activeView === 'reference'}
            />
            {isSubFolderExpanded && renderRecursiveItems(folderFiles, level + 1, currentKey, [...parentIsLastArr, isLast])}
          </React.Fragment>
        );
      });

      // 2. Render root files
      rootFiles.forEach((item, index) => {
        const isLast = index === totalRootFiles - 1;
        const file = item.file || item;
        items.push(
          <FileRow
            key={file.id}
            file={file}
            formatFileSize={formatFileSize}
            mapFileStatus={mapFileStatus}
            getStatusDisplayName={getStatusDisplayName}
            onOpenModal={openFileModal}
            onDelete={openDeleteModal}
            onOpenFilePath={openFilePath}
            isNested={true}
            isLast={isLast}
            parentIsLastArr={parentIsLastArr}
            isReference={activeView === 'reference'}
          />
        );
      });

      return items;
    };

    currentPageItems.forEach(item => {
      if (item.type === 'date-header') {
        rows.push(
          <tr key={`date-header-${item.label}`} className="date-header-row">
            <td colSpan="6">
              <div className="date-header-label">
                <span className="date-header-icon">📅</span>
                {item.label}
              </div>
            </td>
          </tr>
        )
      } else if (item.type === 'folder') {
        const folderKey = item.folderKey || item.name
        const isExpanded = expandedFolders[folderKey]

        rows.push(
          <FolderRow
            key={`folder-${folderKey}`}
            folderName={item.name}
            folderFiles={item.files}
            isExpanded={isExpanded}
            onToggle={() => toggleFolder(folderKey)}
            onDelete={openFolderDeleteModal}
            onApproveFolder={(name, files) => openFolderReviewModal(name, files, 'approve')}
            onOpenFolderPath={openFilePath}
            formatFileSize={formatFileSize}
            isReference={activeView === 'reference'}
          />
        )

        if (isExpanded) {
          const mappedFilesForRecursion = item.files.map(file => {
            const path = (file.relative_path || file.webkitRelativePath || '').replace(/\\/g, '/');
            const parts = path.split('/').filter(Boolean);
            let remainingPath = path;
            if (parts.length > 0 && parts[0].trim() === item.name) {
              remainingPath = parts.slice(1).join('/');
            }
            return {
              file,
              _temp_path: remainingPath
            };
          });

          rows.push(...renderRecursiveItems(mappedFilesForRecursion, 1, folderKey, []));
        }
      } else {
        rows.push(
          <FileRow
            key={item.file.id}
            file={item.file}
            formatFileSize={formatFileSize}
            mapFileStatus={mapFileStatus}
            getStatusDisplayName={getStatusDisplayName}
            onOpenModal={openFileModal}
            onDelete={openDeleteModal}
            onOpenFilePath={openFilePath}
            isNested={false}
            isReference={activeView === 'reference'}
          />
        )
      }
    })

    return rows
  }, [currentPageItems, expandedFolders, activeView, toggleFolder, openFolderDeleteModal, openFolderReviewModal, openFilePath, openDeleteModal, openFileModal, formatFileSize, mapFileStatus, getStatusDisplayName])

  const renderPaginationNumbers = useMemo(() => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>
            {i}
          </button>
        )
      }
    } else {
      pageNumbers.push(
        <button key={1} className={`pagination-btn ${1 === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(1)}>1</button>
      )
      if (currentPage > 3) pageNumbers.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>)

      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)
      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(
            <button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i}</button>
          )
        }
      }

      if (currentPage < totalPages - 2) pageNumbers.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>)
      if (totalPages > 1) {
        pageNumbers.push(
          <button key={totalPages} className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
        )
      }
    }

    return pageNumbers
  }, [totalPages, currentPage])

  if (!isConnected) return <SkeletonLoader type="table" />

  return (
    <div className={`file-approval-section ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}
      {deleteAlert && <AlertMessage type="error" message={deleteAlert} onClose={() => setDeleteAlert(null)} />}

      <div style={{ marginBottom: '0.5rem', marginTop: '-1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>File Approval</h2>
        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review and approve member file submissions</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#f9fafb' }}>
          <button
            onClick={() => { setActiveView('approval'); setCurrentPage(1) }}
            style={{
              padding: '7px 20px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer',
              background: activeView === 'approval' ? 'white' : 'transparent',
              color: activeView === 'approval' ? '#111827' : '#6b7280',
              boxShadow: activeView === 'approval' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              borderRadius: '7px', margin: '2px', transition: 'all 0.2s ease',
            }}
          >File Approval</button>
          <button
            onClick={() => { setActiveView('reference'); setCurrentPage(1) }}
            style={{
              padding: '7px 20px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer',
              background: activeView === 'reference' ? 'white' : 'transparent',
              color: activeView === 'reference' ? '#111827' : '#6b7280',
              boxShadow: activeView === 'reference' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              borderRadius: '7px', margin: '2px', transition: 'all 0.2s ease',
            }}
          >Reference Files</button>
        </div>

        <div className="file-status-cards" style={{ marginBottom: 0 }}>
          <StatusCard icon="TL" label="Pending Team Leader" count={statusCounts.pendingTeamLeader} className="pending" />
          <StatusCard icon="AD" label="Pending Admin" count={statusCounts.pendingAdmin} className="pending-admin" />
          <StatusCard icon="AP" label="Approved Files" count={statusCounts.approved} className="approved" />
          <StatusCard icon="RE" label="Rejected Files" count={statusCounts.rejected} className="rejected" />
        </div>
      </div>

      <div className="file-controls">
        <div className="file-search">
          <input
            type="text"
            placeholder="Search files by name, user, or team..."
            value={fileSearchInput}
            onChange={(e) => setFileSearchInput(e.target.value)}
            className="search-input"
          />
          {fileSearchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => { setFileSearchInput(''); setFileSearchQuery('') }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="file-filters">
          <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} className="form-select">
            <option value="all">All Files</option>
            <option value="pending-team-leader">Pending Team Leader</option>
            <option value="pending-admin">Pending Admin</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={fileSortBy} onChange={(e) => setFileSortBy(e.target.value)} className="form-select">
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Filename A-Z</option>
            <option value="filename-desc">Filename Z-A</option>
            <option value="user-asc">User A-Z</option>
            <option value="user-desc">User Z-A</option>
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="form-select">
            <option value="all">All Items</option>
            <option value="files">Files Only</option>
            <option value="folders">Folders Only</option>
          </select>
        </div>
      </div>

      <div className="table-section">
        <div className="files-table-container">
          <table className="files-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Submitted By</th>
                <th>Date & Time</th>
                <th>Team</th>
                {activeView === 'approval' && <th>Status</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(filesPerPage).fill(0).map((_, i) => <FileRowSkeleton key={i} />)
              ) : currentPageItems.length > 0 ? (
                renderFileRows
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <h3>No files found</h3>
                      <p>No files match the current filter or search query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && paginationItems.length > 0 && (
          <div className="pagination-section">
            <div className="pagination-info">
              Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, paginationItems.length)} of {paginationItems.length} items
            </div>
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>‹</button>
                {renderPaginationNumbers}
                <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      <FileDetailsModal
        isOpen={showFileModal}
        onClose={closeFileModal}
        file={selectedFile}
        onApprove={approveFile}
        onReject={openRejectModal}
        onOpenFile={() => openFile(selectedFile)}
        isLoading={isLoading}
        isOpeningFile={isOpeningFile}
        formatFileSize={formatFileSize}
        mapFileStatus={mapFileStatus}
        getStatusDisplayName={getStatusDisplayName}
      />

      <ConfirmationModal
        isOpen={showDeleteModal && (fileToDelete || folderToDelete)}
        onClose={() => { setShowDeleteModal(false); setFileToDelete(null); setFolderToDelete(null) }}
        onConfirm={deleteFile}
        title={folderToDelete ? 'Delete Folder' : 'Delete File'}
        message={folderToDelete
          ? `Are you sure you want to delete the folder "${folderToDelete.folderName}" with all ${folderToDelete.folderFiles.length} file(s)?`
          : 'Are you sure you want to delete this file?'
        }
        confirmText={folderToDelete ? 'Delete Folder' : 'Delete File'}
        variant="danger"
        isLoading={isLoading}
        itemInfo={fileToDelete ? {
          name: fileToDelete.original_name || fileToDelete.filename,
          details: `Submitted by ${fileToDelete.username} from ${fileToDelete.user_team} team`
        } : folderToDelete ? {
          name: folderToDelete.folderName,
          details: `Contains ${folderToDelete.folderFiles.length} file(s) from ${folderToDelete.folderFiles[0].user_team} team`
        } : null}
      >
        <p className="warning-text">
          {folderToDelete
            ? `This will permanently delete the folder and all ${folderToDelete.folderFiles.length} file(s) inside it. This action cannot be undone.`
            : 'This action cannot be undone. The file and all its associated data will be permanently removed.'
          }
        </p>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={showRejectModal && fileToReject}
        onClose={closeRejectModal}
        onConfirm={confirmRejectFile}
        title="Reject File"
        message="Are you sure you want to reject this file?"
        confirmText="Reject File"
        variant="danger"
        isLoading={isLoading}
        itemInfo={fileToReject ? {
          name: fileToReject.original_name || fileToReject.filename,
          details: `Submitted by ${fileToReject.username} from ${fileToReject.user_team} team`
        } : null}
      >
        <p className="warning-text">
          The user who submitted this file will be notified that their file has been rejected. The file will be deleted from the uploads folder.
        </p>
      </ConfirmationModal>

      {/* Folder Review Modal */}
      {folderReviewModal && (
        <div className="file-details-modal-component">
          <div className="modal-overlay" onClick={() => { if (!isLoading) { setFolderReviewModal(null); setFolderReviewComment('') } }}>
            <div className="modal file-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Folder Details</h3>
                <button className="modal-close" onClick={() => { setFolderReviewModal(null); setFolderReviewComment('') }} disabled={isLoading}>×</button>
              </div>
              <div className="modal-body">
                <div className="file-details-section">
                  <h4 className="section-title">FOLDER DETAILS</h4>
                  <div className="file-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">FOLDER NAME:</span>
                      <span className="detail-value">📁 {folderReviewModal.folderName}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">SUBMITTED BY:</span>
                      <span className="detail-value">{folderReviewModal.folderFiles[0]?.fullName || folderReviewModal.folderFiles[0]?.username || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">TEAM:</span>
                      <span className="detail-value team-badge-inline">{folderReviewModal.folderFiles[0]?.user_team || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">UPLOAD DATE:</span>
                      <span className="detail-value">{new Date(folderReviewModal.folderFiles[0]?.uploaded_at).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">TOTAL FILES:</span>
                      <span className="detail-value">{folderReviewModal.folderFiles.length} files</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">PENDING REVIEW:</span>
                      <span className="detail-value">{folderReviewModal.folderFiles.filter(f => f.status === 'team_leader_approved').length} files</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">STATUS:</span>
                      <span className="detail-value status-badge status-pending">Pending Admin</span>
                    </div>
                  </div>
                </div>

                <div className="actions-section">
                  <div className="action-buttons-large">
                    <button className="btn btn-success-large" disabled={isLoading} onClick={confirmApproveFolder}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {isLoading ? 'Processing...' : 'Approve All'}
                    </button>
                    <button className="btn btn-danger-large" disabled={isLoading} onClick={confirmRejectFolder}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {isLoading ? 'Processing...' : 'Reject All'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(FileApproval, { componentName: 'File Approval' })

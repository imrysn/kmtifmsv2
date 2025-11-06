import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import FileIcon from './FileIcon'
import LoadingSpinner from '../LoadingSpinner'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileApproval-Optimized.css'
import { ConfirmationModal, AlertMessage } from './modals'

const API_BASE = 'http://localhost:3001/api'
const SERVER_BASE = API_BASE.replace(/\/api$/, '')


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

const FileRow = memo(({
  file,
  formatFileSize,
  mapFileStatus,
  getStatusDisplayName,
  onOpenModal,
  onDelete
}) => {
  const handleRowClick = useCallback(() => {
    onOpenModal(file)
  }, [file, onOpenModal])

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation()
    onDelete(file)
  }, [file, onDelete])

  // Extract file extension from filename or file_type
  const getFileExtension = useCallback((filename, fileType) => {
    if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) {
        return parts[parts.length - 1].toLowerCase()
      }
    }
    if (fileType) {
      return fileType.replace(/^\./, '').toLowerCase()
    }
    return ''
  }, [])

  const fileExtension = getFileExtension(file.original_name, file.file_type)

  // Memoize formatted dates to avoid recalculating on every render
  const formattedDate = useMemo(() => new Date(file.uploaded_at).toLocaleDateString(), [file.uploaded_at])
  const formattedTime = useMemo(() => new Date(file.uploaded_at).toLocaleTimeString(), [file.uploaded_at])
  const formattedFileSize = useMemo(() => formatFileSize(file.file_size), [file.file_size, formatFileSize])

  return (
    <tr className="file-row" onClick={handleRowClick}>
      <td>
        <div className="file-cell">
          <div className="file-icon">
            <FileIcon
              fileType={fileExtension}
              isFolder={false}
              altText={`Icon for ${file.original_name}`}
              size="medium"
            />
          </div>
          <div className="file-details">
            <span className="file-name">{file.original_name}</span>
            <span className="file-size">{formattedFileSize}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="user-cell">
          <span className="user-name">{file.username}</span>
        </div>
      </td>
      <td>
        <div className="datetime-cell">
          <div className="date">{formattedDate}</div>
          <div className="time">{formattedTime}</div>
        </div>
      </td>
      <td>
        <span className="team-badge">{file.user_team}</span>
      </td>
      <td>
        <span className={`status-badge status-${mapFileStatus(file.status)}`}>
          {getStatusDisplayName(file.status)}
        </span>
      </td>
      <td>
        <button
          className="action-btn delete-btn"
          onClick={handleDeleteClick}
          title="Delete File"
        >
          Delete
        </button>
      </td>
    </tr>
  )
})



const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  // State management
  const [files, setFiles] = useState([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSearchInput, setFileSearchInput] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(7)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [networkAvailable, setNetworkAvailable] = useState(true)
  
  // Refs
  const statusCardsRef = useRef(null)
  const searchInputRef = useRef(null)
  const filterSelectRef = useRef(null)
  const fetchAbortController = useRef(null)

  // Check network availability on mount and periodically
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        await fetch(`${API_BASE}/health`)
        setNetworkAvailable(true)
      } catch {
        setNetworkAvailable(false)
      }
    }

    checkNetwork()
    const interval = setInterval(checkNetwork, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  // Initial fetch
  useEffect(() => {
    if (networkAvailable) {
      fetchFiles()
    }
    return () => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort()
      }
    }
  }, [networkAvailable])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(timer)
  }, [fileSearchInput])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [fileSearchQuery, fileFilter, fileSortBy])

  // Calculate status counts efficiently
  const statusCounts = useMemo(() => {
    return {
      pendingTeamLeader: files.filter(f => f.status === 'uploaded').length,
      pendingAdmin: files.filter(f => f.status === 'team_leader_approved').length,
      approved: files.filter(f => f.status === 'final_approved').length,
      rejected: files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
    }
  }, [files])

  // Optimized filtering and sorting with early returns
  const filteredFiles = useMemo(() => {
    let filtered = files

    // Apply filter first (reduces dataset)
    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        switch (fileFilter) {
          case 'pending-team-leader':
            return file.status === 'uploaded'
          case 'pending-admin':
            return file.status === 'team_leader_approved'
          case 'approved':
            return file.status === 'final_approved'
          case 'rejected':
            return file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'
          default:
            return false
        }
      })
    }

    // Apply search (on already filtered data)
    if (fileSearchQuery && fileSearchQuery.trim() !== '') {
      const q = fileSearchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.original_name.toLowerCase().includes(q) ||
        file.username.toLowerCase().includes(q) ||
        file.user_team.toLowerCase().includes(q)
      )
    }

    // Sort only once at the end
    return [...filtered].sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc':
          return new Date(b.uploaded_at) - new Date(a.uploaded_at)
        case 'date-asc':
          return new Date(a.uploaded_at) - new Date(b.uploaded_at)
        case 'filename-asc':
          return a.original_name.localeCompare(b.original_name)
        case 'filename-desc':
          return b.original_name.localeCompare(a.original_name)
        case 'user-asc':
          return a.username.localeCompare(b.username)
        case 'user-desc':
          return b.username.localeCompare(a.username)
        default:
          return 0
      }
    })
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

  // Get current page files (only slice what we need)
  const currentPageFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * filesPerPage
    const endIndex = startIndex + filesPerPage
    return filteredFiles.slice(startIndex, endIndex)
  }, [filteredFiles, currentPage, filesPerPage])

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredFiles.length / filesPerPage)
  }, [filteredFiles.length, filesPerPage])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // Memoize formatted values for selected file (for modal)
  const selectedFileFormattedSize = useMemo(() => {
    return selectedFile ? formatFileSize(selectedFile.file_size) : ''
  }, [selectedFile, formatFileSize])

  const selectedFileFormattedDate = useMemo(() => {
    return selectedFile ? new Date(selectedFile.uploaded_at).toLocaleString() : ''
  }, [selectedFile])

  const fetchFiles = useCallback(async () => {
    // Cancel previous request if still pending
    if (fetchAbortController.current) {
      fetchAbortController.current.abort()
    }

    fetchAbortController.current = new AbortController()
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/files/all`, {
        signal: fetchAbortController.current.signal
      })
      const data = await response.json()
      
      if (data.success) {
        setFiles(data.files)
      } else {
        setError('Failed to fetch files')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching files:', error)
        setError('Failed to connect to server')
      }
    } finally {
      setIsLoading(false)
    }
  }, [setError])



  const mapFileStatus = useCallback((dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
      case 'team_leader_approved':
        return 'pending'
      case 'final_approved':
        return 'approved'
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'rejected'
      default:
        return 'pending'
    }
  }, [])

  const getStatusDisplayName = useCallback((dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
        return 'Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1)
    }
  }, [])

  const openDeleteModal = useCallback((file) => {
    setFileToDelete(file)
    setShowDeleteModal(true)
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
    if (!fileToDelete) return

    setIsLoading(true)
    try {
      // Delete physical file first (optional)
      await fetch(`${API_BASE}/files/${fileToDelete.id}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN'
        })
      }).catch(() => {}) // Ignore errors for physical file deletion

      // Delete database record
      const response = await fetch(`${API_BASE}/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Optimistic update - remove from state immediately
        setFiles(prevFiles => prevFiles.filter(file => file.id !== fileToDelete.id))
        setShowDeleteModal(false)
        setFileToDelete(null)
        setSuccess('File deleted successfully')
      } else {
        setError(data.message || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      setError(error.message || 'Failed to delete file')
    } finally {
      setIsLoading(false)
    }
  }, [fileToDelete, setError, setSuccess])



  // Function to open file using electron
  const openFile = useCallback(async (file) => {
    if (!file) return

    setIsOpeningFile(true)
    try {
      let filePath

      if (file.status === 'final_approved' && file.public_network_url) {
        // For approved files, use the moved location
        filePath = file.public_network_url
      } else {
        // For non-approved files, get the path from server
        const pathResp = await fetch(`${API_BASE}/files/${file.id}/path`)
        const pathData = await pathResp.json()
        if (!pathData.success) throw new Error('Failed to get file path')
        filePath = pathData.filePath
      }

      // Open the file using electron
      if (window.electron && typeof window.electron.openFileInApp === 'function') {
        const result = await window.electron.openFileInApp(filePath)
        if (!result.success) {
          throw new Error(result.error || 'Failed to open file')
        }
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
        if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
          setIsLoading(false)
          return
        }
        const selectedPath = result.filePaths[0]

        // Move file and delete from uploads folder
        const moveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/move-to-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationPath: selectedPath,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration',
            deleteFromUploads: true
          })
        })
        const moveData = await moveResp.json()
        if (!moveData.success) throw new Error(moveData.message || 'Failed to move file')

        // Approve file
        const approveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            comments: null,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const approveData = await approveResp.json()
        if (!approveData.success) throw new Error(approveData.message || 'Failed to approve file')
        approvedOnServer = true
      } else {
        throw new Error('File system access not available')
      }

      if (approvedOnServer) {
        // Optimistic update
        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === selectedFile.id ? { ...f, status: 'final_approved' } : f
          )
        )

        closeFileModal()
        setSuccess('File approved and moved successfully')

        // Refresh in background to get updated public_network_url
        fetchFiles()
      }
    } catch (err) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve file')
    } finally {
      setIsLoading(false)
    }
  }, [selectedFile, setError, setSuccess, closeFileModal, fetchFiles])

  const rejectFile = useCallback(async () => {
    if (!selectedFile) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          comments: null,
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })

      const data = await response.json()

      if (data.success) {
        // Delete the uploaded file from uploads folder
        await fetch(`${API_BASE}/files/${selectedFile.id}/delete-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN'
          })
        }).catch(() => {}) // Ignore errors for physical file deletion

        // Optimistic update
        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === selectedFile.id ? { ...f, status: 'rejected_by_admin' } : f
          )
        )

        closeFileModal()
        setSuccess('File rejected successfully')

        // Refresh in background
        fetchFiles()
      } else {
        setError(data.message || 'Failed to reject file')
      }
    } catch (error) {
      console.error('Error rejecting file:', error)
      setError('Failed to reject file')
    } finally {
      setIsLoading(false)
    }
  }, [selectedFile, setError, setSuccess, closeFileModal, fetchFiles])

  const renderPaginationNumbers = useMemo(() => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <button
            key={i}
            className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </button>
        )
      }
    } else {
      pageNumbers.push(
        <button
          key={1}
          className={`pagination-btn ${1 === currentPage ? 'active' : ''}`}
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
      )

      if (currentPage > 3) {
        pageNumbers.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>)
      }

      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)

      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(
            <button
              key={i}
              className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </button>
          )
        }
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>)
      }

      if (totalPages > 1) {
        pageNumbers.push(
          <button
            key={totalPages}
            className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`}
            onClick={() => setCurrentPage(totalPages)}
          >
            {totalPages}
          </button>
        )
      }
    }

    return pageNumbers
  }, [totalPages, currentPage])

  // Show skeleton loader when network is not available
  if (!networkAvailable) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className="file-approval-section">
      {/* Messages */}
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}
      
      {/* Status Cards */}
      <div className="file-status-cards" ref={statusCardsRef}>
        <StatusCard 
          icon="TL" 
          label="Pending Team Leader" 
          count={statusCounts.pendingTeamLeader}
          className="pending"
        />
        <StatusCard 
          icon="AD" 
          label="Pending Admin" 
          count={statusCounts.pendingAdmin}
          className="pending-admin"
        />
        <StatusCard 
          icon="AP" 
          label="Approved Files" 
          count={statusCounts.approved}
          className="approved"
        />
        <StatusCard 
          icon="RE" 
          label="Rejected Files" 
          count={statusCounts.rejected}
          className="rejected"
        />
      </div>
      
      {/* Filter and Search Controls */}
      <div className="file-controls">
        <div className="file-search">
          <input
            type="text"
            placeholder="Search files by name, user, or team..."
            value={fileSearchInput}
            onChange={(e) => setFileSearchInput(e.target.value)}
            className="search-input"
            ref={searchInputRef}
          />
          {fileSearchQuery && (
            <button 
              className="search-clear-btn"
              onClick={() => {
                setFileSearchInput('')
                setFileSearchQuery('')
              }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="file-filters">
          <select
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="form-select"
            ref={filterSelectRef}
          >
            <option value="all">All Files</option>
            <option value="pending-team-leader">Pending Team Leader</option>
            <option value="pending-admin">Pending Admin</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select
            value={fileSortBy}
            onChange={(e) => setFileSortBy(e.target.value)}
            className="form-select"
          >
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Filename A-Z</option>
            <option value="filename-desc">Filename Z-A</option>
            <option value="user-asc">User A-Z</option>
            <option value="user-desc">User Z-A</option>
          </select>
        </div>
      </div>
      
      {/* Files Table */}
      <div className="table-section">
        <div className="files-table-container">
          <table className="files-table">
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
              {isLoading ? (
                // Loading skeletons
                Array(filesPerPage).fill(0).map((_, i) => <FileRowSkeleton key={i} />)
              ) : currentPageFiles.length > 0 ? (
                // Actual file rows
                currentPageFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    formatFileSize={formatFileSize}
                    mapFileStatus={mapFileStatus}
                    getStatusDisplayName={getStatusDisplayName}
                    onOpenModal={openFileModal}
                    onDelete={openDeleteModal}
                  />
                ))
              ) : (
                // Empty state
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <h3>No files found</h3>
                      <p>No files match your current search and filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!isLoading && filteredFiles.length > 0 && (
          <div className="pagination-section">
            <div className="pagination-info">
              Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, filteredFiles.length)} of {filteredFiles.length} files
            </div>
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button 
                  className="pagination-btn" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {renderPaginationNumbers}
                <button 
                  className="pagination-btn" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Details Modal */}
      {showFileModal && selectedFile && (
        <div className="modal-overlay" onClick={closeFileModal}>
          <div className="modal file-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button onClick={closeFileModal} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {/* File Details Section */}
              <div className="file-details-section">
                <h4 className="section-title">File Details</h4>
                <div className="file-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">FILE NAME:</span>
                    <span className="detail-value">{selectedFile.original_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">FILE TYPE:</span>
                    <span className="detail-value">{selectedFile.file_type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">FILE SIZE:</span>
                    <span className="detail-value">{selectedFileFormattedSize}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">SUBMITTED BY:</span>
                    <span className="detail-value">{selectedFile.username}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TEAM:</span>
                    <span className="detail-value team-badge-inline">
                      {selectedFile.user_team}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">UPLOAD DATE:</span>
                    <span className="detail-value">{selectedFileFormattedDate}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">STATUS:</span>
                    <span className={`detail-value status-badge status-${mapFileStatus(selectedFile.status)}`}>
                      {getStatusDisplayName(selectedFile.status)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Description Section */}
              <div className="description-section">
                <h4 className="section-title">Description</h4>
                <p className="description-text">{selectedFile.description || 'No description provided'}</p>
              </div>

              {/* Actions Section */}
              <div className="actions-section">
                <div className="action-buttons-large">
                  <button
                    type="button"
                    onClick={approveFile}
                    className="btn btn-success-large"
                    disabled={isLoading || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={rejectFile}
                    className="btn btn-danger-large"
                    disabled={isLoading || selectedFile.status === 'final_approved' || selectedFile.status === 'rejected_by_team_leader' || selectedFile.status === 'rejected_by_admin'}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Reject
                  </button>
                  <button
                    onClick={() => openFile(selectedFile)}
                    className="btn btn-secondary-large"
                    disabled={isLoading || isOpeningFile}
                  >
                    {isOpeningFile ? (
                      <>
                        <LoadingSpinner size="small" color="#6B7280" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Open
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal && fileToDelete}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deleteFile}
        title="Deleting File"
        message="Are you sure you want to delete this file?"
        confirmText="Delete File"
        variant="danger"
        isLoading={isLoading}
      >
        {fileToDelete && (
          <>
            <p className="confirmation-description">
              <strong>{fileToDelete.original_name || fileToDelete.filename}</strong>
              <br />
              Submitted by <strong>{fileToDelete.username}</strong> from <strong>{fileToDelete.user_team}</strong> team
            </p>
            <p className="confirmation-description" style={{ marginTop: '0.5rem' }}>
              This action cannot be undone. The file and all its associated data will be permanently removed.
            </p>
          </>
        )}
      </ConfirmationModal>
    </div>
  )
}

// Error Boundary
class FileApprovalErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  componentDidCatch(error, errorInfo) {
    console.error('FileApproval render error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="file-approval-section error-boundary">
          <h2>Something went wrong rendering File Approval</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
            {this.state.error && this.state.error.toString()}
            {this.state.errorInfo && '\n' + (this.state.errorInfo.componentStack || '')}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

const WrappedFileApproval = (props) => (
  <FileApprovalErrorBoundary>
    <FileApproval {...props} />
  </FileApprovalErrorBoundary>
)

export default WrappedFileApproval

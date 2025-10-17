import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import FileIcon from './FileIcon'
import './FileApproval.css'
import { ConfirmationModal, AlertMessage } from './modals'

const API_BASE = 'http://localhost:3001/api'
const SERVER_BASE = API_BASE.replace(/\/api$/, '')

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const [files, setFiles] = useState([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSearchInput, setFileSearchInput] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(7)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileComment, setFileComment] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fileComments, setFileComments] = useState([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const statusCardsRef = useRef(null)
  const searchInputRef = useRef(null)
  const filterSelectRef = useRef(null)

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(t)
  }, [fileSearchInput])

  const filteredFiles = useMemo(() => {
    let filtered = files

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

    if (fileSearchQuery && fileSearchQuery.trim() !== '') {
      const q = fileSearchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.original_name.toLowerCase().includes(q) ||
        file.username.toLowerCase().includes(q) ||
        file.user_team.toLowerCase().includes(q)
      )
    }

    filtered = [...filtered].sort((a, b) => {
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

    return filtered
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

  useEffect(() => setCurrentPage(1), [fileSearchQuery, fileFilter, fileSortBy])

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/files/all')
      const data = await response.json()
      if (data.success) {
        setFiles(data.files)
      } else {
        setError('Failed to fetch files')
      }
    } catch (error) {
      console.error('Error fetching files:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const mapFileStatus = (dbStatus) => {
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
  }

  const getStatusDisplayName = (dbStatus) => {
    switch (dbStatus) {
      case 'uploaded':
        return 'Pending Team Leader'
      case 'team_leader_approved':
        return 'Pending Admin'
      case 'final_approved':
        return 'Final Approved'
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader'
      case 'rejected_by_admin':
        return 'Rejected by Admin'
      default:
        return dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const deleteFile = async () => {
    if (!fileToDelete) return

    setIsLoading(true)
    try {
      const delFileResp = await fetch(`${API_BASE}/files/${fileToDelete.id}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN'
        })
      })
      let delFileData = {}
      try {
        delFileData = await delFileResp.json()
      } catch (e) {
        delFileData = {}
      }

      if (!delFileResp.ok || delFileData.success === false) {
        console.warn('Physical file deletion failed or not available:', delFileData.message || delFileResp.status)
      }

      const response = await fetch(`${API_BASE}/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })

      const data = await response.json()
      if (data.success) {
        const updatedFiles = files.filter(file => file.id !== fileToDelete.id)
        setFiles(updatedFiles)
        setShowDeleteModal(false)
        setFileToDelete(null)
        setSuccess('File deleted successfully')
        await fetchFiles()
      } else {
        setError(data.message || 'Failed to delete file record')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      setError(error.message || 'Failed to delete file')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchFileComments = async (fileId) => {
    setIsLoadingComments(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileId}/comments`)
      const data = await response.json()
      if (data.success) {
        setFileComments(data.comments || [])
      } else {
        setFileComments([])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setFileComments([])
    } finally {
      setIsLoadingComments(false)
    }
  }

  const openDeleteModal = useCallback((file) => {
    setFileToDelete(file)
    setShowDeleteModal(true)
  }, [])

  const openFileModal = useCallback(async (file) => {
    setSelectedFile({
      ...file,
      comments: []
    })
    setFileComment('')
    setShowFileModal(true)
    await fetchFileComments(file.id)
  }, [])

  const addComment = async () => {
    if (!selectedFile || !fileComment.trim()) return false
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: fileComment.trim(),
          userId: 1,
          username: 'admin',
          userRole: 'ADMIN'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setFileComment('')
        setSuccess('Comment added successfully')
        await fetchFileComments(selectedFile.id)
        return true
      } else {
        setError(data.message || 'Failed to add comment')
        return false
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      setError('Failed to add comment')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleCommentKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addComment()
    }
  }

  const deletePhysicalFileIfExists = async (fileId) => {
    try {
      const resp = await fetch(`${API_BASE}/files/${fileId}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: 1, adminUsername: 'admin', adminRole: 'ADMIN' })
      })
      const json = await resp.json().catch(() => ({}))
      if (resp.ok && json.success !== false) return true
      console.warn('deletePhysicalFileIfExists: server responded non-success', json)
      return false
    } catch (e) {
      console.warn('deletePhysicalFileIfExists error', e)
      return false
    }
  }

  const approveFile = async () => {
    if (!selectedFile) return

    const commentToSend = fileComment.trim()

    if (commentToSend) {
      await addComment()
    }

    setIsLoading(true)
    try {
      let approvedOnServer = false
      let movedViaServer = false

      if (window.electron && typeof window.electron.openDirectoryDialog === 'function') {
        const options = {}
        try {
          if (typeof window.electron.getNetworkProjectsPath === 'function') {
            const dp = await window.electron.getNetworkProjectsPath()
            if (dp) options.defaultPath = dp
          } else if (typeof window.electron.getDefaultProjectPickerPath === 'function') {
            const dp = await window.electron.getDefaultProjectPickerPath()
            if (dp) options.defaultPath = dp
          } else if (typeof window.electron.getNetworkDataPath === 'function') {
            const dp = await window.electron.getNetworkDataPath()
            if (dp) options.defaultPath = dp
          }
        } catch (err) {
          console.warn('Could not get default project picker path from electron API', err)
        }

        const result = await window.electron.openDirectoryDialog(options)
        if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
          setIsLoading(false)
          return
        }
        const selectedPath = result.filePaths[0]

        const moveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/move-to-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationPath: selectedPath,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const moveData = await moveResp.json()
        if (!moveData.success) {
          throw new Error(moveData.message || 'Failed to move file')
        }
        movedViaServer = true

        const approveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            comments: commentToSend || null,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const approveData = await approveResp.json()
        if (!approveData.success) throw new Error(approveData.message || 'Failed to approve file')
        approvedOnServer = true
      } else if (window.showDirectoryPicker) {

        const dirHandle = await window.showDirectoryPicker()
        if (!dirHandle) {
          setIsLoading(false)
          return
        }


        const fileResp = await fetch(`${SERVER_BASE}${selectedFile.file_path}`)
        if (!fileResp.ok) throw new Error('Failed to download file from server')
        const blob = await fileResp.blob()

        const fileHandle = await dirHandle.getFileHandle(selectedFile.original_name, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()

        const approveResp2 = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            comments: commentToSend || null,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const approveData2 = await approveResp2.json()
        if (!approveData2.success) throw new Error(approveData2.message || 'Failed to approve file')
        approvedOnServer = true

        await deletePhysicalFileIfExists(selectedFile.id)
      } else {
        const manualPath = window.prompt('Enter destination path on server (or Cancel):')
        if (!manualPath) {
          setIsLoading(false)
          return
        }

        const moveResp3 = await fetch(`${API_BASE}/files/${selectedFile.id}/move-to-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationPath: manualPath,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const moveData3 = await moveResp3.json()
        if (!moveData3.success) throw new Error(moveData3.message || 'Failed to move file')

        const approveResp3 = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            comments: commentToSend || null,
            adminId: 1,
            adminUsername: 'admin',
            adminRole: 'ADMIN',
            team: 'IT Administration'
          })
        })
        const approveData3 = await approveResp3.json()
        if (!approveData3.success) throw new Error(approveData3.message || 'Failed to approve file')
        approvedOnServer = true
        movedViaServer = true
      }

      if (approvedOnServer) {

        const updatedFiles = files.map(f => f.id === selectedFile.id ? { ...f, status: 'final_approved' } : f)
        setFiles(updatedFiles)
        setSelectedFile(prev => prev && prev.id === selectedFile.id ? { ...prev, status: 'final_approved' } : prev)

        try {
          await deletePhysicalFileIfExists(selectedFile.id)
        } catch (delErr) {
          console.warn('Failed to delete original upload after approval', delErr)
        }

        await fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setFileComments([])
        setSuccess('File approved and moved to projects successfully')
        return
      }

      throw new Error('Approval flow did not complete')
    } catch (err) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve and move file')
    } finally {
      setIsLoading(false)
    }
  }

  const rejectFile = async () => {
    if (!selectedFile) return
    
    if (!fileComment.trim()) {
      setError('Please provide a reason for rejection')
      return
    }
    
    await addComment()
    
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/files/${selectedFile.id}/admin-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reject',
          comments: fileComment.trim(),
          adminId: 1,
          adminUsername: 'admin',
          adminRole: 'ADMIN',
          team: 'IT Administration'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchFiles()
        setShowFileModal(false)
        setSelectedFile(null)
        setFileComment('')
        setFileComments([])
        setSuccess('File rejected successfully')
      } else {
        setError(data.message || 'Failed to reject file')
      }
    } catch (error) {
      console.error('Error rejecting file:', error)
      setError('Failed to reject file')
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentPageFiles = useCallback(() => {
    const startIndex = (currentPage - 1) * filesPerPage
    const endIndex = startIndex + filesPerPage
    return filteredFiles.slice(startIndex, endIndex)
  }, [currentPage, filesPerPage, filteredFiles])

  const getTotalPages = () => {
    return Math.ceil(filteredFiles.length / filesPerPage)
  }

  const renderPaginationNumbers = () => {
    const totalPages = getTotalPages()
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
        pageNumbers.push(
          <span key="ellipsis1" className="pagination-ellipsis">...</span>
        )
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
        pageNumbers.push(
          <span key="ellipsis2" className="pagination-ellipsis">...</span>
        )
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
  }

  return (
    <div className="file-approval-section">
      <div className="page-header">
        <h1>File Approval</h1>
        <p>Review and manage submitted files requiring approval</p>
      </div>
      
      {/* Messages */}
      {error && (
        <AlertMessage 
          type="error" 
          message={error} 
          onClose={clearMessages}
        />
      )}
      
      {success && (
        <AlertMessage 
          type="success" 
          message={success} 
          onClose={clearMessages}
        />
      )}
      
      {/* Status Cards */}
      <div className="file-status-cards" ref={statusCardsRef}>
        <div className="file-status-card pending">
          <div className="status-icon pending-icon">TL</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'uploaded').length}</div>
            <div className="status-label">Pending Team Leader</div>
          </div>
        </div>
        
        <div className="file-status-card pending-admin">
          <div className="status-icon pending-admin-icon">AD</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'team_leader_approved').length}</div>
            <div className="status-label">Pending Admin</div>
          </div>
        </div>
        
        <div className="file-status-card approved">
          <div className="status-icon approved-icon">AP</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'final_approved').length}</div>
            <div className="status-label">Approved Files</div>
          </div>
        </div>
        
        <div className="file-status-card rejected">
          <div className="status-icon rejected-icon">RE</div>
          <div className="status-info">
            <div className="status-number">{files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length}</div>
            <div className="status-label">Rejected Files</div>
          </div>
        </div>
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
              onClick={() => setFileSearchQuery('')}
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
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading files...</p>
          </div>
        ) : (
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
                {getCurrentPageFiles().map((file) => (
                  <tr 
                    key={file.id} 
                    className="file-row"
                    onClick={() => openFileModal(file)}
                  >
                    <td>
                      <div className="file-cell">
                        <div className="file-icon">
                          <FileIcon
                            fileType={file.file_type} 
                            isFolder={false}
                            altText={`Icon for ${file.original_name}`}
                            className="" 
                          />
                        </div>
                        <div className="file-details">
                          <span className="file-name">{file.original_name}</span>
                          <span className="file-size">{formatFileSize(file.file_size)}</span>
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
                        <div className="date">{new Date(file.uploaded_at).toLocaleDateString()}</div>
                        <div className="time">{new Date(file.uploaded_at).toLocaleTimeString()}</div>
                      </div>
                    </td>
                    <td>
                      <span className="team-badge">
                        {file.user_team}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${mapFileStatus(file.status)}`}>
                        {getStatusDisplayName(file.status)}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteModal(file)
                        }}
                        title="Delete File"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!isLoading && filteredFiles.length === 0 && (
          <div className="empty-state">
            <h3>No files found</h3>
            <p>No files match your current search and filter criteria.</p>
          </div>
        )}
        
        {/* Pagination */}
        {!isLoading && filteredFiles.length > 0 && (
          <div className="pagination-section">
            <div className="pagination-info">
              Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, filteredFiles.length)} of {filteredFiles.length} files
            </div>
            {getTotalPages() > 1 && (
              <div className="pagination-controls">
                <button 
                  className="pagination-btn" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {renderPaginationNumbers()}
                <button 
                  className="pagination-btn" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, getTotalPages()))}
                  disabled={currentPage === getTotalPages()}
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
        <div className="modal-overlay">
          <div className="modal file-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button onClick={() => setShowFileModal(false)} className="modal-close">×</button>
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
                    <span className="detail-value">{formatFileSize(selectedFile.file_size)}</span>
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
                    <span className="detail-value">{new Date(selectedFile.uploaded_at).toLocaleString()}</span>
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
              
              {/* Comments Section */}
              <div className="comments-section">
                <h4 className="section-title">Comments & History</h4>
                {isLoadingComments ? (
                  <div className="loading-comments">
                    <div className="spinner-small"></div>
                    <span>Loading comments...</span>
                  </div>
                ) : fileComments && fileComments.length > 0 ? (
                  <div className="comments-list">
                    {fileComments.map((comment, index) => (
                      <div key={index} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.reviewer_username || comment.username}</span>
                          <span className="comment-role">{comment.reviewer_role || comment.role || 'USER'}</span>
                          <span className="comment-date">
                            {new Date(comment.reviewed_at || comment.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="comment-body">
                          {comment.action && (
                            <span className={`comment-action ${comment.action.toLowerCase()}`}>
                              {comment.action.toUpperCase()}
                            </span>
                          )}
                          {comment.comments && <p className="comment-text">{comment.comments}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-comments">No comments yet</div>
                )}
              </div>
              
              {/* Add Comment Section */}
              <div className="add-comment-section">
                <h4 className="section-title">Add Comment</h4>
                <div className="comment-input-container">
                  <textarea
                    value={fileComment}
                    onChange={(e) => setFileComment(e.target.value)}
                    onKeyPress={handleCommentKeyPress}
                    placeholder="Add a comment for the user..."
                    className="comment-textarea"
                    rows="3"
                  />
                  <button
                    className="btn btn-primary comment-btn"
                    onClick={addComment}
                    disabled={isLoading || !fileComment.trim()}
                  >
                    {isLoading ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
                <p className="help-text">This comment will be sent to the user. Press Enter to submit or Shift+Enter for new line.</p>
              </div>
              
              {/* Actions Section - Moved to Last */}
              <div className="actions-section">
                <div className="action-buttons-large">
                  <button 
                    type="button" 
                    onClick={approveFile}
                    className="btn btn-success-large" 
                    disabled={isLoading}
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
                    disabled={isLoading}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Reject
                  </button>
                  <a 
                    href={`http://localhost:3001${selectedFile.file_path}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary-large"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 10.8333V15.8333C15 16.2754 14.8244 16.6993 14.5118 17.0118C14.1993 17.3244 13.7754 17.5 13.3333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V6.66667C2.5 6.22464 2.67559 5.80072 2.98816 5.48816C3.30072 5.17559 3.72464 5 4.16667 5H9.16667M12.5 2.5H17.5M17.5 2.5V7.5M17.5 2.5L8.33333 11.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Open
                  </a>
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
        title="Delete File"
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
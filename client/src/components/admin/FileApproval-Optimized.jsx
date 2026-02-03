import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileApproval-Optimized.css'
import { ConfirmationModal, AlertMessage, FileDetailsModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'
import { useAdminFiles } from '../../hooks/admin/useAdminFiles'
import FileRow from './FileRow'
import { formatFileSize, mapFileStatus, getStatusDisplayName } from '../../utils/adminUtils'

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

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  const {
    files,
    isLoading,
    isOpeningFile,
    fetchFiles,
    deleteFile,
    openFile,
    approveFile,
    rejectFile
  } = useAdminFiles(authUser, { setError, setSuccess, clearMessages })

  // UI State
  const [fileSearchInput, setFileSearchInput] = useState('')
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileFilter, setFileFilter] = useState('all')
  const [fileSortBy, setFileSortBy] = useState('date-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(7)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [fileToReject, setFileToReject] = useState(null)

  // Refs
  const searchInputRef = useRef(null)

  // Initial fetch
  useEffect(() => {
    if (isConnected) fetchFiles()
  }, [isConnected, fetchFiles])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(timer)
  }, [fileSearchInput])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [fileSearchQuery, fileFilter, fileSortBy])

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    pendingTeamLeader: files.filter(f => f.status === 'uploaded').length,
    pendingAdmin: files.filter(f => f.status === 'team_leader_approved').length,
    approved: files.filter(f => f.status === 'final_approved').length,
    rejected: files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
  }), [files])

  // Filtering and sorting logic
  const filteredFiles = useMemo(() => {
    let filtered = [...files]

    if (fileFilter !== 'all') {
      filtered = filtered.filter(file => {
        if (fileFilter === 'pending-team-leader') return file.status === 'uploaded'
        if (fileFilter === 'pending-admin') return file.status === 'team_leader_approved'
        if (fileFilter === 'approved') return file.status === 'final_approved'
        if (fileFilter === 'rejected') return file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin'
        return true
      })
    }

    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.original_name.toLowerCase().includes(q) ||
        (file.username || '').toLowerCase().includes(q) ||
        (file.user_team || '').toLowerCase().includes(q)
      )
    }

    return filtered.sort((a, b) => {
      switch (fileSortBy) {
        case 'date-desc': return new Date(b.uploaded_at) - new Date(a.uploaded_at)
        case 'date-asc': return new Date(a.uploaded_at) - new Date(b.uploaded_at)
        case 'filename-asc': return a.original_name.localeCompare(b.original_name)
        case 'filename-desc': return b.original_name.localeCompare(a.original_name)
        case 'user-asc': return (a.username || '').localeCompare(b.username || '')
        case 'user-desc': return (b.username || '').localeCompare(a.username || '')
        default: return 0
      }
    })
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

  const currentPageFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * filesPerPage
    return filteredFiles.slice(startIndex, startIndex + filesPerPage)
  }, [filteredFiles, currentPage, filesPerPage])

  const totalPages = Math.ceil(filteredFiles.length / filesPerPage)

  const openFileModal = useCallback((file) => {
    setSelectedFile(file)
    setShowFileModal(true)
  }, [])

  const closeFileModal = useCallback(() => {
    setShowFileModal(false)
    setSelectedFile(null)
  }, [])

  const handleDelete = useCallback(async () => {
    const success = await deleteFile(fileToDelete)
    if (success) setShowDeleteModal(false)
  }, [deleteFile, fileToDelete])

  const handleApprove = useCallback(async () => {
    const success = await approveFile(selectedFile)
    if (success) closeFileModal()
  }, [approveFile, selectedFile, closeFileModal])

  const handleReject = useCallback(async () => {
    const success = await rejectFile(fileToReject)
    if (success) {
      setShowRejectModal(false)
      closeFileModal()
    }
  }, [rejectFile, fileToReject, closeFileModal])

  const renderPaginationNumbers = useMemo(() => {
    const pageNumbers = []
    const maxVisiblePages = 5
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(<button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i}</button>)
      }
    } else {
      pageNumbers.push(<button key={1} className={`pagination-btn ${1 === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(1)}>1</button>)
      if (currentPage > 3) pageNumbers.push(<span key="e1" className="pagination-ellipsis">...</span>)
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(<button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i}</button>)
        }
      }
      if (currentPage < totalPages - 2) pageNumbers.push(<span key="e2" className="pagination-ellipsis">...</span>)
      pageNumbers.push(<button key={totalPages} className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>)
    }
    return pageNumbers
  }, [totalPages, currentPage])

  if (!isConnected) return <SkeletonLoader type="table" />

  return (
    <div className={`file-approval-section ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="file-status-cards">
        <StatusCard icon="TL" label="Pending Team Leader" count={statusCounts.pendingTeamLeader} className="pending" />
        <StatusCard icon="AD" label="Pending Admin" count={statusCounts.pendingAdmin} className="pending-admin" />
        <StatusCard icon="AP" label="Approved Files" count={statusCounts.approved} className="approved" />
        <StatusCard icon="RE" label="Rejected Files" count={statusCounts.rejected} className="rejected" />
      </div>

      <div className="file-controls">
        <div className="file-search">
          <input
            type="text"
            placeholder="Search files by name..."
            value={fileSearchInput}
            onChange={(e) => setFileSearchInput(e.target.value)}
            className="search-input"
            ref={searchInputRef}
          />
          {fileSearchQuery && <button className="search-clear-btn" onClick={() => { setFileSearchInput(''); setFileSearchQuery('') }}>×</button>}
        </div>

        <div className="file-filters">
          <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} className="form-select">
            <option value="all">All Files</option>
            <option value="pending-team-leader">Pending Team Leader</option>
            <option value="pending-admin">On Admin Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={fileSortBy} onChange={(e) => setFileSortBy(e.target.value)} className="form-select">
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Filename A-Z</option>
          </select>
        </div>
      </div>

      <div className="table-section">
        <div className="files-table-container">
          <table className="files-table">
            <thead>
              <tr>
                <th>Filename</th><th>Submitted By</th><th>Date & Time</th><th>Team</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(filesPerPage).fill(0).map((_, i) => <FileRowSkeleton key={i} />)
              ) : currentPageFiles.length > 0 ? (
                currentPageFiles.map(file => (
                  <FileRow key={file.id} file={file} onOpenModal={openFileModal} onDelete={(f) => { setFileToDelete(f); setShowDeleteModal(true) }} />
                ))
              ) : (
                <tr><td colSpan="6"><div className="empty-state"><h3>No files found</h3><p>Try changing your search or filter.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredFiles.length > 0 && (
          <div className="pagination-section">
            <div className="pagination-info">Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, filteredFiles.length)} of {filteredFiles.length}</div>
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>‹</button>
                {renderPaginationNumbers}
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      <FileDetailsModal
        isOpen={showFileModal}
        onClose={closeFileModal}
        file={selectedFile}
        onApprove={handleApprove}
        onReject={f => { setFileToReject(f); setShowRejectModal(true) }}
        onOpenFile={() => openFile(selectedFile)}
        isLoading={isLoading}
        isOpeningFile={isOpeningFile}
        formatFileSize={formatFileSize}
        mapFileStatus={mapFileStatus}
        getStatusDisplayName={getStatusDisplayName}
      />

      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete File"
          message={`Are you sure you want to delete "${fileToDelete?.original_name}"?`}
          confirmText="Delete"
          variant="danger"
          isLoading={isLoading}
        />
      )}

      {showRejectModal && (
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleReject}
          title="Reject File"
          message={`Are you sure you want to reject "${fileToReject?.original_name}"?`}
          confirmText="Reject"
          variant="danger"
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

export default withErrorBoundary(memo(FileApproval), { componentName: 'File Approval' })

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import './FileApproval.css'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

// Sub-components
import ApprovalTable from './subcomponents/ApprovalTable'
import ApprovalFilters from './subcomponents/ApprovalFilters'
import ApprovalModals from './subcomponents/ApprovalModals'

const API_BASE = `${API_BASE_URL}/api`

const FileApproval = ({ clearMessages, error, success, setError, setSuccess }) => {
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

  // State management
  const [files, setFiles] = useState([])
  const [fileSearchInput, setFileSearchInput] = useState('')
  const [fileSearchQuery, setFileSearchQuery] = useState('')
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
  const [rejectComment, setRejectComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [folderToDelete, setFolderToDelete] = useState(null)
  const [folderReviewModal, setFolderReviewModal] = useState(null)
  const [folderReviewComment, setFolderReviewComment] = useState('')
  const [deleteAlert, setDeleteAlert] = useState(null)

  const fetchAbortController = useRef(null)

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => clearMessages(), 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  const fetchFiles = useCallback(async () => {
    fetchAbortController.current?.abort()
    fetchAbortController.current = new AbortController()
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/files/all`, { signal: fetchAbortController.current.signal })
      const data = await response.json()
      if (data.success) setFiles(data.files)
      else setError('Failed to fetch files')
    } catch (error) {
      if (error.name !== 'AbortError') setError('Failed to connect to server')
    } finally { setIsLoading(false) }
  }, [setError])

  useEffect(() => {
    if (isConnected) fetchFiles()
    return () => fetchAbortController.current?.abort()
  }, [isConnected, fetchFiles])

  useEffect(() => {
    const timer = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(timer)
  }, [fileSearchInput])

  useEffect(() => { setCurrentPage(1) }, [fileSearchQuery, fileFilter, fileSortBy, viewMode])

  const statusCounts = useMemo(() => ({
    pendingTeamLeader: files.filter(f => f.status === 'uploaded').length,
    pendingAdmin: files.filter(f => f.status === 'team_leader_approved').length,
    approved: files.filter(f => f.status === 'final_approved').length,
    rejected: files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
  }), [files])

  const groupFilesByFolder = useCallback((files) => {
    const folders = {}, individualFiles = []
    files.forEach(file => {
      if (file.folder_name?.trim()) {
        const key = `${file.folder_name}||${file.user_id || file.username || ''}`
        if (!folders[key]) folders[key] = []
        folders[key].push(file)
      } else individualFiles.push(file)
    })
    return { folders, individualFiles }
  }, [])

  const filteredFiles = useMemo(() => {
    let filtered = files
    if (fileFilter !== 'all') {
      filtered = filtered.filter(f => {
        if (fileFilter === 'pending-team-leader') return f.status === 'uploaded'
        if (fileFilter === 'pending-admin') return f.status === 'team_leader_approved'
        if (fileFilter === 'approved') return f.status === 'final_approved'
        if (fileFilter === 'rejected') return f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin'
        return false
      })
    }
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.toLowerCase()
      filtered = filtered.filter(f => f.original_name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q) || f.user_team.toLowerCase().includes(q) || (f.folder_name && f.folder_name.toLowerCase().includes(q)))
    }
    return [...filtered].sort((a, b) => {
      if (fileSortBy === 'date-desc') return new Date(b.uploaded_at) - new Date(a.uploaded_at)
      if (fileSortBy === 'date-asc') return new Date(a.uploaded_at) - new Date(b.uploaded_at)
      if (fileSortBy === 'filename-asc') return a.original_name.localeCompare(b.original_name)
      if (fileSortBy === 'filename-desc') return b.original_name.localeCompare(a.original_name)
      if (fileSortBy === 'user-asc') return a.username.localeCompare(b.username)
      if (fileSortBy === 'user-desc') return b.username.localeCompare(a.username)
      return 0
    })
  }, [files, fileSearchQuery, fileFilter, fileSortBy])

  const paginationItems = useMemo(() => {
    const groupedData = groupFilesByFolder(filteredFiles)
    const allItems = []
    
    if (viewMode === 'by-date') {
      Object.keys(groupedData.folders).forEach(k => {
        const name = k.split('||')[0], files = groupedData.folders[k]
        allItems.push({ type: 'folder', folderKey: k, name, files, _date: new Date(files[0].uploaded_at) })
      })
      groupedData.individualFiles.forEach(f => allItems.push({ type: 'file', file: f, _date: new Date(f.uploaded_at) }))
      allItems.sort((a, b) => b._date - a._date)
      
      const items = [], lastLabel = null
      allItems.forEach(item => {
        const label = new Date(item._date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        if (label !== lastLabel) { items.push({ type: 'date-header', label }); }
        items.push(item)
      })
      return items
    }

    if (viewMode !== 'files') {
      Object.keys(groupedData.folders).forEach(k => {
        const name = k.split('||')[0], files = groupedData.folders[k]
        allItems.push({ type: 'folder', folderKey: k, name, files, _date: Math.max(...files.map(f => new Date(f.uploaded_at).getTime())), _name: name, _user: files[0]?.username || '' })
      })
    }
    if (viewMode !== 'folders') {
      groupedData.individualFiles.forEach(f => allItems.push({ type: 'file', file: f, _date: new Date(f.uploaded_at).getTime(), _name: f.original_name, _user: f.username }))
    }
    
    return allItems.sort((a, b) => {
      if (fileSortBy === 'date-desc') return b._date - a._date
      if (fileSortBy === 'date-asc') return a._date - b._date
      if (fileSortBy === 'filename-asc') return a._name.localeCompare(b._name)
      if (fileSortBy === 'filename-desc') return b._name.localeCompare(a._name)
      return b._date - a._date
    })
  }, [filteredFiles, viewMode, fileSortBy, groupFilesByFolder])

  const currentPageItems = useMemo(() => paginationItems.slice((currentPage - 1) * filesPerPage, currentPage * filesPerPage), [paginationItems, currentPage, filesPerPage])
  const totalPages = Math.ceil(paginationItems.length / filesPerPage)

  const mapFileStatus = useCallback((s) => (s === 'uploaded' || s === 'team_leader_approved' ? 'pending' : s === 'final_approved' ? 'approved' : 'rejected'), [])
  const getStatusDisplayName = useCallback((s) => {
    if (s === 'uploaded') return 'Pending Team Leader'
    if (s === 'team_leader_approved') return 'Pending Admin'
    if (s === 'final_approved') return 'Approved'
    if (s.startsWith('rejected')) return 'Rejected'
    return s
  }, [])

  const handleOpenFile = async (filePath, fileId) => {
    try {
      setIsOpeningFile(true); setSuccess('Opening file...')
      if (window.electron?.openFileInApp) {
        const res = await fetch(`${API_BASE}/files/${fileId}/path`).then(r => r.json())
        if (!res.success) throw new Error(res.message)
        const result = await window.electron.openFileInApp(res.filePath)
        if (result.success) setSuccess('File opened successfully')
        else throw new Error(result.error)
      } else {
        const win = window.open(`${API_BASE_URL}${filePath}`, '_blank')
        if (!win) throw new Error('Pop-up blocked'); win.focus(); setSuccess('Opened in browser')
      }
    } catch (e) { setError(`Error: ${e.message}`) } finally { setIsOpeningFile(false) }
  }

  const deleteFile = async () => {
    setIsLoading(true)
    try {
      if (folderToDelete) {
        await fetch(`${API_BASE}/files/folder/delete-attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderName: folderToDelete.folderName, fileIds: folderToDelete.folderFiles.map(f => f.id), adminId: authUser.id, adminUsername: authUser.username })
        })
        setFiles(prev => prev.filter(f => !folderToDelete.folderFiles.some(ff => ff.id === f.id)))
        setDeleteAlert('Folder deleted'); setShowDeleteModal(false); setFolderToDelete(null)
      } else {
        await fetch(`${API_BASE}/files/${fileToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId: authUser.id, adminUsername: authUser.username })
        })
        setFiles(prev => prev.filter(f => f.id !== fileToDelete.id))
        setDeleteAlert('File deleted'); setShowDeleteModal(false); setFileToDelete(null)
      }
    } catch (e) { setError(e.message) } finally { setIsLoading(false) }
  }

  const onApproveFile = async (f) => {
    try {
      const res = await fetch(`${API_BASE}/files/${f.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'final_approved', adminId: authUser.id, adminUsername: authUser.username })
      }).then(r => r.json())
      if (res.success) { fetchFiles(); setSuccess('File approved'); setShowFileModal(false) }
      else setError(res.message)
    } catch (e) { setError(e.message) }
  }

  const confirmReject = async () => {
    try {
      const res = await fetch(`${API_BASE}/files/${selectedFile.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected_by_admin', comments: rejectComment, adminId: authUser.id, adminUsername: authUser.username })
      }).then(r => r.json())
      if (res.success) { fetchFiles(); setSuccess('File rejected'); setShowRejectModal(false); setShowFileModal(false) }
      else setError(res.message)
    } catch (e) { setError(e.message) }
  }

  const onApproveFolder = (name, files) => setFolderReviewModal({ folderName: name, folderFiles: files, action: 'approve' })
  const onRejectFolder = (name, files) => setFolderReviewModal({ folderName: name, folderFiles: files, action: 'reject' })
  
  const confirmFolderReview = async () => {
    const { folderFiles, action } = folderReviewModal
    const status = action === 'approve' ? 'final_approved' : 'rejected_by_admin'
    try {
      const results = await Promise.all(folderFiles.map(f => 
        fetch(`${API_BASE}/files/${f.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, comments: folderReviewComment, adminId: authUser.id, adminUsername: authUser.username })
        }).then(r => r.json())
      ))
      if (results.every(r => r.success)) { fetchFiles(); setSuccess(`Folder ${action}d`); setFolderReviewModal(null); setFolderReviewComment('') }
      else setError('Some files failed review')
    } catch (e) { setError(e.message) }
  }

  const onOpenFilePath = async (file) => {
    if (!window.electron?.showItemInFolder) return setError('Only available in desktop app')
    const res = await fetch(`${API_BASE}/files/${file.id}/path`).then(r => r.json())
    if (res.success) window.electron.showItemInFolder(res.filePath)
    else setError('Path not found')
  }

  return (
    <div className="file-approval-section">
      {/* Target screenshot has no large title or subtitle here, it starts with filters */}

      <ApprovalFilters
        fileSearchInput={fileSearchInput}
        setFileSearchInput={setFileSearchInput}
        fileFilter={fileFilter}
        setFileFilter={setFileFilter}
        fileSortBy={fileSortBy}
        setFileSortBy={setFileSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        statusCounts={statusCounts}
      />

      <div className="approval-content">
        {isLoading && files.length === 0 ? (
          <div className="table-loading"><div className="spinner"></div><p>Loading files...</p></div>
        ) : paginationItems.length === 0 ? (
          <div className="empty-state"><h3>No files found</h3><p>Try adjusting your search or filters.</p></div>
        ) : (
          <>
            <ApprovalTable
              currentPageItems={currentPageItems}
              expandedFolders={expandedFolders}
              toggleFolder={(k) => setExpandedFolders(prev => ({ ...prev, [k]: !prev[k] }))}
              openDeleteModal={(f) => { setFileToDelete(f); setFolderToDelete(null); setShowDeleteModal(true) }}
              openFolderDeleteModal={(n, fs) => { setFolderToDelete({ folderName: n, folderFiles: fs }); setFileToDelete(null); setShowDeleteModal(true) }}
              onApproveFolder={onApproveFolder}
              onRejectFolder={onRejectFolder}
              onOpenFilePath={onOpenFilePath}
              onOpenModal={(f) => { setSelectedFile(f); setShowFileModal(true) }}
              mapFileStatus={mapFileStatus}
              getStatusDisplayName={getStatusDisplayName}
            />
            <div className="pagination-footer">
              <div className="pagination-stats">
                Showing {(currentPage - 1) * filesPerPage + 1} to {Math.min(currentPage * filesPerPage, paginationItems.length)} of {paginationItems.length} items
              </div>
              <div className="pagination-controls-wrapper">
                <button className="pagination-arrow" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                <div className="pagination-numbers">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      className={`pagination-number-btn ${currentPage === i + 1 ? 'active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button className="pagination-arrow" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
              </div>
            </div>
          </>
        )}
      </div>

      <ApprovalModals
        showFileModal={showFileModal}
        closeFileModal={() => setShowFileModal(false)}
        selectedFile={selectedFile}
        isOpeningFile={isOpeningFile}
        handleOpenFile={handleOpenFile}
        onApproveFile={onApproveFile}
        onRejectFile={() => setShowRejectModal(true)}
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        deleteFile={deleteFile}
        fileToDelete={fileToDelete}
        folderToDelete={folderToDelete}
        isLoading={isLoading}
        showRejectModal={showRejectModal}
        closeRejectModal={() => setShowRejectModal(false)}
        confirmReject={confirmReject}
        rejectComment={rejectComment}
        setRejectComment={setRejectComment}
        folderReviewModal={folderReviewModal}
        setFolderReviewModal={setFolderReviewModal}
        confirmFolderReview={confirmFolderReview}
        folderReviewComment={folderReviewComment}
        setFolderReviewComment={setFolderReviewComment}
        error={error}
        success={success}
        deleteAlert={deleteAlert}
        clearMessages={clearMessages}
        setDeleteAlert={setDeleteAlert}
      />
    </div>
  )
}

export default withErrorBoundary(FileApproval, { componentName: 'File Approval' })

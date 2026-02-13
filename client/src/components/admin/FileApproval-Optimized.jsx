import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { API_BASE_URL } from '@/config/api'
import FileIcon from '../shared/FileIcon'
import { SkeletonLoader } from '../common/SkeletonLoader'
import './FileApproval-Optimized.css'
import { ConfirmationModal, AlertMessage, FileDetailsModal } from './modals'
import { useAuth, useNetwork } from '../../contexts'
import { withErrorBoundary } from '../common'

const API_BASE = `${API_BASE_URL}/api`
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

// Folder Row Component
const FolderRow = memo(({
  folderName,
  folderFiles,
  isExpanded,
  onToggle,
  onDelete,
  formatFileSize
}) => {
  const handleClick = useCallback(() => {
    onToggle(folderName)
  }, [folderName, onToggle])

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation()
    onDelete(folderName, folderFiles)
  }, [folderName, folderFiles, onDelete])

  const firstFile = folderFiles[0]
  const formattedDate = useMemo(() => new Date(firstFile.uploaded_at).toLocaleDateString(), [firstFile.uploaded_at])
  const formattedTime = useMemo(() => new Date(firstFile.uploaded_at).toLocaleTimeString(), [firstFile.uploaded_at])

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
          <div className="file-icon">
            <FileIcon
              fileType="folder"
              isFolder={true}
              altText={`Folder: ${folderName}`}
              size="medium"
            />
          </div>
          <div className="file-details">
            <span className="file-name">{folderName}</span>
            <span className="file-size">{folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="user-cell">
          <span className="user-name">{firstFile.username}</span>
        </div>
      </td>
      <td>
        <div className="datetime-cell">
          <div className="date">{formattedDate}</div>
          <div className="time">{formattedTime}</div>
        </div>
      </td>
      <td>
        <span className="team-badge">{firstFile.user_team}</span>
      </td>
      <td>
        <span style={{ color: '#9ca3af' }}>—</span>
      </td>
      <td>
        <button
          className="action-btn delete-btn"
          onClick={handleDeleteClick}
          title="Delete Folder"
        >
          Delete
        </button>
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
  isNested = false
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

  // Display name with path for nested files
  let displayName = file.original_name
  if (isNested && file.relative_path && file.folder_name) {
    const pathAfterFolder = file.relative_path.replace(`${file.folder_name}/`, '')
    displayName = pathAfterFolder
  }

  return (
    <tr 
      className="file-row" 
      onClick={handleRowClick}
      style={isNested ? { paddingLeft: '60px', backgroundColor: '#fafafa' } : {}}
    >
      <td>
        <div className="file-cell" style={isNested ? { paddingLeft: '40px' } : {}}>
          <div className="file-icon">
            <FileIcon
              fileType={fileExtension}
              isFolder={false}
              altText={`Icon for ${file.original_name}`}
              size="medium"
            />
          </div>
          <div className="file-details">
            <span className="file-name">{displayName}</span>
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
  const { user: authUser } = useAuth()
  const { isConnected } = useNetwork()

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
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [fileToReject, setFileToReject] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [folderToDelete, setFolderToDelete] = useState(null)

  // Refs
  const statusCardsRef = useRef(null)
  const searchInputRef = useRef(null)
  const filterSelectRef = useRef(null)
  const fetchAbortController = useRef(null)

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearMessages()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success, clearMessages])

  const fetchFiles = useCallback(async () => {
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

  useEffect(() => {
    if (isConnected) {
      fetchFiles()
    }
    return () => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort()
      }
    }
  }, [isConnected, fetchFiles])

  useEffect(() => {
    const timer = setTimeout(() => setFileSearchQuery(fileSearchInput), 300)
    return () => clearTimeout(timer)
  }, [fileSearchInput])

  useEffect(() => {
    setCurrentPage(1)
  }, [fileSearchQuery, fileFilter, fileSortBy])

  // Group files by folder BEFORE filtering/sorting
  const groupFilesByFolder = useCallback((files) => {
    const folders = {}
    const individualFiles = []

    files.forEach(file => {
      // Only group if folder_name exists and is not empty
      if (file.folder_name && file.folder_name.trim() !== '') {
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = []
        }
        folders[file.folder_name].push(file)
      } else {
        individualFiles.push(file)
      }
    })

    return { folders, individualFiles }
  }, [])

  const statusCounts = useMemo(() => {
    return {
      pendingTeamLeader: files.filter(f => f.status === 'uploaded').length,
      pendingAdmin: files.filter(f => f.status === 'team_leader_approved').length,
      approved: files.filter(f => f.status === 'final_approved').length,
      rejected: files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
    }
  }, [files])

  // Filter and sort files
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
        file.user_team.toLowerCase().includes(q) ||
        (file.folder_name && file.folder_name.toLowerCase().includes(q))
      )
    }

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

  // Group filtered files into folders and individual files
  const groupedData = useMemo(() => {
    return groupFilesByFolder(filteredFiles)
  }, [filteredFiles, groupFilesByFolder])

  // Create items array for pagination (folders + individual files)
  const paginationItems = useMemo(() => {
    const items = []
    
    // Add folders as single items
    Object.keys(groupedData.folders).forEach(folderName => {
      items.push({
        type: 'folder',
        name: folderName,
        files: groupedData.folders[folderName]
      })
    })
    
    // Add individual files
    groupedData.individualFiles.forEach(file => {
      items.push({
        type: 'file',
        file: file
      })
    })
    
    return items
  }, [groupedData])

  // Paginate items
  const currentPageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * filesPerPage
    const endIndex = startIndex + filesPerPage
    return paginationItems.slice(startIndex, endIndex)
  }, [paginationItems, currentPage, filesPerPage])

  const totalPages = useMemo(() => {
    return Math.ceil(paginationItems.length / filesPerPage)
  }, [paginationItems.length, filesPerPage])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const selectedFileFormattedSize = useMemo(() => {
    return selectedFile ? formatFileSize(selectedFile.file_size) : ''
  }, [selectedFile, formatFileSize])

  const selectedFileFormattedDate = useMemo(() => {
    return selectedFile ? new Date(selectedFile.uploaded_at).toLocaleString() : ''
  }, [selectedFile])

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
        const deletePromises = folderToDelete.folderFiles.map(file =>
          fetch(`${API_BASE}/files/${file.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminId: authUser.id,
              adminUsername: authUser.username,
              adminRole: authUser.role,
              team: authUser.team
            })
          }).then(res => res.json())
        )

        const results = await Promise.all(deletePromises)
        const allSuccess = results.every(r => r.success)

        if (allSuccess) {
          try {
            await fetch(`${API_BASE}/files/folder/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folderName: folderToDelete.folderName,
                username: folderToDelete.folderFiles[0].username,
                fileIds: folderToDelete.folderFiles.map(f => f.id),
                userId: authUser.id,
                userRole: authUser.role,
                team: authUser.team
              })
            })
          } catch (folderError) {
            console.warn('Error deleting folder directory:', folderError)
          }

          setFiles(prevFiles => 
            prevFiles.filter(file => !folderToDelete.folderFiles.some(f => f.id === file.id))
          )
          setShowDeleteModal(false)
          setFolderToDelete(null)
          setSuccess(`Folder "${folderToDelete.folderName}" with ${folderToDelete.folderFiles.length} file(s) deleted successfully`)
        } else {
          throw new Error('Failed to delete some files in the folder')
        }
      } else {
        try {
          await fetch(`${API_BASE}/files/${fileToDelete.id}/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminId: authUser.id,
              adminUsername: authUser.username,
              adminRole: authUser.role
            })
          })
        } catch (fileDeleteError) {
          console.warn('Physical file deletion failed:', fileDeleteError)
        }

        const response = await fetch(`${API_BASE}/files/${fileToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team
          })
        })

        const data = await response.json()

        if (data.success) {
          setFiles(prevFiles => prevFiles.filter(file => file.id !== fileToDelete.id))
          setShowDeleteModal(false)
          setFileToDelete(null)
          setSuccess('File deleted successfully')
        } else {
          setError(data.message || 'Failed to delete file')
        }
      }
    } catch (error) {
      console.error('Error deleting:', error)
      setError(error.message || 'Failed to delete')
    } finally {
      setIsLoading(false)
    }
  }, [fileToDelete, folderToDelete, authUser, setError, setSuccess])

  const openFile = useCallback(async (file) => {
    if (!file) return

    setIsOpeningFile(true)
    try {
      const pathResp = await fetch(`${API_BASE}/files/${file.id}/path`)
      const pathData = await pathResp.json()
      if (!pathData.success) throw new Error('Failed to get file path')

      const filePath = pathData.filePath

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

        const moveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/move-to-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationPath: selectedPath,
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team,
            deleteFromUploads: true
          })
        })
        const moveData = await moveResp.json()
        if (!moveData.success) throw new Error(moveData.message || 'Failed to move file')

        const approveResp = await fetch(`${API_BASE}/files/${selectedFile.id}/admin-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            comments: null,
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role,
            team: authUser.team
          })
        })
        const approveData = await approveResp.json()
        if (!approveData.success) throw new Error(approveData.message || 'Failed to approve file')
        approvedOnServer = true
      } else {
        throw new Error('File system access not available')
      }

      if (approvedOnServer) {
        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === selectedFile.id ? { ...f, status: 'final_approved' } : f
          )
        )

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

  const confirmRejectFile = useCallback(async () => {
    if (!fileToReject) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/files/${fileToReject.id}/admin-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          comments: null,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          team: authUser.team
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetch(`${API_BASE}/files/${fileToReject.id}/delete-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: authUser.id,
            adminUsername: authUser.username,
            adminRole: authUser.role
          })
        }).catch(() => { })

        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === fileToReject.id ? { ...f, status: 'rejected_by_admin' } : f
          )
        )

        closeFileModal()
        closeRejectModal()
        setSuccess('File rejected successfully')
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
  }, [fileToReject, authUser, setError, setSuccess, closeFileModal, closeRejectModal, fetchFiles])

  // Render file rows with proper folder grouping
  const renderFileRows = useMemo(() => {
    const rows = []

    currentPageItems.forEach(item => {
      if (item.type === 'folder') {
        const isExpanded = expandedFolders[item.name]
        
        rows.push(
          <FolderRow
            key={`folder-${item.name}`}
            folderName={item.name}
            folderFiles={item.files}
            isExpanded={isExpanded}
            onToggle={toggleFolder}
            onDelete={openFolderDeleteModal}
            formatFileSize={formatFileSize}
          />
        )

        if (isExpanded) {
          item.files.forEach(file => {
            rows.push(
              <FileRow
                key={file.id}
                file={file}
                formatFileSize={formatFileSize}
                mapFileStatus={mapFileStatus}
                getStatusDisplayName={getStatusDisplayName}
                onOpenModal={openFileModal}
                onDelete={openDeleteModal}
                isNested={true}
              />
            )
          })
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
            isNested={false}
          />
        )
      }
    })

    return rows
  }, [currentPageItems, expandedFolders, toggleFolder, openFolderDeleteModal, openDeleteModal, openFileModal, formatFileSize, mapFileStatus, getStatusDisplayName])

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

  if (!isConnected) {
    return <SkeletonLoader type="table" />
  }

  return (
    <div className={`file-approval-section ${isOpeningFile ? 'file-opening-cursor' : ''}`}>
      {error && <AlertMessage type="error" message={error} onClose={clearMessages} />}
      {success && <AlertMessage type="success" message={success} onClose={clearMessages} />}

      <div className="file-status-cards" ref={statusCardsRef}>
        <StatusCard icon="TL" label="Pending Team Leader" count={statusCounts.pendingTeamLeader} className="pending" />
        <StatusCard icon="AD" label="Pending Admin" count={statusCounts.pendingAdmin} className="pending-admin" />
        <StatusCard icon="AP" label="Approved Files" count={statusCounts.approved} className="approved" />
        <StatusCard icon="RE" label="Rejected Files" count={statusCounts.rejected} className="rejected" />
      </div>

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
              onClick={() => { setFileSearchInput(''); setFileSearchQuery('') }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="file-filters">
          <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} className="form-select" ref={filterSelectRef}>
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
                <th>Status</th>
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
                      <p>No files match your current search and filter criteria.</p>
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
                <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  ‹
                </button>
                {renderPaginationNumbers}
                <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                  ›
                </button>
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
        title={folderToDelete ? "Delete Folder" : "Delete File"}
        message={folderToDelete 
          ? `Are you sure you want to delete the folder "${folderToDelete.folderName}" with all ${folderToDelete.folderFiles.length} file(s)?`
          : "Are you sure you want to delete this file?"
        }
        confirmText={folderToDelete ? "Delete Folder" : "Delete File"}
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
            : "This action cannot be undone. The file and all its associated data will be permanently removed."
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
    </div>
  )
}

export default withErrorBoundary(FileApproval, {
  componentName: 'File Approval'
})

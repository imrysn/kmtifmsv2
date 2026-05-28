import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { apiFetch, API_BASE_URL } from '@/config/api'
import './css/AssignmentsTab.css'
import './modals/css/AssignmentDetailsModal.css'
import { CardSkeleton } from '../common/InlineSkeletonLoader'
import { ConfirmationModal, CommentsModal, FileIcon, FileOpenModal, FileViewersButton } from '../shared'
import { useSmartNavigation } from '../shared/SmartNavigation'
import '../shared/SmartNavigation/SmartNavigation.css'
import SuccessModal from '../user/SuccessModal'

import { recursiveGroupByPath } from '@utils/folderUtils'

const useDropdownPosition = (btnRef, menuRef, isOpen) => {
  const [pos, setPos] = useState({ top: 0, left: 0, up: false, ready: false })

  useEffect(() => {
    if (!isOpen || !btnRef.current) return
    const btn = btnRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight || 180
    const spaceBelow = window.innerHeight - btn.bottom
    const up = spaceBelow < menuHeight + 8
    setPos({
      top: up ? btn.top - menuHeight - 4 : btn.bottom + 4,
      left: Math.min(btn.right - 190, window.innerWidth - 200),
      up,
      ready: true
    })
  }, [isOpen])

  useEffect(() => { if (!isOpen) setPos(p => ({ ...p, ready: false })) }, [isOpen])

  return pos
}

const FolderPathErrorModal = ({ isOpen, onClose, message, storageLabel }) => {
  if (!isOpen) return null
  return ReactDOM.createPortal(
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: '380px', maxWidth: '95vw', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff', lineHeight: 1.2 }}>Folder No Longer Available</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>kmti-file-management</div>
          </div>
        </div>
        <div style={{ padding: '22px' }}>
          <div style={{ background: '#fff9f0', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{ margin: 0, fontSize: '14px', color: '#7c2d12', lineHeight: 1.5 }}>
              {message || 'Unable to open folder path. This task is already done — the reference folder has been deleted from the NAS.'}
            </p>
          </div>
          {storageLabel && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{storageLabel}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,88,12,0.35)' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const FolderActionDropdown = ({ assignment, folderName, folderFiles, handleDownloadFolder, setFolderReviewModal, setFolderReviewComment, setToast }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [folderErrorModal, setFolderErrorModal] = useState({ isOpen: false, message: '', storageLabel: '' })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const pos = useDropdownPosition(btnRef, menuRef, isOpen)
  const isReference = !setFolderReviewModal // reference folders have no review action

  useEffect(() => {
    if (!isOpen) return
    const handleClose = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClose)
    return () => document.removeEventListener('mousedown', handleClose)
  }, [isOpen])

  return (
    <>
      <button
        ref={btnRef}
        className="tl-assignment-menu-btn"
        style={{ fontSize: '13px', padding: '2px 6px', letterSpacing: '1px' }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
        title="More options"
      >
        •••
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={menuRef}
          className="tl-assignment-menu-dropdown" 
          style={{ 
            position: 'fixed', 
            top: pos.top, 
            left: pos.left, 
            visibility: pos.ready ? 'visible' : 'hidden',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'fit-content',
            zIndex: 99999, 
            whiteSpace: 'normal',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transformOrigin: pos.up ? 'bottom right' : 'top right',
            animation: 'dropdownFadeIn 0.15s ease-out',
            padding: '4px'
          }}
        >
          <button
            className="tl-assignment-menu-item"
            style={{ fontWeight: '600' }}
            onClick={async (e) => {
              e.stopPropagation()
              setIsOpen(false)
              if (!window.electron || !window.electron.openFolderInExplorer) {
                setFolderErrorModal({ isOpen: true, message: 'Open Folder Path is only available in the desktop app.', storageLabel: 'NAS Storage · Reference File' })
                return
              }
              const firstFile = folderFiles[0]
              const type = isReference ? 'attachment' : 'file'
              try {
                const data = await apiFetch(`/api/files/${firstFile.id}/path?type=${type}`)
                if (data.success && data.filePath) {
                  const result = await window.electron.openFolderInExplorer(data.filePath)
                  if (!result.success) {
                    setFolderErrorModal({ isOpen: true, message: 'Could not open folder: ' + (result.error || 'Unknown error'), storageLabel: 'NAS Storage · Reference File' })
                  } else {
                    if (setToast) setToast({ isOpen: true, title: 'Opening Folder', message: `Opening path for ${folderName}...`, type: 'success' });
                  }
                } else {
                  setFolderErrorModal({ isOpen: true, message: 'Unable to open folder path. This task is already done — the reference folder has been deleted from the NAS.', storageLabel: 'NAS Storage · Reference File' })
                }
              } catch (err) {
                setFolderErrorModal({ isOpen: true, message: 'Unable to open folder path. This task is already done — the reference folder has been deleted from the NAS.', storageLabel: 'NAS Storage · Reference File' })
              }
            }}
          >
            📂 Open Folder Path
          </button>
          <button
            className="tl-assignment-menu-item"
            style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={async (e) => {
              e.stopPropagation()
              setIsOpen(false)
              await handleDownloadFolder(folderFiles, folderName)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Folder
          </button>
          {!isReference && (
            <button
              className="tl-assignment-menu-item"
              style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                setFolderReviewComment('')
                setFolderReviewModal({ folderName, folderFiles, assignmentId: assignment.id })
              }}
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" fill="#16a34a" opacity="0.15"/>
                <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2Z" stroke="#16a34a" strokeWidth="1.5"/>
                <path d="M6.5 10L9 12.5L13.5 7.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ color: '#16a34a' }}>Approve</span>
              <span style={{ color: '#9ca3af' }}> / </span>
              <span style={{ color: '#dc2626' }}>Reject Folder</span>
            </button>
          )}
        </div>,
        document.body
      )}
      <FolderPathErrorModal
        isOpen={folderErrorModal.isOpen}
        onClose={() => setFolderErrorModal({ isOpen: false, message: '', storageLabel: '' })}
        message={folderErrorModal.message}
        storageLabel={folderErrorModal.storageLabel}
      />
    </>
  )
}

const FileActionDropdown = ({ assignment, submission, isReference, handleDownloadFile, setToast }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [fileErrorModal, setFileErrorModal] = useState({ isOpen: false, message: '', storageLabel: '' })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const pos = useDropdownPosition(btnRef, menuRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleClose = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClose)
    return () => document.removeEventListener('mousedown', handleClose)
  }, [isOpen])

  return (
    <>
      <button
        ref={btnRef}
        className="tl-assignment-menu-btn"
        style={{ fontSize: '13px', padding: '2px 6px', letterSpacing: '1px' }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
        title="More options"
      >
        •••
      </button>
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={menuRef}
          className="tl-assignment-menu-dropdown" 
          style={{ 
            position: 'fixed', 
            top: pos.top, 
            left: pos.left, 
            visibility: pos.ready ? 'visible' : 'hidden',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'fit-content',
            zIndex: 99999, 
            whiteSpace: 'normal',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transformOrigin: pos.up ? 'bottom right' : 'top right',
            animation: 'dropdownFadeIn 0.15s ease-out',
            padding: '4px'
          }}
        >
          <button
            className="tl-assignment-menu-item"
            style={{ fontWeight: '600' }}
            onClick={async (e) => {
              e.stopPropagation()
              setIsOpen(false)
              if (!window.electron || !window.electron.openFolderInExplorer) {
                setFileErrorModal({ isOpen: true, message: 'Open File Path is only available in the desktop app.', storageLabel: 'NAS Storage · File' })
                return
              }
              const type = isReference ? 'attachment' : 'file'
              try {
                const data = await apiFetch(`/api/files/${submission.id}/path?type=${type}`)
                if (data.success && data.filePath) {
                  const result = await window.electron.openFolderInExplorer(data.filePath)
                  if (!result.success) {
                    setFileErrorModal({ isOpen: true, message: 'Could not open file path: ' + (result.error || 'Unknown error'), storageLabel: 'NAS Storage · File' })
                  } else {
                    if (setToast) setToast({ isOpen: true, title: 'Opening File Path', message: `Opening path for ${submission.original_name || submission.file_name}...`, type: 'success' });
                  }
                } else {
                  setFileErrorModal({ isOpen: true, message: 'Unable to open file path.', storageLabel: 'NAS Storage · File' })
                }
              } catch (err) {
                setFileErrorModal({ isOpen: true, message: 'Unable to open file path.', storageLabel: 'NAS Storage · File' })
              }
            }}
          >
            📁 Open File Path
          </button>
          <button
            className="tl-assignment-menu-item"
            style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={async (e) => {
              e.stopPropagation()
              setIsOpen(false)
              await (isReference ? handleDownloadFile(submission.id, submission.original_name, true) : handleDownloadFile(submission.id, submission.original_name || submission.file_name))
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download File
          </button>
        </div>,
        document.body
      )}
      <FolderPathErrorModal
        isOpen={fileErrorModal.isOpen}
        onClose={() => setFileErrorModal({ isOpen: false, message: '', storageLabel: '' })}
        message={fileErrorModal.message}
        storageLabel={fileErrorModal.storageLabel}
      />
    </>
  )
}

const AssignmentsTab = ({
  isLoadingAssignments,
  assignments,
  formatDate,
  deleteAssignment,
  setShowCreateAssignmentModal,
  openReviewModal,
  user,
  notificationCommentContext,
  onClearNotificationContext,
  highlightedAssignmentId,
  onClearHighlight,
  highlightedFileId,
  highlightedFileStatus,
  onClearFileHighlight,
  markAssignmentAsDone,
  handleEditAssignment,
  onRefreshAssignments,
  teamMembers
}) => {
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])

  // Shared modal state - simplified to work like admin/user
  const [searchQuery, setSearchQuery] = useState('')
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [visibleReplies, setVisibleReplies] = useState({})

  const [showMenuForAssignment, setShowMenuForAssignment] = useState(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState(null)
  const [expandedAttachments, setExpandedAttachments] = useState({})
  const [expandedSubmissions, setExpandedSubmissions] = useState({})
  const [commentCounts, setCommentCounts] = useState({}) // Track comment counts per assignment
  const [showOpenFileConfirmation, setShowOpenFileConfirmation] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [openedFileIds, setOpenedFileIds] = useState(new Set())
  const [openedFilesStorageReady, setOpenedFilesStorageReady] = useState(false)
  // Map of fileId -> viewer count for instant update
  const [viewerCounts, setViewerCounts] = useState({})
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [isPostingReply, setIsPostingReply] = useState(false)

  // Warm up the server's path cache when a folder is expanded
  const prefetchFolderFiles = (files, type = 'file') => {
    if (!files || files.length === 0) return
    
    // Use bulk prefetch to resolve all paths in one parallel request
    const fileIds = files.map(f => f.id).filter(Boolean);
    if (fileIds.length === 0) return;

    apiFetch('/api/files/bulk-path', {
      method: 'POST',
      body: JSON.stringify({ fileIds, type })
    }).catch(() => {}); // Ignore prefetch errors
  }

  // openedFileIds is scoped per-assignment: key = `${assignmentId}:${fileId}`
  // This prevents a file viewed in task A from showing as Viewed in task B.
  const makeViewedKey = (assignmentId, fileId) => `${assignmentId}:${fileId}`
  const isFileViewed = (assignmentId, fileId) => openedFileIds.has(makeViewedKey(assignmentId, fileId))
  const markFileViewed = (assignmentId, fileId) => {
    setOpenedFileIds(prev => new Set([...prev, makeViewedKey(assignmentId, fileId)]))
  }

  // Load from persistent storage on mount
  useEffect(() => {
    ;(async () => {
      try {
        let stored = null
        if (window.electron?.appStorage) {
          stored = await window.electron.appStorage.get('kmti_opened_files_tl_v2')
        }
        if (!stored) stored = localStorage.getItem('kmti_opened_files_tl_v2')
        if (stored) {
          const parsed = JSON.parse(stored)
          // Only load keys in the new "assignmentId:fileId" scoped format.
          // Old bare numeric IDs from the previous format are discarded so
          // re-uploaded files in new tasks never inherit a stale Viewed badge.
          const scoped = parsed.filter(k => String(k).includes(':'))
          setOpenedFileIds(new Set(scoped))
        }
      } catch {}
      setOpenedFilesStorageReady(true)
    })()
  }, [])

  // Save to persistent storage whenever it changes (only after initial load)
  useEffect(() => {
    if (!openedFilesStorageReady) return
    const data = JSON.stringify([...openedFileIds])
    if (window.electron?.appStorage) {
      window.electron.appStorage.set('kmti_opened_files_tl_v2', data)
    }
    try { localStorage.setItem('kmti_opened_files_tl_v2', data) } catch {}
  }, [openedFileIds, openedFilesStorageReady])
  const [expandedAssignmentFolders, setExpandedAssignmentFolders] = useState({}) // Track which folders are expanded in assignments
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null) // Track which folder's 3-dot menu is open
  const [folderReviewModal, setFolderReviewModal] = useState(null) // { folderName, folderFiles, assignmentId }
  const [folderReviewComment, setFolderReviewComment] = useState('')
  const [isFolderProcessing, setIsFolderProcessing] = useState(false)

  const [assignCheckerModal, setAssignCheckerModal] = useState(null) // { assignment }
  const [selectedCheckerIds, setSelectedCheckerIds] = useState(new Set())
  const [isAssigningChecker, setIsAssigningChecker] = useState(false)

  // Tab toggle: 'tasks' = active tasks, 'done' = completed tasks
  const [activeTaskTab, setActiveTaskTab] = useState('tasks')

  // Auto-switch to 'done' tab when navigating to a completed task (e.g. from File Collection "Go to Task")
  useEffect(() => {
    if (!highlightedAssignmentId || assignments.length === 0) return
    const target = assignments.find(a => a.id === highlightedAssignmentId || String(a.id) === String(highlightedAssignmentId))
    if (target && target.status === 'completed') {
      setActiveTaskTab('done')
    }
  }, [highlightedAssignmentId, assignments])

  // Loading state for Mark as Done
  const [markingDoneId, setMarkingDoneId] = useState(null)

  const handleMarkAsDone = async (assignmentId, title) => {
    setMarkingDoneId(assignmentId)
    try {
      await markAssignmentAsDone(assignmentId, title)
    } finally {
      setMarkingDoneId(null)
    }
  }

  // Remove attachment confirmation modal
  const [removeAttachmentModal, setRemoveAttachmentModal] = useState({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })

  // Download success toast
  const [downloadToast, setDownloadToast] = useState({ show: false, fileName: '' })

  const triggerDownloadToast = (fileName) => {
    setDownloadToast({ show: true, fileName })
    setTimeout(() => setDownloadToast({ show: false, fileName: '' }), 3500)
  }

  const recordView = async (fileId, isAttachment = false) => {
    if (!user || !fileId) return
    // Instantly bump the count in UI
    setViewerCounts(prev => ({ ...prev, [fileId]: (prev[fileId] ?? 0) + 1 }))
    try {
      await apiFetch(`/api/files/${fileId}/view?type=${isAttachment ? 'attachment' : 'submission'}`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role || 'TEAM_LEADER'
        })
      })
    } catch {}
  }

  const handleDownloadFile = async (fileId, fileName) => {
    const fileUrl = `${API_BASE_URL}/api/files/${fileId}/download`
    if (window.electron && window.electron.downloadFile) {
      const result = await window.electron.downloadFile(fileUrl, fileName)
      if (result && !result.success && !result.canceled) {
        alert('Download failed: ' + (result.error || 'Unknown error'))
      } else if (result && result.success) {
        triggerDownloadToast(fileName)
      }
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      triggerDownloadToast(fileName)
    }
  }

  const handleDownloadFolder = async (folderFiles, folderName) => {
    if (!window.electron || !window.electron.downloadFolder) {
      // Fallback for non-Electron (browser): use old zip approach
      const fileIds = folderFiles.map(f => f.id).join(',')
      const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = `${folderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    try {
      // Resolve physical paths for all files in one batched server call
      const fileIds = folderFiles.map(f => f.id).filter(Boolean)
      const data = await apiFetch('/api/files/bulk-path', {
        method: 'POST',
        body: JSON.stringify({ fileIds, type: 'file' })
      })

      const fileInfoList = (data.results || []).map((r, i) => {
        const file = folderFiles.find(f => f.id === r.id) || folderFiles[i] || {}
        return {
          srcPath: r.success ? r.path : null,
          name: file.original_name || r.originalName,
          relativePath: file.relative_path || null
        }
      })

      const result = await window.electron.downloadFolder(folderName, fileInfoList)
      if (result && result.success) {
        triggerDownloadToast(folderName)
      } else if (result && !result.success) {
        alert('Download failed: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Download failed: ' + err.message)
    }
  }


  // Remove entire folder via dedicated folder-delete endpoint
  const handleRemoveAttachmentFolder = async (assignmentId, folderFiles) => {
    setOpenFolderMenuId(null)
    if (!folderFiles || folderFiles.length === 0) return
    const folderName = folderFiles[0].folder_name
    try {
      const data = await apiFetch(
        `/api/assignments/${assignmentId}/attachments/folder/${encodeURIComponent(folderName)}`,
        { method: 'DELETE' }
      )
      if (data.success) {
        setToast({ isOpen: true, title: 'Removed', message: 'Folder removed successfully', type: 'error' })
        if (onRefreshAssignments) onRefreshAssignments()
      } else {
        setToast({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove folder', type: 'error' })
      }
    } catch (err) {
      console.error('Error removing folder:', err)
      setToast({ isOpen: true, title: 'Error', message: 'Failed to remove folder', type: 'error' })
    }
  }

  // Toast notification
  const [toast, setToast] = useState({ isOpen: false, title: '', message: '', type: 'error' })

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuForAssignment && !event.target.closest('.tl-assignment-card-menu')) {
        setShowMenuForAssignment(null)
      }
      if (openFolderMenuId && !event.target.closest('.tl-folder-menu-wrapper')) {
        setOpenFolderMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenuForAssignment])

  // Seed comment counts from pre-loaded assignment data to avoid redundant API calls.
  // fetchCommentCount is still called after posting to keep counts fresh.
  useEffect(() => {
    const initial = {}
    assignments.forEach(assignment => {
      // Use server-provided comment_count if available, otherwise fetch
      if (assignment.comment_count !== undefined) {
        initial[assignment.id] = assignment.comment_count
      } else {
        fetchCommentCount(assignment.id)
      }
    })
    setCommentCounts(prev => ({ ...prev, ...initial }))
  }, [assignments])

  const fetchCommentCount = async (assignmentId) => {
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)

      if (data.success) {
        // Count only top-level comments (not replies) to match Admin/User
        const totalComments = (data.comments || []).length
        setCommentCounts(prev => ({
          ...prev,
          [assignmentId]: totalComments
        }))
      }
    } catch (error) {
      console.error('Error fetching comment count:', error)
    }
  }

  const fetchComments = async (assignmentId) => {
    setLoadingComments(true)
    try {
      const data = await apiFetch(`/api/assignments/${assignmentId}/comments`)
      if (data.success) {
        setComments(data.comments || [])
      } else {
        setComments([])
      }
    } catch {
      setComments([])
    } finally {
      setLoadingComments(false)
    }
  }

  const postComment = async (e) => {
    e.preventDefault()
    const commentText = newComment.trim()
    if (!commentText || !selectedAssignment || isPostingComment) return

    setIsPostingComment(true)
    try {
      const data = await apiFetch(`/api/assignments/${selectedAssignment.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          comment: commentText
        })
      })

      if (data.success) {
        setNewComment('')
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id) // Update count after posting
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    } finally {
      setIsPostingComment(false)
    }
  }

  const postReply = async (e, commentId, replyTextArg, onSuccess) => {
    e.preventDefault()
    const replyTextValue = (replyTextArg ?? replyText).trim()
    if (!replyTextValue || !selectedAssignment || isPostingReply) return

    setIsPostingReply(true)
    try {
      const data = await apiFetch(`/api/assignments/${selectedAssignment.id}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username || user.fullName,
          reply: replyTextValue
        })
      })

      if (data.success) {
        setReplyText('')
        setReplyingTo(null)
        if (onSuccess) onSuccess()
        fetchComments(selectedAssignment.id)
        fetchCommentCount(selectedAssignment.id) // Update count after posting reply
      }
    } catch (error) {
      console.error('Error posting reply:', error)
    } finally {
      setIsPostingReply(false)
    }
  }

  const toggleRepliesVisibility = (commentId) => {
    setVisibleReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  const openCommentsModal = (assignment) => {
    setSelectedAssignment(assignment)
    setShowCommentsModal(true)
    fetchComments(assignment.id)
  }

  const closeCommentsModal = () => {
    setShowCommentsModal(false)
    setSelectedAssignment(null)
    setComments([])
    setNewComment('')
    setReplyingTo(null)
    setReplyText('')
    setVisibleReplies({})
  }

  const deleteComment = async (assignmentId, commentId) => {
    try {
      await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, { 
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const editComment = async (assignmentId, commentId, newText) => {
    try {
      await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          userId: user.id,
          comment: newText 
        })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error editing comment:', err)
    }
  }

  const deleteReply = async (assignmentId, commentId, replyId) => {
    try {
      await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, { 
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error deleting reply:', err)
    }
  }

  const editReply = async (assignmentId, commentId, replyId, newText) => {
    try {
      await apiFetch(`/api/assignments/${assignmentId}/comments/${commentId}/reply/${replyId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          userId: user.id,
          reply: newText 
        })
      })
      if (selectedAssignment) fetchComments(selectedAssignment.id)
    } catch (err) {
      console.error('Error editing reply:', err)
    }
  }

  // SMART NAVIGATION: Use shared hook for all highlighting and modal effects
  // IMPORTANT: Must be called AFTER openCommentsModal is defined
  useSmartNavigation({
    role: 'teamleader',
    items: assignments,
    highlightedItemId: highlightedAssignmentId,
    highlightedFileId,
    highlightedFileStatus,
    notificationContext: notificationCommentContext,
    onClearHighlight,
    onClearFileHighlight,
    onClearNotificationContext,
    openCommentsModal,
    setVisibleReplies,
    showCommentsModal,
    selectedItem: selectedAssignment,
    comments
  });

  // Track which highlightedFileId we've already processed so the effect
  // doesn't re-fire when `assignments` refreshes via SSE while the same
  // highlightedFileId is still set.
  const processedHighlightFileIdRef = React.useRef(null);
  // Reset the ref whenever highlightedFileId is cleared so the next
  // notification click for the same fileId works correctly.
  useEffect(() => {
    if (!highlightedFileId) processedHighlightFileIdRef.current = null;
  }, [highlightedFileId]);
  // Expand the submissions panel for the assignment containing highlightedFileId,
  // then highlight the folder row (WITHOUT opening it) and scroll it into view.
  useEffect(() => {
    if (!highlightedFileId || assignments.length === 0) return;
    // Already handled this fileId — don't re-run on assignments refresh
    if (processedHighlightFileIdRef.current === highlightedFileId) return;
    const fid = parseInt(highlightedFileId);
    for (const assignment of assignments) {
      const allFiles = assignment.recent_submissions || assignment.submitted_files || [];
      const targetFile = allFiles.find(f => f.id === fid);
      if (targetFile) {
        // Mark as processed BEFORE any async/timeout work
        processedHighlightFileIdRef.current = highlightedFileId;
        // 1. Expand the submissions section for this assignment (so the folder row is visible)
        setExpandedSubmissions(prev => prev[assignment.id] ? prev : { ...prev, [assignment.id]: true });
        // 2. If the file is inside a folder, highlight the folder row — do NOT open it.
        if (targetFile.folder_name) {
          const folderKey = `${assignment.id}__file__${targetFile.folder_name}`;
          // 3. Poll until the folder row is in the DOM (it appears once submissions section expands)
          let attempts = 0;
          const MAX = 30;
          const tryHighlightFolder = () => {
            const folderEl = document.querySelector(`[data-folder-key="${folderKey}"]`);
            if (!folderEl) {
              if (++attempts < MAX) setTimeout(tryHighlightFolder, 100);
              return;
            }
            folderEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            folderEl.classList.add('tl-assignment-folder-highlighted');
            setTimeout(() => folderEl.classList.remove('tl-assignment-folder-highlighted'), 3000);
          };
          setTimeout(tryHighlightFolder, 80);
        }
        break;
      }
    }
  }, [highlightedFileId, assignments]);

  const toggleAttachments = (assignmentId) => {
    setExpandedAttachments(prev => {
      const newState = !prev[assignmentId];
      if (newState) {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment && assignment.attachments) {
          prefetchFolderFiles(assignment.attachments, 'attachment');
        }
      }
      return { ...prev, [assignmentId]: newState };
    });
  }

  const toggleSubmissions = (assignmentId) => {
    setExpandedSubmissions(prev => {
      const newState = !prev[assignmentId];
      if (newState) {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment && assignment.recent_submissions) {
          prefetchFolderFiles(assignment.recent_submissions, 'file');
        }
      }
      return { ...prev, [assignmentId]: newState };
    });
  }

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`

    return formatDate(dateString)
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDaysLeft = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return '1 day left'
    } else {
      return `${diffDays} days left`
    }
  }

  const getStatusColor = (dueDate) => {
    if (!dueDate) return '#95a5a6'
    const date = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return '#e74c3c'
    if (diffDays <= 2) return '#f39c12'
    return '#27ae60'
  }

  const handleShowMembers = (members, e) => {
    e.stopPropagation()
    setSelectedMembers(members)
    setShowMembersModal(true)
  }

  const renderAssignedTo = (assignment) => {
    const assignedTo = assignment.assigned_to || assignment.assignedTo

    if (assignedTo === 'all') {
      return (
        <span className="tl-assignment-assigned-user">All team members</span>
      )
    }

    const members = assignment.assigned_member_details || []
    const memberCount = members.length

    if (memberCount === 0) {
      return <span className="tl-assignment-assigned-user">No members assigned</span>
    } else if (memberCount === 1) {
      return (
        <span className="tl-assignment-assigned-user">
          {members[0].fullName || members[0].username}
        </span>
      )
    } else if (memberCount <= 4) {
      const names = members.map(m => m.fullName || m.username).join(', ')
      return (
        <span className="tl-assignment-assigned-user">{names}</span>
      )
    } else {
      const displayedMembers = members.slice(0, 4)
      const remainingMembers = members.slice(4)
      const displayedNames = displayedMembers.map(m => m.fullName || m.username).join(', ')
      const remainingNames = remainingMembers.map(m => m.fullName || m.username).join(', ')

      return (
        <span className="tl-assignment-assigned-user">
          {displayedNames}
          <span className="tl-assignment-more-members" data-tooltip={remainingNames}>
            {' '}+{remainingMembers.length} more
          </span>
        </span>
      )
    }
  }

  const getInitials = (name) => {
    if (!name) return 'TL'
    if (name.includes('.')) {
      const parts = name.split('.')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
    }
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Helper function to group files by folder
  const groupFilesByFolder = useCallback((files) => {
    const folders = {}
    const individualFiles = []

    files.forEach(file => {
      if (file.folder_name) {
        // File is part of a folder
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = []
        }
        folders[file.folder_name].push(file)
      } else {
        // Individual file
        individualFiles.push(file)
      }
    })

    return { folders, individualFiles }
  }, [])

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (isLoadingAssignments) {
    return (
      <div className="tl-content">
        <div className="tl-assignments-feed">
          <div className="tl-page-header">
            <div>
              <h1>Tasks</h1>
              <p>Manage team tasks and submissions</p>
            </div>
            <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Create Task
            </button>
          </div>

          <div className="tl-assignments-feed-container">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tl-content">
      <div className="tl-assignments-feed">
        <div className="tl-page-header">
          <div>
            <h1>Tasks</h1>
            <p>Manage team tasks and submissions</p>
          </div>
          <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Create Task
          </button>
        </div>

        {/* Tasks / Done Tasks Toggle */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '18px', background: '#f3f4f6', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          <button
            onClick={() => setActiveTaskTab('tasks')}
            style={{
              padding: '7px 22px', borderRadius: '8px', border: 'none',
              fontWeight: '600', fontSize: '13.5px', cursor: 'pointer',
              transition: 'all 0.18s',
              background: activeTaskTab === 'tasks' ? '#fff' : 'transparent',
              color: activeTaskTab === 'tasks' ? '#111827' : '#6b7280',
              boxShadow: activeTaskTab === 'tasks' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            }}
          >
            📋 Tasks
            <span style={{
              marginLeft: '7px', fontSize: '12px', fontWeight: '700',
              background: activeTaskTab === 'tasks' ? '#e0e7ff' : '#e5e7eb',
              color: activeTaskTab === 'tasks' ? '#4338ca' : '#9ca3af',
              padding: '1px 8px', borderRadius: '10px'
            }}>
              {assignments.filter(a => a.status !== 'completed').length}
            </span>
          </button>
          <button
            onClick={() => setActiveTaskTab('done')}
            style={{
              padding: '7px 22px', borderRadius: '8px', border: 'none',
              fontWeight: '600', fontSize: '13.5px', cursor: 'pointer',
              transition: 'all 0.18s',
              background: activeTaskTab === 'done' ? '#fff' : 'transparent',
              color: activeTaskTab === 'done' ? '#111827' : '#6b7280',
              boxShadow: activeTaskTab === 'done' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            }}
          >
            ✅ Done Tasks
            <span style={{
              marginLeft: '7px', fontSize: '12px', fontWeight: '700',
              background: activeTaskTab === 'done' ? '#dcfce7' : '#e5e7eb',
              color: activeTaskTab === 'done' ? '#15803d' : '#9ca3af',
              padding: '1px 8px', borderRadius: '10px'
            }}>
              {assignments.filter(a => a.status === 'completed').length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ margin: '0 0 16px 0', position: 'relative', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#c4c9d4', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 28px 8px 28px',
              border: '1.5px solid #e8eaed', borderRadius: '8px',
              fontSize: '13.5px', color: '#374151',
              outline: 'none', background: '#fff',
              transition: 'border-color 0.15s',
              boxShadow: 'none'
            }}
            onFocus={e => e.target.style.borderColor = '#c4c9d4'}
            onBlur={e => e.target.style.borderColor = '#e8eaed'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#c4c9d4', fontSize: '15px', lineHeight: 1, padding: '1px' }}
            >×</button>
          )}
        </div>

        {(() => {
          const tabFiltered = assignments.filter(a =>
            activeTaskTab === 'done' ? a.status === 'completed' : a.status !== 'completed'
          )
          const filteredAssignments = searchQuery.trim()
            ? tabFiltered.filter(a => {
                const q = searchQuery.toLowerCase()
                return (
                  (a.title || '').toLowerCase().includes(q) ||
                  (a.description || '').toLowerCase().includes(q) ||
                  (a.team_leader_username || '').toLowerCase().includes(q) ||
                  (a.assigned_member_details || []).some(m =>
                    (m.fullName || '').toLowerCase().includes(q) ||
                    (m.username || '').toLowerCase().includes(q)
                  )
                )
              })
            : tabFiltered
          return filteredAssignments.length === 0 ? (
          <div className="tl-empty-state">
            <div className="tl-empty-state-icon">{activeTaskTab === 'done' ? '✅' : '📋'}</div>
            <h3>{searchQuery ? 'No Results Found' : activeTaskTab === 'done' ? 'No completed tasks yet' : 'No tasks yet'}</h3>
            <p>{searchQuery ? `No tasks match "${searchQuery}".` : activeTaskTab === 'done' ? 'Tasks marked as done will appear here.' : 'Create your first task to get started'}</p>
            {!searchQuery && activeTaskTab === 'tasks' && (
              <button className="tl-btn success" onClick={() => setShowCreateAssignmentModal(true)}>
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="tl-assignments-feed-container">
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                id={`tl-assignment-${assignment.id}`}
                className="tl-assignment-card"
              >
                <div className="tl-assignment-card-header">
                  <div className="tl-assignment-header-left">
                    <div className="tl-assignment-avatar">
                      {getInitials(assignment.team_leader_username || 'TL')}
                    </div>
                    <div className="tl-assignment-header-info">
                      <div className="tl-assignment-team-leader-info">
                        <span className="tl-assignment-team-leader-name" style={{ fontWeight: '700' }}>
                          {assignment.team_leader_fullname || assignment.team_leader_full_name || user.fullName || assignment.team_leader_username || 'KMTI Team Leader'}
                        </span>
                        <span className="tl-assignments-role-badge team-leader">TEAM LEADER</span>
                        <span className="tl-assignment-assigned-to-text"> assigned to</span>
                        <span className="tl-assignment-assigned-user-wrapper">
                          {renderAssignedTo(assignment)}
                        </span>
                      </div>
                      {(() => {
                        try {
                          const names = JSON.parse(assignment.checker_names || '[]')
                          if (!names.length) return null
                          return (
                            <div style={{ fontSize: '15px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: '#374151' }}>Check by:</span>
                              {names.map((name, i) => (
                                <span key={i} style={{ color: '#4f46e5', fontWeight: '700' }}>
                                  {name}{i < names.length - 1 ? ',' : ''}
                                </span>
                              ))}
                            </div>
                          )
                        } catch { return null }
                      })()}
                      <div className="tl-assignment-created">
                        📅 Assigned on: {formatDateTime(assignment.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="tl-assignment-header-right">
                    {assignment.status === 'completed' ? (
                      <div className="tl-assignment-status-badge completed">
                        ✓ Completed
                      </div>
                    ) : assignment.status === 'checked' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Checked
                        </div>
                        {(() => {
                          const checkerName = assignment.recent_submissions?.find(f => f.checked_by)?.checked_by;
                          if (!checkerName) return null;
                          return (
                            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                              Checked by : <span style={{ color: '#1D4ED8', fontWeight: '700' }}>{checkerName}</span>
                            </div>
                          );
                        })()} 
                      </div>
                    ) : assignment.recent_submissions?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ backgroundColor: 'transparent', color: '#C2410C', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', border: '1.5px solid #FDBA74' }}>
                          For Checking
                        </div>
                        {(assignment.due_date || assignment.dueDate) && (
                          <div className="tl-assignment-due-date" style={{ fontSize: '12px' }}>
                            Due {formatDate(assignment.due_date || assignment.dueDate)}
                            <span className="tl-assignment-days-left" style={{ color: getStatusColor(assignment.due_date || assignment.dueDate) }}>
                              {' '}({formatDaysLeft(assignment.due_date || assignment.dueDate)})
                            </span>
                          </div>
                        )}
                        {assignment.due_date_edited ? (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ✎ Due Date Edited
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      (assignment.due_date || assignment.dueDate) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div className="tl-assignment-due-date">
                            Due {formatDate(assignment.due_date || assignment.dueDate)}
                            <span
                              className="tl-assignment-days-left"
                              style={{ color: getStatusColor(assignment.due_date || assignment.dueDate) }}
                            >
                              {' '}({formatDaysLeft(assignment.due_date || assignment.dueDate)})
                            </span>
                          </div>
                          {assignment.due_date_edited ? (
                            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ✎ Due Date Edited
                            </span>
                          ) : null}
                        </div>
                      )
                    )}
                    </div>
                    <div className="tl-assignment-card-menu">
                      <button
                        className="tl-assignment-menu-btn"
                        onClick={() => setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)}
                        title="More options"
                      >
                        ⋮
                      </button>
                      {showMenuForAssignment === assignment.id && (
                        <div className="tl-assignment-menu-dropdown">
                          <button
                            className="tl-assignment-menu-item"
                            onClick={() => {
                              setAssignCheckerModal({ assignment })
                              const existingIds = (() => { try { return new Set((JSON.parse(assignment.checker_ids || '[]')).map(String)) } catch { return new Set() } })()
                              setSelectedCheckerIds(existingIds)
                              setShowMenuForAssignment(null)
                            }}
                          >
                            Assign Checker
                          </button>
                          <button
                            className="tl-assignment-menu-item"
                            onClick={() => {
                              handleMarkAsDone(assignment.id, assignment.title)
                              setShowMenuForAssignment(null)
                            }}
                            disabled={assignment.status === 'completed'}
                          >
                            {assignment.status === 'completed' ? '✓ Marked as Done' : 'Mark as Done'}
                          </button>
                          <button
                            className="tl-assignment-menu-item"
                            onClick={() => {
                              handleEditAssignment(assignment)
                              setShowMenuForAssignment(null)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="tl-assignment-menu-item tl-assignment-delete-menu-item"
                            onClick={() => {
                              setAssignmentToDelete({ id: assignment.id, title: assignment.title })
                              setShowDeleteConfirmation(true)
                              setShowMenuForAssignment(null)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                  </div>
                </div>

                <div className="tl-assignment-task-title-section">
                  <div className="tl-assignment-title-with-team">
                    <h3 className="tl-assignment-title">{assignment.title}</h3>
                    {assignment.team && (
                      <span className="tl-assignment-team-badge" data-team={assignment.team}>
                        {assignment.team}
                      </span>
                    )}
                  </div>
                </div>

                {assignment.description ? (
                  <div className="tl-assignment-task-description-section">
                    <p className="tl-assignment-description">{assignment.description}</p>
                  </div>
                ) : (
                  <div className="tl-assignment-task-description-section">
                    <p className="tl-assignment-no-description">No description</p>
                  </div>
                )}

                {/* Unified Recursive Files Section */}
                <div className="tl-assignment-attachment-section">
                  {((assignment.attachments && assignment.attachments.length > 0) || (assignment.recent_submissions && assignment.recent_submissions.length > 0)) ? (
                    <div className="tl-assignment-files-container">
                      {(() => {
                        const attachments = assignment.attachments || [];
                        const submissions = assignment.recent_submissions || [];
                        const revisionCount = submissions.filter(f => f.status === 'revision').length;
                        
                        const renderRecursiveSubmissions = (files, level = 0, parentKey = '', type = 'file', parentIsLastArr = []) => {
                          const { subfolders, rootFiles } = recursiveGroupByPath(files);
                          const items = [];
                          const isReference = type === 'attachment';

                          const subfolderEntries = Object.entries(subfolders);
                          const totalSubfolders = subfolderEntries.length;
                          const totalRootFiles = rootFiles.length;

                          // 1. Render Subfolders
                          subfolderEntries.forEach(([folderName, folderFiles], index) => {
                            const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
                            const currentKey = parentKey ? `${parentKey}__${folderName}` : `${type}__${folderName}`;
                            const isExpanded = expandedAssignmentFolders[`${assignment.id}__${currentKey}`];
                            
                            items.push(
                              <React.Fragment key={`folder-${currentKey}`}>
                                <div className="tl-tree-container">
                                  {parentIsLastArr.map((isLastParent, i) => (
                                    <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                                  ))}
                                  {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                                  <div
                                    data-folder-key={`${assignment.id}__${currentKey}`}
                                    className={`tl-assignment-file-item tl-folder-row ${level > 0 ? 'tl-in-tree' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newKey = `${assignment.id}__${currentKey}`;
                                      const newState = !expandedAssignmentFolders[newKey];
                                      setExpandedAssignmentFolders(prev => ({ ...prev, [newKey]: newState }));
                                      if (newState) prefetchFolderFiles(folderFiles.map(f => f.file || f), type);
                                    }}
                                    style={{ 
                                      cursor: 'pointer', 
                                      background: isExpanded ? 'linear-gradient(90deg, #eff6ff 0%, #ffffff 100%)' : '#f8fafc', 
                                      padding: '14px 20px', 
                                      marginBottom: '8px', 
                                      borderRadius: '12px',
                                      marginLeft: level === 0 ? '0px' : '0px', // We use tree lines now
                                      boxShadow: isExpanded ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                                      transition: 'all 0.2s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      flex: 1
                                    }}
                                  >
                                    <div style={{ 
                                      fontSize: '30px', 
                                      width: '44px', 
                                      height: '44px', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      background: isExpanded ? '#dbeafe' : '#f1f5f9',
                                      color: isExpanded ? '#2563eb' : '#64748b',
                                      borderRadius: '8px',
                                      marginRight: '14px',
                                      flexShrink: 0,
                                      position: 'relative',
                                      zIndex: 2
                                    }}>
                                      {isExpanded ? '📂' : '📁'}
                                    </div>
                                    <div className="tl-assignment-file-details">
                                      <div className="tl-assignment-file-name" style={{ fontWeight: '700', fontSize: '15.5px', color: '#1e293b' }}>{folderName}</div>
                                      <div className="tl-assignment-file-meta" style={{ fontSize: '12px' }}>
                                        <span style={{ color: '#64748b', fontWeight: '500' }}>{folderFiles.length} items</span>
                                        {!isReference && (() => {
                                          const firstFile = folderFiles[0]?.file || folderFiles[0];
                                          const submitter = firstFile?.fullName || firstFile?.username;
                                          const submittedAt = firstFile?.submitted_at || firstFile?.uploaded_at;
                                          return submitter ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginLeft: '6px' }}>
                                              <span style={{ color: '#9ca3af' }}>•</span>
                                              <span style={{ color: '#374151' }}>by <span style={{ fontWeight: '600', color: '#2563eb' }}>{submitter}</span></span>
                                              {submittedAt && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280' }}>
                                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                                  </svg>
                                                  {formatDateTime(submittedAt)}
                                                </span>
                                              )}
                                            </span>
                                          ) : null;
                                        })()}
                                        {isReference && (() => {
                                          const firstFile = folderFiles[0]?.file || folderFiles[0];
                                          const uploadedAt = firstFile?.created_at || firstFile?.uploaded_at;
                                          return uploadedAt ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280', marginLeft: '6px' }}>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                              </svg>
                                              {formatDateTime(uploadedAt)}
                                            </span>
                                          ) : null;
                                        })()}
                                        {isReference && <span className="tl-badge-reference" style={{ marginLeft: '8px' }}>Reference</span>}
                                        {!isReference && folderFiles.some(f => (f.file?.status || f.status) === 'revision') && (
                                          <span className="tl-badge-revision" style={{ marginLeft: '8px' }}>
                                            Checked - Need to Edit ({folderFiles.filter(f => (f.file?.status || f.status) === 'revision').length})
                                          </span>
                                        )}
                                        {!isReference && folderFiles.every(f => (f.file?.status || f.status) === 'checked') && (
                                          <span style={{ marginLeft: '8px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                                            ✓ All Checked
                                          </span>
                                        )}
                                        {!isReference && !folderFiles.every(f => (f.file?.status || f.status) === 'checked') && folderFiles.some(f => (f.file?.status || f.status) === 'checked') && (
                                          <span style={{ marginLeft: '8px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                                            Checked ({folderFiles.filter(f => (f.file?.status || f.status) === 'checked').length})
                                          </span>
                                        )}
                                        {!isReference && (() => {
                                          const rejectedCount = folderFiles.filter(f => {
                                            const s = f.file?.status || f.status;
                                            return s === 'rejected' || s === 'rejected_by_team_leader' || s === 'rejected_by_admin';
                                          }).length;
                                          return rejectedCount > 0 ? (
                                            <span style={{ marginLeft: '8px', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #FECACA' }}>
                                              ✕ Rejected ({rejectedCount})
                                            </span>
                                          ) : null;
                                        })()}
                                        {!isReference && (() => {
                                          const pendingAdminCount = folderFiles.filter(f => (f.file?.status || f.status) === 'team_leader_approved').length;
                                          return pendingAdminCount > 0 ? (
                                            <span style={{ marginLeft: '8px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', border: '1px solid #BFDBFE' }}>
                                              Pending Admin ({pendingAdminCount})
                                            </span>
                                          ) : null;
                                        })()}
                                      </div>
                                    </div>
                                    <div className="tl-folder-menu-wrapper" style={{ marginLeft: 'auto' }}>
                                      <FolderActionDropdown
                                        assignment={assignment}
                                        folderName={folderName}
                                        folderFiles={folderFiles.map(f => f.file || f)}
                                        handleDownloadFolder={handleDownloadFolder}
                                        setFolderReviewModal={isReference ? null : setFolderReviewModal}
                                        setFolderReviewComment={isReference ? null : setFolderReviewComment}
                                        setToast={setToast}
                                      />
                                    </div>
                                  </div>
                                </div>
                                {isExpanded && renderRecursiveSubmissions(folderFiles, level + 1, currentKey, type, [...parentIsLastArr, isLast])}
                              </React.Fragment>
                            );
                          });

                          // 2. Render root files
                          rootFiles.forEach((item, index) => {
                            const isLast = index === totalRootFiles - 1;
                            const submission = item.file || item;
                            const isViewed = isFileViewed(assignment.id, submission.id);
                            
                            items.push(
                              <div className="tl-tree-container" key={submission.id}>
                                {parentIsLastArr.map((isLastParent, i) => (
                                  <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                                ))}
                                {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                                <div
                                  data-file-id={submission.id}
                                  className={`tl-assignment-file-item ${isViewed ? 'file-card-opened' : ''} ${level > 0 ? 'tl-in-tree' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isReference) {
                                      if (openReviewModal && submission.id) {
                                        openReviewModal(submission, null, (fileId) => {
                                          setViewerCounts(prev => ({ ...prev, [fileId]: (prev[fileId] ?? 0) + 1 }));
                                          markFileViewed(assignment.id, fileId);
                                        });
                                      }
                                    } else {
                                      setFileToOpen({ ...submission, isAttachment: true, assignmentId: assignment.id });
                                      setShowOpenFileConfirmation(true);
                                    }
                                  }}
                                  style={{ 
                                    cursor: 'pointer', 
                                    marginLeft: level === 0 ? '0px' : '0px', 
                                    padding: '14px 20px', 
                                    marginBottom: '8px',
                                    flex: 1
                                  }}
                                >
                                  <FileIcon
                                    fileType={(submission.original_name || submission.file_name || '').split('.').pop()}
                                    size="default"
                                    style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', position: 'relative', zIndex: 2 }}
                                    className="tl-assignment-file-icon"
                                  />
                                  <div className="tl-assignment-file-details">
                                    <div className="tl-assignment-file-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '15px', fontWeight: '500' }}>{submission.original_name || submission.file_name}</span>
                                      {isViewed && <span className="tl-viewed-badge">✓ Viewed</span>}
                                    </div>
                                    <div className="tl-assignment-file-meta" style={{ fontSize: '12px' }}>
                                      {isReference ? (
                                        <span className="tl-badge-reference">Reference Attachment</span>
                                      ) : (
                                        <>
                                          <span>by <span className="tl-assignment-file-submitter">{submission.fullName || submission.username || 'Unknown'}</span></span>
                                          {submission.submitted_at || submission.uploaded_at ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#6b7280' }}>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                              </svg>
                                              {formatDateTime(submission.submitted_at || submission.uploaded_at)}
                                            </span>
                                          ) : null}
                                          {submission.tag && <span className="tl-assignment-file-tag">🏷️ {submission.tag}</span>}
                                          <span className={`tl-assignment-file-status ${submission.status}`}>
                                            {submission.status === 'checked' ? '✓ Checked' :
                                            submission.status === 'uploaded' ? 'New' : 
                                            submission.status === 'under_revision' ? '✎ Revised' :
                                            submission.status === 'revision' ? '⚠ Checked - Need to Edit' :
                                            submission.status === 'team_leader_approved' ? 'Pending Admin' : 
                                            submission.status === 'final_approved' ? '✓ Approved' : 
                             (submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin') ? 'X Rejected' : 'Pending'}
                                          </span>
                                          {submission.status === 'checked' && submission.checked_by && (
                                            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                                              Checked by : <span style={{ color: '#1D4ED8', fontWeight: '700' }}>{submission.checked_by}</span>
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <FileViewersButton fileId={submission.id} externalCount={viewerCounts[submission.id]} fileSource={isReference ? 'attachment' : 'submission'} />

                                  <div className="tl-folder-menu-wrapper" style={{ marginLeft: '4px' }} onClick={e => e.stopPropagation()}>
                                    <FileActionDropdown
                                      assignment={assignment}
                                      submission={submission}
                                      isReference={isReference}
                                      handleDownloadFile={handleDownloadFile}
                                      setToast={setToast}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          });

                          return items;
                        };

                        const referenceItems = renderRecursiveSubmissions(attachments, 0, '', 'attachment', []);
                        const submissionItems = renderRecursiveSubmissions(submissions, 0, '', 'file', []);
                        
                        const refLimit = expandedAttachments[assignment.id] ? referenceItems.length : 5;
                        const subLimit = expandedSubmissions[assignment.id] ? submissionItems.length : 5;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Section 1: Attached Files */}
                            {attachments.length > 0 && (
                              <div className="tl-assignment-attached-file">
                                <div className="tl-assignment-file-label" style={{ color: '#2563eb', marginBottom: '12px' }}>
                                  📎 Attached Files ({attachments.length})
                                </div>
                                {referenceItems.slice(0, refLimit)}
                                {referenceItems.length > 5 && (
                                  <div style={{ padding: '8px 16px', textAlign: 'center', cursor: 'pointer' }}
                                    onClick={() => toggleAttachments(assignment.id)}
                                  >
                                    <span style={{ color: '#0066cc', fontSize: '13px', fontWeight: '500', textDecoration: 'underline' }}>
                                      {expandedAttachments[assignment.id] ? 'See less' : `See more (${referenceItems.length - 5} more)`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Section 2: Member Submissions */}
                            {submissions.length > 0 && (
                              <div className="tl-assignment-attached-file">
                                <div className="tl-assignment-file-label" style={{ color: '#059669', marginBottom: '12px' }}>
                                  📤 Member Submissions ({submissions.length})
                                </div>
                                {submissionItems.slice(0, subLimit)}
                                {submissionItems.length > 5 && (
                                  <div style={{ padding: '8px 16px', textAlign: 'center', cursor: 'pointer' }}
                                    onClick={() => toggleSubmissions(assignment.id)}
                                  >
                                    <span style={{ color: '#0066cc', fontSize: '13px', fontWeight: '500', textDecoration: 'underline' }}>
                                      {expandedSubmissions[assignment.id] ? 'See less' : `See more (${submissionItems.length - 5} more)`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="tl-assignment-no-attachment">
                      <span className="tl-assignment-no-attachment-icon">ℹ️</span>
                      <div className="tl-assignment-no-attachment-text">
                        <strong>No submissions yet.</strong>
                        Waiting for team members to submit files.
                      </div>
                    </div>
                  )}
                </div>


                <div className="tl-assignment-comments-section">
                  <button
                    className="tl-assignment-comments-text"
                    onClick={() => openCommentsModal(assignment)}
                  >
                    Comments ({commentCounts[assignment.id] || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
        })()
      }
      </div>

      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        assignment={selectedAssignment}
        comments={comments}
        loadingComments={loadingComments}
        newComment={newComment}
        setNewComment={setNewComment}
        onPostComment={postComment}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        replyText={replyText}
        setReplyText={setReplyText}
        onPostReply={postReply}
        onDeleteComment={deleteComment}
        onEditComment={editComment}
        onDeleteReply={deleteReply}
        onEditReply={editReply}
        visibleReplies={visibleReplies}
        toggleRepliesVisibility={toggleRepliesVisibility}
        getInitials={getInitials}
        formatTimeAgo={formatRelativeTime}
        user={user}
        onRefreshAssignments={onRefreshAssignments}
        isPostingComment={isPostingComment}
        isPostingReply={isPostingReply}
      />

      {showMembersModal && (
        <div className="tl-modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="tl-modal" onClick={e => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h3>Assigned Members ({selectedMembers.length})</h3>
              <button onClick={() => setShowMembersModal(false)}>×</button>
            </div>
            <div className="tl-modal-body">
              <div className="tl-modal-members-list">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="tl-modal-member-item">
                    <div className="tl-modal-member-avatar">
                      {(member.fullName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="tl-member-info">
                      <div className="tl-member-name">
                        {member.fullName || member.username}
                      </div>
                      {member.fullName && (
                        <div className="tl-member-username">
                          @{member.username}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false)
          setAssignmentToDelete(null)
        }}
        onConfirm={() => {
          if (assignmentToDelete) {
            deleteAssignment(assignmentToDelete.id, assignmentToDelete.title)
          }
          setShowDeleteConfirmation(false)
          setAssignmentToDelete(null)
        }}
        title="Delete Task"
        message={`Are you sure you want to delete "${assignmentToDelete?.title}"?`}
        description="This action cannot be undone. All submissions and comments associated with this task will be permanently deleted."
        confirmText="Delete Task"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Folder Review Modal */}
      {folderReviewModal && (
        <div className="modal-overlay" onClick={() => { if (!isFolderProcessing) setFolderReviewModal(null) }}>
          <div className="file-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Folder Details</h3>
              <button className="modal-close" onClick={() => setFolderReviewModal(null)} disabled={isFolderProcessing}>×</button>
            </div>
            <div className="modal-body">
              <div className="file-details-section">
                <h4 className="section-title">Folder Details</h4>
                <div className="file-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">FOLDER NAME:</span>
                    <span className="detail-value">📁 {folderReviewModal.folderName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TOTAL FILES:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles.length} files</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">SUBMITTED BY:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles[0]?.fullName || folderReviewModal.folderFiles[0]?.username || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">UPLOAD DATE:</span>
                    <span className="detail-value">{folderReviewModal.folderFiles[0]?.uploaded_at ? new Date(folderReviewModal.folderFiles[0].uploaded_at).toLocaleString() : 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">TEAM:</span>
                    <span className="detail-value team-badge-inline">{folderReviewModal.folderFiles[0]?.user_team || folderReviewModal.folderFiles[0]?.team || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">STATUS:</span>
                    <span className="detail-value">
                      {(() => {
                        const files = folderReviewModal.folderFiles
                        const approved = files.filter(f => f.status === 'final_approved').length
                        const tlApproved = files.filter(f => f.status === 'team_leader_approved').length
                        const rejected = files.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
                        if (approved === files.length) return <span className="status-badge status-approved">All Approved</span>
                        if (rejected === files.length) return <span className="status-badge status-rejected">All Rejected</span>
                        if (tlApproved + approved === files.length) return <span className="status-badge status-pending">Pending Admin</span>
                        return <span className="status-badge status-pending">Pending Team Leader</span>
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="folder-files-section" style={{ marginTop: '20px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                <h4 className="section-title">Files in this Folder</h4>
                <div className="folder-files-list" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {folderReviewModal.folderFiles.map(file => {
                    const isViewed = isFileViewed(folderReviewModal.assignmentId, file.id);
                    return (
                      <div 
                        key={file.id} 
                        className={`tl-assignment-file-item ${isViewed ? 'file-card-opened' : ''}`}
                        style={{ padding: '8px 12px', marginBottom: '8px', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openReviewModal && file.id) {
                            openReviewModal(file, null, (fileId) => {
                              setViewerCounts(prev => ({ ...prev, [fileId]: (prev[fileId] ?? 0) + 1 }));
                              markFileViewed(folderReviewModal.assignmentId, fileId);
                            });
                          }
                        }}
                      >
                        <FileIcon fileType={(file.original_name || file.file_name || '').split('.').pop()} size="small" />
                        <div className="tl-assignment-file-details" style={{ flex: 1, minWidth: 0 }}>
                          <div className="tl-assignment-file-name" style={{ fontSize: '13.5px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name || file.file_name}</span>
                            {isViewed && <span className="tl-viewed-badge">✓ Viewed</span>}
                          </div>
                          <div className="tl-assignment-file-meta" style={{ fontSize: '11px', color: '#6b7280' }}>
                            <span className={`tl-assignment-file-status ${file.status}`}>
                              {file.status === 'uploaded' ? 'New' : 
                               file.status === 'under_revision' ? '✎ Revised' :
                               file.status === 'revision' ? '⚠ Checked - Need to Edit' :
                               file.status === 'checked' ? '✓ Checked' :
                               file.status === 'team_leader_approved' ? 'Pending Admin' : 
                               file.status === 'final_approved' ? '✓ Approved' : 
                               (file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin') ? 'X Rejected' : 'Pending Review'}
                            </span>
                            {file.status === 'checked' && file.checked_by && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#1D4ED8', fontWeight: '600', fontSize: '11px', background: '#EFF6FF', padding: '1px 7px', borderRadius: '8px', border: '1px solid #BFDBFE', marginLeft: '6px' }}>
                                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7l-7 7-3-3"/></svg>
                                {file.checked_by}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                           <FileViewersButton fileId={file.id} externalCount={viewerCounts[file.id]} fileSource="submission" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="comments-section">
                <h4 className="section-title">Comments (Optional)</h4>
                <textarea
                  className="comment-textarea"
                  value={folderReviewComment}
                  onChange={e => setFolderReviewComment(e.target.value)}
                  placeholder="Add optional comments or rejection reason..."
                  rows="4"
                  disabled={isFolderProcessing}
                />
              </div>

              <div className="actions-section">
                <div className="action-buttons-large">
                  <button
                    className="btn btn-success-large"
                    disabled={isFolderProcessing}
                    onClick={async () => {
                      const approvable = folderReviewModal.folderFiles.filter(f =>
                        f.status === 'uploaded' || f.current_stage === 'pending_team_leader'
                      )
                      if (approvable.length === 0) {
                        alert('No files are pending team leader approval.')
                        return
                      }
                      setIsFolderProcessing(true)
                      try {
                        const data = await apiFetch(`/api/files/bulk-action`, {
                          method: 'POST',
                          body: JSON.stringify({
                            fileIds: approvable.map(f => f.id),
                            action: 'approve',
                            comments: folderReviewComment.trim(),
                            reviewerId: user.id,
                            reviewerUsername: user.username,
                            reviewerRole: user.role,
                            team: user.team
                          })
                        })
                        if (data.success) {
                          if (data.results?.failed?.length > 0) {
                            alert(`⚠️ ${data.results.failed.length} file(s) could not be approved:\n${data.results.failed.map(f => `${f.fileName}: ${f.reason}`).join('\n')}`)
                          }
                          setFolderReviewModal(null)
                          if (onRefreshAssignments) onRefreshAssignments()
                        } else {
                          alert('Failed to approve: ' + (data.message || 'Unknown error'))
                        }
                      } catch (err) {
                        alert('Failed to approve folder: ' + err.message)
                      } finally {
                        setIsFolderProcessing(false)
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M16.875 5L7.5 14.375L3.125 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isFolderProcessing ? 'Processing...' : 'Approve All'}
                  </button>
                  <button
                    className="btn btn-danger-large"
                    disabled={isFolderProcessing}
                    onClick={async () => {
                      const rejectable = folderReviewModal.folderFiles.filter(f =>
                        f.status === 'uploaded' || f.current_stage === 'pending_team_leader'
                      )
                      if (rejectable.length === 0) {
                        alert('No files are pending team leader approval.')
                        return
                      }
                      setIsFolderProcessing(true)
                      try {
                        const data = await apiFetch(`/api/files/bulk-action`, {
                          method: 'POST',
                          body: JSON.stringify({
                            fileIds: rejectable.map(f => f.id),
                            action: 'reject',
                            comments: folderReviewComment.trim(),
                            reviewerId: user.id,
                            reviewerUsername: user.username,
                            reviewerRole: user.role,
                            team: user.team
                          })
                        })
                        if (data.success) {
                          setFolderReviewModal(null)
                          if (onRefreshAssignments) onRefreshAssignments()
                        } else {
                          alert('Failed to reject: ' + (data.message || 'Unknown error'))
                        }
                      } catch (err) {
                        alert('Failed to reject folder.')
                      } finally {
                        setIsFolderProcessing(false)
                      }
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isFolderProcessing ? 'Processing...' : 'Reject All'}
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Checker Modal */}
      {assignCheckerModal && (() => {
        const { assignment } = assignCheckerModal
        // Use all team members, not just those assigned to this task
        const allMembers = (teamMembers || []).filter(m => m.role !== 'TEAM_LEADER' && m.id !== user.id)
        const members = allMembers.length > 0 ? allMembers : (assignment.assigned_member_details || [])
        const toggleMember = (id) => {
          setSelectedCheckerIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
          })
        }
        return (
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setAssignCheckerModal(null)}
          >
            <div
              style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.18)', width: '460px', maxWidth: '95vw', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#111827' }}>Assign Checker</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{assignment.title}</p>
                </div>
                <button onClick={() => setAssignCheckerModal(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>Select one or more members to review the submitted files.</p>
                  {selectedCheckerIds.size > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#4f46e5', background: '#eef2ff', padding: '2px 10px', borderRadius: '10px', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                      {selectedCheckerIds.size} selected
                    </span>
                  )}
                </div>

                {members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '14px' }}>No assigned members found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    {members.map(member => {
                      const id = String(member.id)
                      const isSelected = selectedCheckerIds.has(id)
                      const existingIds = (() => { try { return new Set((JSON.parse(assignment.checker_ids || '[]')).map(String)) } catch { return new Set() } })()
                      const isCurrent = existingIds.has(id)
                      return (
                        <div
                          key={id}
                          onClick={() => toggleMember(id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                            border: `1.5px solid ${isSelected ? '#4f46e5' : '#e5e7eb'}`,
                            background: isSelected ? '#eef2ff' : '#fafafa',
                            transition: 'all 0.15s'
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                            border: `2px solid ${isSelected ? '#4f46e5' : '#d1d5db'}`,
                            background: isSelected ? '#4f46e5' : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}>
                            {isSelected && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            )}
                          </div>
                          {/* Avatar */}
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isSelected ? '#4f46e5' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#fff' : '#374151', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                            {getInitials(member.fullName || member.username)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{member.fullName || member.username}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>@{member.username}</div>
                          </div>
                          {isCurrent && (
                            <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>Current</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedCheckerIds(new Set())}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer', padding: '4px', textDecoration: 'underline' }}
                >
                  Clear all
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setAssignCheckerModal(null)}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isAssigningChecker || members.length === 0}
                    onClick={async () => {
                      setIsAssigningChecker(true)
                      try {
                        const chosenMembers = members.filter(m => selectedCheckerIds.has(String(m.id)))
                        const data = await apiFetch(`/api/assignments/${assignment.id}/assign-checker`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            checkerIds: chosenMembers.map(m => m.id),
                            checkerNames: chosenMembers.map(m => m.fullName || m.username)
                          })
                        })
                        if (data.success) {
                          setToast({ isOpen: true, title: 'Success', message: data.message, type: 'success' })
                          setAssignCheckerModal(null)
                          if (onRefreshAssignments) onRefreshAssignments()
                        } else {
                          setToast({ isOpen: true, title: 'Error', message: data.message || 'Failed to assign checker', type: 'error' })
                        }
                      } catch (e) {
                        setToast({ isOpen: true, title: 'Error', message: 'Failed to assign checker', type: 'error' })
                      } finally {
                        setIsAssigningChecker(false)
                      }
                    }}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: isAssigningChecker ? '#a5b4fc' : '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: isAssigningChecker ? 'not-allowed' : 'pointer' }}
                  >
                    {isAssigningChecker ? 'Saving...' : selectedCheckerIds.size === 0 ? 'Remove Checkers' : `Assign ${selectedCheckerIds.size} Checker${selectedCheckerIds.size > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Remove Attachment Confirmation Modal */}
      {removeAttachmentModal.isOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxWidth: '480px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#dc2626', fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> Delete File
              </h3>
              <button
                onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              >×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '15px', color: '#374151', marginBottom: '16px', lineHeight: 1.6 }}>
                Are you sure you want to permanently delete this file?
              </p>
              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📄</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#991b1b' }}>{removeAttachmentModal.attachmentName}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                This action will permanently delete the file from the database and storage. This cannot be undone.
              </p>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { attachmentId, assignmentId, attachmentName } = removeAttachmentModal
                  setRemoveAttachmentModal({ isOpen: false, attachmentId: null, attachmentName: '', assignmentId: null })
                  try {
                    const data = await apiFetch(`/api/assignments/${assignmentId}/attachments/${attachmentId}`, { method: 'DELETE' })
                    if (data.success) {
                      setToast({ isOpen: true, title: 'Removed', message: 'File removed successfully', type: 'error' })
                      if (onRefreshAssignments) onRefreshAssignments()
                    }
                  } catch (err) { console.error('Failed to delete attachment:', err) }
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <span>🗑️</span> Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <SuccessModal
        isOpen={toast.isOpen}
        onClose={() => setToast({ isOpen: false, title: '', message: '', type: 'error' })}
        title={toast.title}
        message={toast.message}
        type={toast.type}
      />

      {/* Mark as Done Loading Overlay */}
      {markingDoneId !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            padding: '36px 44px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            minWidth: '280px'
          }}>
            <div style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(22,163,74,0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'markDoneSpin 1.2s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>
                Marking as Done…
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                Completing task and cleaning up files.<br/>Please wait.
              </div>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                animation: 'markDoneBar 1.5s ease-in-out infinite alternate'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Download Success Toast */}
      {downloadToast.show && (
        <div
          style={{
            position: 'fixed',
            top: '28px',
            right: '28px',
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #bbf7d0',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            padding: '18px 22px 14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            minWidth: '280px',
            maxWidth: '380px',
            animation: 'tlSlideInRight 0.25s ease',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: '#dcfce7', border: '2px solid #86efac',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, marginTop: '1px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>
              Success
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              {downloadToast.fileName
                ? `"${downloadToast.fileName}" downloaded successfully!`
                : 'File downloaded successfully!'}
            </div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '2px', background: '#dcfce7', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px', background: '#22c55e',
                animation: 'tlShrinkBar 3.5s linear forwards'
              }} />
            </div>
          </div>
          <button
            onClick={() => setDownloadToast({ show: false, fileName: '' })}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '20px', lineHeight: 1,
              padding: '0', flexShrink: 0, borderRadius: '4px',
              marginTop: '-2px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#374151'}
            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
          >×</button>
        </div>
      )}

      <style>{`
        @keyframes markDoneSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes markDoneBar {
          from { width: 20%; }
          to   { width: 90%; }
        }
        @keyframes tlSlideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tlShrinkBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileConfirmation}
        onClose={() => {
          setShowOpenFileConfirmation(false)
          setFileToOpen(null)
        }}
        onConfirm={async () => {
          if (!fileToOpen) return
          
          // Close immediately to improve perceived responsiveness
          const file = { ...fileToOpen };
          const fileId = file.id;
          setShowOpenFileConfirmation(false);
          setFileToOpen(null);
          
          setToast({ isOpen: true, title: 'Opening', message: `Opening ${file.original_name}...`, type: 'success' });

          try {
            // Check if running in Electron and has capability to open files locally
            if (window.electron && window.electron.openFileInApp) {
              // Get the absolute file path from server
              const type = file.isAttachment ? 'attachment' : 'file';
              const data = await apiFetch(`/api/files/${file.id}/path?type=${type}`);

              if (data.success && data.filePath) {
                const result = await window.electron.openFileInApp(data.filePath);

                if (!result.success) {
                  alert('Failed to open file locally: ' + (result.error || 'Unknown error'));
                } else {
                  markFileViewed(file.assignmentId, fileId)
                  recordView(fileId, file.isAttachment)
                }
              } else {
                alert('Could not retrieve file path');
              }
            } else {
              // Web fallback: Open file in new tab/download
              let fileUrl = file.file_path;
              if (file.status === 'final_approved' && file.public_network_url) {
                if (file.public_network_url.startsWith('http')) {
                  fileUrl = file.public_network_url;
                } else {
                  fileUrl = `${API_BASE_URL}${file.file_path}`;
                }
              } else {
                fileUrl = `${API_BASE_URL}${file.file_path}`;
              }

              window.open(fileUrl, '_blank', 'noopener,noreferrer');
              markFileViewed(file.assignmentId, fileId)
              recordView(fileId, file.isAttachment)
            }
          } catch (error) {
            console.error('Error opening file:', error);
            alert('Failed to open file. Please try again.');
          }
        }}
        file={fileToOpen}
      />
    </div>
  )
}

export default AssignmentsTab

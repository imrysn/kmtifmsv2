import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import './css/FileCollectionTab.css'
import '../shared/SmartNavigation/SmartNavigation.css'
import FileIcon from '../shared/FileIcon'
import FileOpenModal from '../shared/FileOpenModal'
import { LoadingTable } from '../common/InlineSkeletonLoader'

import { recursiveGroupByPath } from '@utils/folderUtils'

const FileCollectionTab = ({
  submittedFiles,
  isLoading,
  openFileViewModal,
  formatFileSize,
  user,
  openMenuId,
  toggleMenu,
  handleOpenInExplorer,
  fileCollectionFilter,
  setFileCollectionFilter,
  fileCollectionSort,
  setFileCollectionSort,
  onNavigateToTask,
  highlightedFileId,
  onClearFileHighlight
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(7)
  const [showOpenFileModal, setShowOpenFileModal] = useState(false)
  const [fileToOpen, setFileToOpen] = useState(null)
  const [teamFilter, setTeamFilter] = useState('all')
  const [expandedFolders, setExpandedFolders] = useState({})
  const [folderShowAll, setFolderShowAll] = useState({})
  const [activeView, setActiveView] = useState('collection') // 'collection' | 'reference'
  const FOLDER_PREVIEW_COUNT = 5

  // Fully local dropdown state — position + which menu is open.
  // Using local state avoids race conditions with the parent's openMenuId/toggleMenu.
  const [localMenuId, setLocalMenuId] = useState(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  // Close menu when clicking anywhere outside
  useEffect(() => {
    if (!localMenuId) return
    const close = () => setLocalMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [localMenuId])

  const openLocalMenu = useCallback((id, btnEl) => {
    setLocalMenuId(prev => {
      if (prev === id) return null // toggle off
      const rect = btnEl.getBoundingClientRect()
      const MENU_HEIGHT = 100
      const MENU_WIDTH = 180
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      // Prefer below; flip above if not enough room below
      let top = spaceBelow >= MENU_HEIGHT + 8
        ? rect.bottom + 4
        : rect.top - MENU_HEIGHT - 4

      // Hard-clamp: never let the menu go off the top or bottom of the viewport
      top = Math.max(4, Math.min(top, window.innerHeight - MENU_HEIGHT - 4))

      const left = Math.max(4, rect.right - MENU_WIDTH)
      setMenuPos({ top, left })
      return id
    })
  }, [])

  const uniqueTeams = useMemo(() => {
    const teams = new Set()
    submittedFiles.forEach(file => {
      const team = file.user_team || file.team
      if (team) teams.add(team)
    })
    return Array.from(teams).sort()
  }, [submittedFiles])

  const groupFilesByFolder = useCallback((files) => {
    const folders = {}
    const individualFiles = []
    if (!files || !Array.isArray(files)) return { folders, individualFiles }

    const sortedFiles = [...files].sort((a, b) => {
      const nameA = (a.original_name || a.filename || '').toLowerCase();
      const nameB = (b.original_name || b.filename || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedFiles.forEach(file => {
      let folderName = file.folder_name
      
      // Fallback: if folder_name is missing, try to extract it from the path in original_name
      if (!folderName && file.original_name && (file.original_name.includes('/') || file.original_name.includes('\\'))) {
        const separator = file.original_name.includes('/') ? '/' : '\\'
        const parts = file.original_name.split(separator)
        if (parts.length > 1) {
          folderName = parts[0]
        }
      }

      if (folderName) {
        // Key by folderName + assignment_id + user so same folder in different tasks stays separate
        const key = `${folderName}||${file.assignment_id || ''}||${file.user_id || file.username || ''}`
        if (!folders[key]) folders[key] = []
        folders[key].push(file)
      } else {
        individualFiles.push(file)
      }
    })

    const sortedFolders = {}
    Object.keys(folders).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(key => {
      sortedFolders[key] = folders[key];
    });

    return { folders: sortedFolders, individualFiles }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    setFolderShowAll({})
  }, [searchQuery, fileCollectionFilter, fileCollectionSort, teamFilter])

  useEffect(() => {
    if (highlightedFileId && submittedFiles.length > 0) {
      setTimeout(() => {
        const fileRow = document.querySelector(`tr[data-file-id="${highlightedFileId}"]`)
        if (fileRow) {
          fileRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
          fileRow.classList.add('tl-file-highlighted')
          setTimeout(() => {
            fileRow.classList.remove('tl-file-highlighted')
            if (onClearFileHighlight) onClearFileHighlight()
          }, 1500)
        }
      }, 300)
    }
  }, [highlightedFileId, submittedFiles])

  const getFileExtension = (filename, fileType) => {
    if (filename) {
      const parts = filename.split('.')
      if (parts.length > 1) return parts[parts.length - 1].toLowerCase()
    }
    if (fileType) return fileType.replace(/^\./, '').toLowerCase()
    return ''
  }

  const calculateStats = () => {
    const total = submittedFiles.length
    const approved = submittedFiles.filter(f => f.status === 'approved' || f.status === 'final_approved').length
    const rejected = submittedFiles.filter(f => f.status === 'rejected' || f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin').length
    const pending = total - approved - rejected
    return { total, approved, rejected, pending }
  }

  const stats = calculateStats()

  const handleOpenFile = async () => {
    if (fileToOpen) {
      openFileViewModal(fileToOpen)
      setShowOpenFileModal(false)
      setFileToOpen(null)
    }
  }

  // Split files by view: File Collection = member submissions, Reference Files = TL attachments
  const collectionFiles = useMemo(() =>
    submittedFiles.filter(f => f.source_type !== 'assignment_attachment'),
    [submittedFiles]
  )
  const referenceFiles = useMemo(() =>
    submittedFiles.filter(f => f.source_type === 'assignment_attachment'),
    [submittedFiles]
  )
  const activeFiles = activeView === 'reference' ? referenceFiles : collectionFiles

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = activeFiles
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.original_name?.toLowerCase().includes(query) ||
        file.username?.toLowerCase().includes(query) ||
        file.fullName?.toLowerCase().includes(query) ||
        file.team?.toLowerCase().includes(query) ||
        file.assignment_title?.toLowerCase().includes(query)
      )
    }
    if (fileCollectionFilter !== 'all') {
      filtered = filtered.filter(file => {
        switch (fileCollectionFilter) {
          case 'pending': return file.status === 'uploaded' || file.status === 'team_leader_approved'
          case 'approved': return file.status === 'final_approved' || file.status === 'approved'
          case 'rejected': return file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin' || file.status === 'rejected'
          default: return true
        }
      })
    }
    if (teamFilter !== 'all') {
      filtered = filtered.filter(file => (file.user_team || file.team) === teamFilter)
    }
    const sorted = [...filtered].sort((a, b) => {
      switch (fileCollectionSort) {
        case 'date-desc': return new Date(b.submitted_at || b.uploaded_at) - new Date(a.submitted_at || a.uploaded_at)
        case 'date-asc': return new Date(a.submitted_at || a.uploaded_at) - new Date(b.submitted_at || b.uploaded_at)
        case 'filename-asc': return a.original_name.localeCompare(b.original_name)
        case 'filename-desc': return b.original_name.localeCompare(a.original_name)
        case 'user-asc': return (a.username || '').localeCompare(b.username || '')
        case 'user-desc': return (b.username || '').localeCompare(a.username || '')
        default: return 0
      }
    })
    return sorted
  }, [activeFiles, searchQuery, fileCollectionFilter, teamFilter, fileCollectionSort])

  const displayedFiles = filteredAndSortedFiles

  // Group into display items — each folder counts as 1, each individual file counts as 1
  const displayItems = useMemo(() => {
    const { folders, individualFiles } = groupFilesByFolder(displayedFiles)
    const items = []
    Object.keys(folders)
      .sort((a, b) => {
        const latestA = Math.max(...folders[a].map(f => new Date(f.submitted_at || f.uploaded_at)))
        const latestB = Math.max(...folders[b].map(f => new Date(f.submitted_at || f.uploaded_at)))
        return latestB - latestA
      })
      .forEach(folderKey => {
        // folderKey is "folderName||assignmentId||username" — strip to get display name
        const folderName = folderKey.split('||')[0]
        items.push({ type: 'folder', folderKey, folderName, files: folders[folderKey] })
      })
    individualFiles.forEach(file => {
      items.push({ type: 'file', file })
    })
    return items
  }, [displayedFiles, groupFilesByFolder])

  const currentPageItems = useMemo(() => {
    const start = (currentPage - 1) * filesPerPage
    return displayItems.slice(start, start + filesPerPage)
  }, [displayItems, currentPage, filesPerPage])

  const totalPages = useMemo(() => Math.ceil(displayItems.length / filesPerPage), [displayItems.length, filesPerPage])

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
      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)
      for (let i = startPage; i <= endPage; i++) {
        if (i !== 1 && i !== totalPages) {
          pageNumbers.push(<button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i}</button>)
        }
      }
      if (currentPage < totalPages - 2) pageNumbers.push(<span key="e2" className="pagination-ellipsis">...</span>)
      if (totalPages > 1) pageNumbers.push(<button key={totalPages} className={`pagination-btn ${totalPages === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>)
    }
    return pageNumbers
  }, [totalPages, currentPage])

  const getFolderStatusBadge = (folderFiles) => {
    const allApproved = folderFiles.every(f => f.status === 'approved' || f.status === 'final_approved')
    const anyRejected = folderFiles.some(f => f.status === 'rejected' || f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin')
    const allAtLeastTLApproved = folderFiles.every(f => f.status === 'team_leader_approved' || f.status === 'approved' || f.status === 'final_approved')
    const anyPendingTL = folderFiles.some(f => f.status === 'uploaded')

    if (anyPendingTL) {
      return <span className="status-badge status-pending">Pending Team Leader</span>
    }
    if (allApproved) {
      return <span className="status-badge status-approved">Approved</span>
    }
    if (anyRejected) {
      return <span className="status-badge status-rejected">Rejected</span>
    }
    if (allAtLeastTLApproved) {
      return <span className="status-badge status-pending">Pending Admin</span>
    }
    return <span className="status-badge status-pending">Pending Team Leader</span>
  }

  const getStatusBadge = (submission) => {
    const cls = submission.status === 'approved' || submission.status === 'final_approved' ? 'approved'
      : submission.status === 'rejected' || submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'rejected'
      : 'pending'
    const label = submission.status === 'approved' || submission.status === 'final_approved' ? 'Approved'
      : submission.status === 'rejected' || submission.status === 'rejected_by_team_leader' || submission.status === 'rejected_by_admin' ? 'Rejected'
      : submission.status === 'team_leader_approved' ? 'Pending Admin'
      : 'Pending Team Leader'
    return <span className={`status-badge status-${cls}`}>{label}</span>
  }

  const renderFileRow = (submission, isNested = false, level = 0, isLast = false, parentIsLastArr = []) => {
    const ext = getFileExtension(submission.original_name, submission.file_type)
    let displayName = submission.original_name
    if (isNested) {
      const cleanPath = (submission.relative_path || submission.original_name || '').replace(/\\/g, '/')
      const parts = cleanPath.split('/').filter(Boolean)
      if (parts.length > 0) {
        displayName = parts[parts.length - 1]
      }
    }
    return (
      <tr
        key={submission.id}
        data-file-id={submission.id}
        className={`tl-clickable-row ${isNested ? 'tl-folder-file-row' : ''}`}
        onClick={() => { setFileToOpen(submission); setShowOpenFileModal(true) }}
        style={isNested ? { backgroundColor: '#fafafa' } : {}}
      >
        <td>
          <div className="tl-tree-container">
            {parentIsLastArr.map((isLastParent, i) => (
              <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
            ))}
            {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
            <div className="file-cell" style={{ flex: 1 }}>
              <div className="file-icon" style={{ width: '34px', height: '34px' }}>
                <FileIcon fileType={ext} isFolder={false} altText={`Icon for ${submission.original_name}`} size="default" style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }} />
              </div>
              <div className="file-details">
                <span className="file-name">{displayName}</span>
                <span className="file-size">{formatFileSize(submission.file_size)}</span>
              </div>
            </div>
          </div>
        </td>
        <td>
          <div className="assignment-cell">
            <span className="assignment-title">{submission.assignment_title}</span>
            {submission.assignment_due_date && <span className="assignment-due-date">Due: {new Date(submission.assignment_due_date).toLocaleDateString()}</span>}
          </div>
        </td>
        <td>
          <div className="team-cell">
            <span className="team-badge" data-team={submission.user_team || submission.team}>{submission.user_team || submission.team || 'N/A'}</span>
          </div>
        </td>
        <td><div className="user-cell"><span className="user-name">{submission.fullName || submission.username}</span></div></td>
        <td>
          <div className="datetime-cell">
            <div className="date">{new Date(submission.submitted_at || submission.uploaded_at).toLocaleDateString()}</div>
            <div className="time">{new Date(submission.submitted_at || submission.uploaded_at).toLocaleTimeString()}</div>
          </div>
        </td>
        {activeView === 'collection' && <td>{getStatusBadge(submission)}</td>}
        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
          <div className="tl-actions-menu-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button className="tl-menu-button" onClick={(e) => { e.stopPropagation(); openLocalMenu(submission.id, e.currentTarget) }} title="Options">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                <circle cx="13" cy="8" r="1.5" fill="currentColor" />
              </svg>
            </button>
            {localMenuId === submission.id && ReactDOM.createPortal(
              <div className="tl-dropdown-menu" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: '160px' }}>
                {submission.assignment_id && onNavigateToTask && (
                  <button className="tl-dropdown-item" onClick={(e) => { e.stopPropagation(); onNavigateToTask(submission.assignment_id, submission.id) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M5.33333 2.66667H2.66667C2.29848 2.66667 2 2.96514 2 3.33333V13.3333C2 13.7015 2.29848 14 2.66667 14H12.6667C13.0349 14 13.3333 13.7015 13.3333 13.3333V10.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 2L14 4L8.66667 9.33333L6.66667 9.66667L7 7.66667L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Go to Task
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="tl-content">
      <div className="tl-page-header-with-stats">
        <div className="tl-page-header">
          <h1>File Collection</h1>
          <p>View all submitted files from assignments in one place</p>
          {/* Toggle */}
          <div style={{ display: 'inline-flex', marginTop: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#f9fafb' }}>
            <button
              onClick={() => setActiveView('collection')}
              style={{
                padding: '7px 20px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeView === 'collection' ? 'white' : 'transparent',
                color: activeView === 'collection' ? '#111827' : '#6b7280',
                boxShadow: activeView === 'collection' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                borderRadius: '7px', margin: '2px', transition: 'all 0.2s ease',
              }}
            >File Collection</button>
            <button
              onClick={() => setActiveView('reference')}
              style={{
                padding: '7px 20px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeView === 'reference' ? 'white' : 'transparent',
                color: activeView === 'reference' ? '#111827' : '#6b7280',
                boxShadow: activeView === 'reference' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                borderRadius: '7px', margin: '2px', transition: 'all 0.2s ease',
              }}
            >Reference Files</button>
          </div>
        </div>
        <div className="file-status-cards">
          <div className="file-status-card">
            <div className="status-icon total-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="status-info"><div className="status-number">{stats.total}</div><div className="status-label">Total Submissions</div></div>
          </div>
          <div className="file-status-card">
            <div className="status-icon pending-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="status-info"><div className="status-number">{stats.pending}</div><div className="status-label">Pending Review</div></div>
          </div>
          <div className="file-status-card">
            <div className="status-icon approved-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="status-info"><div className="status-number">{stats.approved}</div><div className="status-label">Approved</div></div>
          </div>
          <div className="file-status-card">
            <div className="status-icon rejected-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="status-info"><div className="status-number">{stats.rejected}</div><div className="status-label">Rejected</div></div>
          </div>
        </div>
      </div>

      <div className="file-controls">
        <div className="file-search">
          <input type="text" placeholder="Search files by name, user, or team..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="file-filters">
          <select value={fileCollectionFilter} onChange={(e) => setFileCollectionFilter(e.target.value)} className="form-select">
            <option value="all">All Files</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={fileCollectionSort} onChange={(e) => setFileCollectionSort(e.target.value)} className="form-select">
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="filename-asc">Filename A-Z</option>
            <option value="filename-desc">Filename Z-A</option>
            <option value="user-asc">User A-Z</option>
            <option value="user-desc">User Z-A</option>
          </select>
          {uniqueTeams.length > 1 && (
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="form-select">
              <option value="all">All Teams</option>
              {uniqueTeams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="tl-files-list"><LoadingTable rows={8} columns={6} /></div>
      ) : displayedFiles.length > 0 ? (
        <div className="tl-files-list">
          <table className="tl-files-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>File Name</th>
                <th>Task</th>
                <th>Team</th>
                <th>Submitted By</th>
                <th>Submitted Date</th>
                {activeView === 'collection' && <th>Status</th>}
                <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderRecursiveItems = (files, level = 1, parentKey = '', parentIsLastArr = []) => {
                  const { subfolders, rootFiles } = recursiveGroupByPath(files);
                  const items = [];

                  const subfolderEntries = Object.entries(subfolders);
                  const totalSubfolders = subfolderEntries.length;
                  const totalRootFiles = rootFiles.length;

                  // 1. Render subfolders
                  subfolderEntries.forEach(([folderName, folderFiles], index) => {
                    const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
                    const currentKey = parentKey ? `${parentKey}__${folderName}` : folderName;
                    const isExpanded = expandedFolders[currentKey];
                    const firstFile = folderFiles[0].file || folderFiles[0];

                    items.push(
                      <React.Fragment key={`folder-${currentKey}`}>
                        <tr
                          className="tl-clickable-row tl-folder-row"
                          onClick={() => setExpandedFolders(prev => ({ ...prev, [currentKey]: !prev[currentKey] }))}
                          style={{ backgroundColor: isExpanded ? '#f9fafb' : '#ffffff' }}
                        >
                          <td>
                            <div className="tl-tree-container">
                              {parentIsLastArr.map((isLastParent, i) => (
                                <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                              ))}
                              {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                              <div className="file-cell" style={{ flex: 1 }}>
                                <div style={{ fontSize: '30px' }}>{isExpanded ? '📂' : '📁'}</div>
                                <div className="file-details">
                                  <span className="file-name" style={{ fontWeight: '600' }}>{folderName}</span>
                                  <span className="file-size">{folderFiles.length} items</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{firstFile.assignment_title || '-'}</td>
                          <td>
                            <div className="team-cell">
                              <span className="team-badge" data-team={firstFile.user_team || firstFile.team}>{firstFile.user_team || firstFile.team || 'N/A'}</span>
                            </div>
                          </td>
                          <td><span className="user-name">{firstFile.fullName || firstFile.username || '-'}</span></td>
                          <td>{new Date(firstFile.submitted_at || firstFile.uploaded_at).toLocaleDateString()}</td>
                          {activeView === 'collection' && <td>{getFolderStatusBadge(folderFiles.map(f => f.file || f))}</td>}
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div className="tl-actions-menu-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <button className="tl-menu-button" onClick={(e) => { e.stopPropagation(); openLocalMenu(`folder-${currentKey}`, e.currentTarget) }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /></svg>
                              </button>
                              {localMenuId === `folder-${currentKey}` && ReactDOM.createPortal(
                                <div className="tl-dropdown-menu" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: '160px' }}>
                                  {onNavigateToTask && (
                                    <button
                                      className="tl-dropdown-item"
                                      style={!firstFile.assignment_id ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                      title={!firstFile.assignment_id ? 'This folder is not linked to a task' : 'Go to Task'}
                                      onClick={(e) => { e.stopPropagation(); if (firstFile.assignment_id) onNavigateToTask(firstFile.assignment_id, null) }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M5.33333 2.66667H2.66667C2.29848 2.66667 2 2.96514 2 3.33333V13.3333C2 13.7015 2.29848 14 2.66667 14H12.6667C13.0349 14 13.3333 13.7015 13.3333 13.3333V10.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M12 2L14 4L8.66667 9.33333L6.66667 9.66667L7 7.66667L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Go to Task
                                    </button>
                                  )}
                                </div>,
                                document.body
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && renderRecursiveItems(folderFiles, level + 1, currentKey, [...parentIsLastArr, isLast])}
                      </React.Fragment>
                    );
                  });

                  // 2. Render root files
                  rootFiles.forEach((item, index) => {
                    const isLast = index === totalRootFiles - 1;
                    const file = item.file || item;
                    items.push(renderFileRow(file, true, level, isLast, parentIsLastArr));
                  });

                  return items;
                };

                return currentPageItems.map((item) => {
                  if (item.type === 'folder') {
                    const { folderKey, folderName, files: folderFiles } = item;
                    const isExpanded = expandedFolders[folderKey];
                    const firstFile = folderFiles[0];
                    return (
                      <React.Fragment key={`root-folder-${folderKey}`}>
                        <tr
                          className="tl-clickable-row tl-folder-row"
                          onClick={() => setExpandedFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }))}
                          style={{ backgroundColor: isExpanded ? '#f9fafb' : '#ffffff' }}
                        >
                          <td>
                            <div className="file-cell">
                              <div style={{ fontSize: '30px' }}>{isExpanded ? '📂' : '📁'}</div>
                              <div className="file-details">
                                <span className="file-name" style={{ fontWeight: '600' }}>{folderName}</span>
                                <span className="file-size">{folderFiles.length} items</span>
                              </div>
                            </div>
                          </td>
                          <td>{firstFile.assignment_title || '-'}</td>
                          <td>
                            <div className="team-cell">
                              <span className="team-badge" data-team={firstFile.user_team || firstFile.team}>{firstFile.user_team || firstFile.team || 'N/A'}</span>
                            </div>
                          </td>
                          <td><span className="user-name">{firstFile.fullName || firstFile.username || '-'}</span></td>
                          <td>{new Date(firstFile.submitted_at || firstFile.uploaded_at).toLocaleDateString()}</td>
                          {activeView === 'collection' && <td>{getFolderStatusBadge(folderFiles)}</td>}
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div className="tl-actions-menu-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <button className="tl-menu-button" onClick={(e) => { e.stopPropagation(); openLocalMenu(`folder-${folderKey}`, e.currentTarget) }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /></svg>
                              </button>
                              {localMenuId === `folder-${folderKey}` && ReactDOM.createPortal(
                                <div className="tl-dropdown-menu" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: '160px' }}>
                                  {onNavigateToTask && (
                                    <button
                                      className="tl-dropdown-item"
                                      style={!firstFile.assignment_id ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                      title={!firstFile.assignment_id ? 'This folder is not linked to a task' : 'Go to Task'}
                                      onClick={(e) => { e.stopPropagation(); if (firstFile.assignment_id) onNavigateToTask(firstFile.assignment_id, null) }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M5.33333 2.66667H2.66667C2.29848 2.66667 2 2.96514 2 3.33333V13.3333C2 13.7015 2.29848 14 2.66667 14H12.6667C13.0349 14 13.3333 13.7015 13.3333 13.3333V10.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M12 2L14 4L8.66667 9.33333L6.66667 9.66667L7 7.66667L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Go to Task
                                    </button>
                                  )}
                                </div>,
                                document.body
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && renderRecursiveItems(
                          folderFiles.map(f => {
                            const file = f.file || f;
                            const path = (file.relative_path || file.webkitRelativePath || '').replace(/\\/g, '/');
                            const parts = path.split('/').filter(Boolean);
                            let remainingPath = path;
                            if (parts.length > 0 && parts[0].trim() === folderName) {
                              remainingPath = parts.slice(1).join('/');
                            }
                            return {
                              file,
                              _temp_path: remainingPath
                            };
                          }),
                          1,
                          folderKey,
                          []
                        )}
                      </React.Fragment>
                    );
                  }
                  return renderFileRow(item.file);
                });
              })()}
            </tbody>
          </table>

          {!isLoading && displayItems.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">
                Showing {((currentPage - 1) * filesPerPage) + 1} to {Math.min(currentPage * filesPerPage, displayItems.length)} of {displayItems.length} items
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
      ) : (
        <div className="tl-empty">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: '16px', opacity: 0.3 }}>
            <path d="M24 16H13.3333C11.4924 16 10 17.4924 10 19.3333V50.6667C10 52.5076 11.4924 54 13.3333 54H50.6667C52.5076 54 54 52.5076 54 50.6667V19.3333C54 17.4924 52.5076 16 50.6667 16H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M40 10H24V22H40V10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M32 32V42M32 42L37 37M32 42L27 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3>No submissions yet</h3>
          <p>Assignment submissions from your team will appear here</p>
        </div>
      )}

      <FileOpenModal
        isOpen={showOpenFileModal}
        onClose={() => { setShowOpenFileModal(false); setFileToOpen(null) }}
        onConfirm={handleOpenFile}
        file={fileToOpen}
      />
    </div>
  )
}

export default FileCollectionTab

import React, { useState } from 'react'
import { apiFetch, API_BASE_URL } from '@/config/api'
import { FileOpenModal, FileIcon, UserPerformanceCard } from '../../shared'
import '../css/FileCollectionTab.css'

import { recursiveGroupByPath } from '@utils/folderUtils'


const MemberFilesModal = ({
  showMemberFilesModal,
  setShowMemberFilesModal,
  selectedMember,
  setSelectedMember,
  memberFiles,
  setMemberFiles,
  isLoading,
  formatFileSize,
  user
}) => {
  const [expandedFolders, setExpandedFolders] = useState({})
  const [activeTab, setActiveTab] = useState('all')
  const [previewFile, setPreviewFile] = useState(null)

  if (!showMemberFilesModal || !selectedMember) return null

  const handleClose = () => {
    setShowMemberFilesModal(false)
    setSelectedMember(null)
    setMemberFiles([])
    setExpandedFolders({})
    setActiveTab('all')
  }

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  const openFile = async (file) => {
    try {
      if (window.electron && window.electron.openFileInApp) {
        const data = await apiFetch(`/api/files/${file.id}/path`)
        if (data.success && data.filePath) {
          await window.electron.openFileInApp(data.filePath)
        }
      } else {
        const fileUrl = `${API_BASE_URL}${file.file_path}`
        window.open(fileUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'uploaded':
      case 'submitted': return 'Pending Team Leader'
      case 'team_leader_approved': return 'Pending Admin'
      case 'final_approved':
      case 'approved': return 'Approved'
      case 'rejected_by_team_leader': return 'Rejected by Team Leader'
      case 'rejected_by_admin': return 'Rejected by Admin'
      case 'rejected': return 'Rejected'
      case 'revision': return 'Revision'
      default: return 'Pending Review'
    }
  }

  const getStatusLabel = (file) => {
    return file.status === 'uploaded' ? 'New' : 
           file.status === 'revision' ? '⚠ Revision' :
           file.status === 'team_leader_approved' ? 'Pending Admin' : 
           file.status === 'final_approved' ? '✓ Approved' : 
           (file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin') ? 'X Rejected' : 'Pending Review'
  }

  const getStatusClass = (file) => {
    if (file.status === 'approved' || file.status === 'final_approved') return 'approved'
    if (file.status === 'rejected' || file.status === 'rejected_by_team_leader' || file.status === 'rejected_by_admin') return 'rejected'
    if (file.status === 'revision') return 'revision'
    return 'pending'
  }

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr)
    return {
      date: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    }
  }

  const getFileExt = (file) => {
    return file.file_type?.split(' ')[0]?.slice(0, 3).toUpperCase() ||
      file.original_name?.split('.').pop()?.slice(0, 3).toUpperCase() || 'FILE'
  }

  // Separate into folders and individual files
  const folderMap = {}
  const individualFiles = []

  memberFiles.forEach(file => {
    if (file.folder_name) {
      if (!folderMap[file.folder_name]) folderMap[file.folder_name] = []
      folderMap[file.folder_name].push(file)
    } else {
      individualFiles.push(file)
    }
  })

  const folderNames = Object.keys(folderMap).sort()
  const totalFolders = folderNames.length
  const totalIndividual = individualFiles.length

  const displayedIndividual = activeTab === 'folders' ? [] : individualFiles
  const displayedFolders = activeTab === 'individual' ? [] : folderNames

  const tabs = [
    { key: 'all', label: 'All', count: memberFiles.length },
    ...(totalIndividual > 0 ? [{ key: 'individual', label: 'Individual Files', count: totalIndividual }] : []),
    ...(totalFolders > 0 ? [{ key: 'folders', label: 'Folders', count: totalFolders }] : []),
  ]

    const FileRow = ({ file, isNested = false, indentationLevel = 0, isLast = false, parentIsLastArr = [] }) => {
      const { date, time } = formatDateTime(file.uploaded_at || file.created_at)
      
      return (
        <tr
          key={file.id}
          onClick={() => setPreviewFile(file)}
          style={{ cursor: 'pointer' }}
          className="tl-clickable-row"
          title={`View ${file.original_name}`}
        >
          <td>
            <div className="tl-tree-container" style={{ paddingLeft: '0.75rem' }}>
              {parentIsLastArr.map((isLastParent, i) => (
                <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
              ))}
              {indentationLevel > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
              <div className="tl-file-name-cell" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileIcon
                  fileType={file.original_name?.split('.').pop()?.toLowerCase()}
                  size="small"
                  style={{ width: '18px', height: '18px' }}
                />
                <strong style={{ fontSize: '14.5px', fontWeight: isNested ? '500' : '600', color: '#1e293b' }}>{file.original_name}</strong>
              </div>
            </div>
          </td>
        <td>
          <div className="tl-date-time-cell">
            <div>{date}</div>
            <div className="tl-time-text">{time}</div>
          </div>
        </td>
        <td>
          <div className="tl-file-type-badge">{getFileExt(file)}</div>
        </td>
        <td>{formatFileSize(file.file_size)}</td>
        <td>
          <span className={`status-badge status-${getStatusClass(file)}`}>
            {getStatusLabel(file)}
          </span>
        </td>
      </tr>
    )
  }

  const SectionTable = ({ files, isNested = false, level = 0, parentKey = '', parentIsLastArr = [] }) => {
    const { subfolders, rootFiles } = recursiveGroupByPath(files);

    const subfolderEntries = Object.entries(subfolders).sort();
    const totalSubfolders = subfolderEntries.length;
    const totalRootFiles = rootFiles.length;

    return (
      <table className="tl-member-files-table" style={{ margin: 0, tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <tbody>
          {/* 1. Render Subfolders */}
          {subfolderEntries.map(([folderName, folderFiles], index) => {
            const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
            const currentKey = parentKey ? `${parentKey}__${folderName}` : folderName;
            const isExpanded = expandedFolders[currentKey];
            const firstFile = folderFiles[0].file || folderFiles[0];
            const { date, time } = formatDateTime(firstFile.uploaded_at || firstFile.created_at);

            return (
              <React.Fragment key={`folder-${currentKey}`}>
                <tr 
                  className="tl-clickable-row tl-folder-row"
                  onClick={() => toggleFolder(currentKey)}
                  style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : '#ffffff' }}
                >
                  <td>
                    <div className="tl-tree-container" style={{ paddingLeft: '0.75rem' }}>
                      {parentIsLastArr.map((isLastParent, i) => (
                        <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                      ))}
                      {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                      <div className="tl-file-name-cell" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '24px' }}>{isExpanded ? '📂' : '📁'}</div>
                        <strong style={{ fontSize: '14.5px', fontWeight: '600', color: '#1e293b' }}>{folderName}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>({folderFiles.length})</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="tl-date-time-cell">
                      <div>{date}</div>
                      <div className="tl-time-text">{time}</div>
                    </div>
                  </td>
                  <td><div className="tl-file-type-badge">DIR</div></td>
                  <td>-</td>
                  <td>
                    <span className="status-badge status-pending">Folder</span>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan="5" style={{ padding: 0 }}>
                      <SectionTable 
                        files={folderFiles} 
                        isNested={true} 
                        level={level + 1} 
                        parentKey={currentKey} 
                        parentIsLastArr={[...parentIsLastArr, isLast]}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {/* 2. Render root files */}
          {rootFiles.map((item, index) => (
            <FileRow 
              key={item.file?.id || item.id || index} 
              file={item.file || item} 
              isNested={isNested} 
              indentationLevel={level} 
              isLast={index === rootFiles.length - 1} 
              parentIsLastArr={parentIsLastArr}
            />
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
    <div className="tl-modal-overlay" onClick={handleClose}>
      <div
        className="tl-modal-large"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '900px', width: '95%', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        {/* ── Header ── */}
        <div className="tl-modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0 }}>Files by {selectedMember.name}</h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {memberFiles.length} total file{memberFiles.length !== 1 ? 's' : ''}
              {totalFolders > 0 && ` · ${totalFolders} folder${totalFolders !== 1 ? 's' : ''}`}
              {totalIndividual > 0 && ` · ${totalIndividual} individual`}
            </p>
          </div>
          <button onClick={handleClose} style={{ fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* ── Tabs ── */}
        {tabs.length > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 1.5rem',
            flexShrink: 0,
            background: 'var(--bg-primary, #fff)'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.7rem 1.1rem',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.key ? '600' : '400',
                  color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.key ? '2px solid var(--primary-color)' : '2px solid transparent',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {tab.label}
                <span style={{
                  background: activeTab === tab.key ? 'var(--primary-color)' : '#e5e7eb',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '1px 7px',
                  lineHeight: '18px'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div className="tl-modal-body-large" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {isLoading ? (
            <div className="tl-loading">
              <div className="tl-spinner"></div>
              <p>Loading files...</p>
            </div>
          ) : memberFiles.length === 0 && !isLoading ? (
            <div className="tl-empty">
              <div className="tl-empty-icon">📄</div>
              <h3>No files</h3>
              <p>This team member has not uploaded any files yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Performance Section */}
              <div className="performance-section-modal">
                <UserPerformanceCard user={selectedMember} isCollapsible={true} />
              </div>

              {/* ── FOLDERS ── */}
              {displayedFolders.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {displayedFolders.map(folderName => {
                    const files = folderMap[folderName]
                    const isExpanded = expandedFolders[folderName] === true
                    const allApproved = files.every(f => f.status === 'final_approved' || f.status === 'approved')
                    const hasRejected = files.some(f => ['rejected', 'rejected_by_team_leader', 'rejected_by_admin'].includes(f.status))
                    const folderStatusClass = allApproved ? 'approved' : hasRejected ? 'rejected' : 'pending'
                    const folderStatusLabel = allApproved ? 'All Approved' : hasRejected ? 'Has Rejection' : 'Pending'
                    const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0)

                    return (
                      <div key={folderName} style={{
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'white'
                      }}>
                        {/* Folder row */}
                        <div
                          onClick={() => toggleFolder(folderName)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.9rem 1rem',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: 'white',
                            borderBottom: isExpanded ? '1px solid var(--border-color, #e5e7eb)' : 'none',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          {/* Folder icon */}
                          <FileIcon isFolder={true} size="small" />

                          {/* Folder info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {folderName}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                              {files.length} file{files.length !== 1 ? 's' : ''} · {formatFileSize(totalSize)}
                            </div>
                          </div>

                          {/* Chevron */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-secondary)' }}>
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>

                        {/* Expanded file list */}
                        {isExpanded && <SectionTable files={files} isNested={true} parentFolder={folderName} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── INDIVIDUAL FILES ── */}
              {displayedIndividual.length > 0 && (
                <div>
                  {/* Section label only shown when folders also visible */}
                  {displayedFolders.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.6rem'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em'
                      }}>
                        Individual Files
                      </span>
                      <span style={{
                        background: '#e5e7eb',
                        color: 'var(--text-secondary)',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '1px 7px'
                      }}>
                        {displayedIndividual.length}
                      </span>
                    </div>
                  )}
                  <div style={{
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}>
                    <SectionTable files={displayedIndividual} />
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── File Open Modal ── */}
    <FileOpenModal
      isOpen={!!previewFile}
      onClose={() => setPreviewFile(null)}
      onConfirm={() => { openFile(previewFile); setPreviewFile(null) }}
      file={previewFile}
    />
    </>
  )
}

export default MemberFilesModal

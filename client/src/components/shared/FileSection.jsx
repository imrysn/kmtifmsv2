import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Download, FolderOpen, Trash2, Tag, ExternalLink, Info, MoreVertical, Eye, CheckCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { groupFilesByFolder, formatFileSize, formatDate } from '../../utils/ui-helpers';
import { downloadFile, downloadFolder } from '../../utils/file-actions';
import FileIcon from './FileIcon';
import FileViewersButton from './FileViewersButton';
import './FileSection.css';

/**
 * FileSection Component
 * Enhanced to restore "Old Look" features: viewers tracking, explorer actions, and detailed metadata.
 */
const FileSection = ({ 
  files = [], 
  onDeleteFile,
  onFileClick, 
  onDownloadFile,        
  onOpenPath,
  openedFileIds = new Set(),
  isAdmin = false,
  isTL = false,
  assignmentTitle = ''
}) => {
  const { folders, individualFiles } = groupFilesByFolder(files);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [activeMenu, setActiveMenu] = useState(null); // Track which file's menu is open
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  // Close menu on click outside or scroll
  useEffect(() => {
    if (!activeMenu) return;
    const handler = () => setActiveMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [activeMenu]);

  const handleMenuClick = (e, file) => {
    e.stopPropagation();
    if (activeMenu === file.id) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + window.scrollY + 5,
        left: rect.right - 160 // updated dropdown width
      });
      setActiveMenu(file.id);
    }
  };

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const handleDownload = (file) => {
    if (onDownloadFile) {
      onDownloadFile(file);
    } else {
      downloadFile(file, { onToast: (name) => console.log(`Downloaded ${name}`) });
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'uploaded': return 'TASK REFERENCE';
      case 'team_leader_approved': return 'TL APPROVED';
      case 'final_approved': return 'FINAL APPROVED';
      case 'rejected_by_team_leader': return 'REJECTED BY TL';
      case 'rejected_by_admin': return 'REJECTED BY ADMIN';
      default: return status?.toUpperCase() || 'PENDING';
    }
  };

  const renderFileRow = (file, isIndented = false) => {
    // Robust ID comparison (handles Set/Array and String/Number mismatches)
    let isViewed = false;
    if (openedFileIds) {
      if (openedFileIds instanceof Set) {
        isViewed = openedFileIds.has(file.id) || openedFileIds.has(String(file.id)) || openedFileIds.has(Number(file.id));
      } else if (Array.isArray(openedFileIds)) {
        isViewed = openedFileIds.includes(file.id) || openedFileIds.includes(String(file.id)) || openedFileIds.includes(Number(file.id));
      }
    }
    
    const fileExt = file.original_name?.split('.').pop()?.toLowerCase();
    
    return (
      <div 
        key={file.id} 
        className={`legacy-file-row ${isIndented ? 'is-indented' : ''} ${isViewed ? 'viewed' : ''}`}
        onClick={() => onFileClick?.(file)}
      >
        <div className="file-info-main">
          <FileIcon file={file} size="small" />
          <div className="file-details-legacy">
            <div className="file-name-row">
              {isViewed && <CheckCircle size={14} className="file-viewed-icon-check" style={{ color: '#16a34a', flexShrink: 0 }} />}
              <span className="file-name">{file.original_name || file.filename}</span>
              {isViewed && <span className="viewed-badge">✓ Viewed</span>}
            </div>
            
            <div className="file-meta-row">
              {file.submitter_name && (
                <span className="submitter-info">
                  By <span className="submitter-name">{file.submitter_name}</span> • 
                </span>
              )}
              <span className="file-date">{formatDate(file.uploaded_at || file.created_at)}</span>
              <span className="file-size-dot">•</span>
              <span className="file-size">{formatFileSize(file.size || file.file_size)}</span>
              
              {file.tag && (
                <span className="legacy-tag-badge">
                  <Tag size={10} /> {file.tag}
                </span>
              )}
              
              {file.status && (
                <span className={`legacy-file-status-badge ${file.status}`}>
                  {getStatusLabel(file.status)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="file-actions-legacy" onClick={e => e.stopPropagation()}>
          {/* File Viewers Tracking (TL/Admin Feature) - Outside Menu */}
          {(isAdmin || isTL) && (
            <FileViewersButton fileId={file.id} />
          )}

          <button 
            className={`legacy-action-btn menu-trigger ${activeMenu === file.id ? 'active' : ''}`} 
            onClick={(e) => handleMenuClick(e, file)}
            title="Actions"
          >
            <MoreVertical size={16} />
          </button>

          {activeMenu === file.id && createPortal(
            <div 
              className="file-action-dropdown" 
              style={{ top: menuPos.top, left: menuPos.left }}
              onClick={e => e.stopPropagation()}
            >
              <button className="dropdown-item" onClick={() => { setActiveMenu(null); handleDownload(file); }}>
                <Download size={14} /> <span>Download</span>
              </button>

              {onOpenPath && window.electron && (
                <button className="dropdown-item" onClick={() => { setActiveMenu(null); onOpenPath(file); }}>
                  <ExternalLink size={14} /> <span>Show in Folder</span>
                </button>
              )}

              {onDeleteFile && (
                <>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item delete" onClick={() => { setActiveMenu(null); onDeleteFile(file); }}>
                    <Trash2 size={14} /> <span>Delete</span>
                  </button>
                </>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="legacy-file-section">
      {/* Folders */}
      {Object.entries(folders).map(([folderName, folderFiles]) => (
        <div key={folderName} className="legacy-folder-group">
          <div className="legacy-folder-header" onClick={() => toggleFolder(folderName)}>
            <div className="folder-id-section">
              {expandedFolders[folderName] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div className="folder-icon-wrapper">📁</div>
              <div className="folder-text">
                <span className="folder-name">{folderName}</span>
                <span className="folder-meta">{folderFiles.length} files • {folderFiles[0]?.submitter_name || 'Team'}</span>
              </div>
            </div>
            <div className="folder-actions-legacy" onClick={e => e.stopPropagation()}>
              <button 
                className="legacy-action-btn" 
                onClick={() => downloadFolder(folderFiles, folderName, {})}
                title="Download Folder"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
          
          {expandedFolders[folderName] && (
            <div className="legacy-folder-content">
              {folderFiles.map(file => renderFileRow(file, true))}
            </div>
          )}
        </div>
      ))}

      {/* Individual Files */}
      {individualFiles.length > 0 && (
        <div className="legacy-individual-list">
          {individualFiles.map(file => renderFileRow(file))}
        </div>
      )}

      {files.length === 0 && (
        <div className="legacy-empty-state">
          No files available for this section.
        </div>
      )}
    </div>
  );
};

export default FileSection;

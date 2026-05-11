import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Download, FolderOpen, Trash2, Tag, ExternalLink, Info } from 'lucide-react';
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
  onDownloadFile,        // Optional: parent injects modal-gated download
  onOpenPath,
  openedFileIds = new Set(),
  isAdmin = false,
  isTL = false,
  assignmentTitle = ''
}) => {
  const { folders, individualFiles } = groupFilesByFolder(files);
  const [expandedFolders, setExpandedFolders] = useState({});

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
    const isViewed = openedFileIds.has(file.id);
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
          {/* File Viewers Tracking (TL/Admin Feature) */}
          {(isAdmin || isTL) && (
            <FileViewersButton fileId={file.id} />
          )}

          {/* Explorer Path Action (Electron only) */}
          {onOpenPath && window.electron && (
            <button className="legacy-action-btn explorer" onClick={() => onOpenPath(file)} title="Show in Folder">
              <ExternalLink size={14} />
            </button>
          )}

          <button className="legacy-action-btn" onClick={() => handleDownload(file)} title="Download">
            <Download size={14} />
          </button>

          {onDeleteFile && (
            <button className="legacy-action-btn delete" onClick={() => onDeleteFile(file)} title="Delete">
              <Trash2 size={14} />
            </button>
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

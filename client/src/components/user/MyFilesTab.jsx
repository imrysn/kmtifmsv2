import './css/MyFilesTab.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SuccessModal from './SuccessModal';
import FileIcon from '../admin/FileIcon';

const MyFilesTab = ({ 
  filteredFiles,
  isLoading,
  fetchUserFiles,
  formatFileSize,
  files,
  user
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(7);

  // Double-click detection
  const clickTimerRef = useRef(null);
  const lastClickedFileRef = useRef(null);
  const DOUBLE_CLICK_DELAY = 300; // milliseconds

  const openFile = useCallback(async (file) => {
    try {
      if (window.electron && window.electron.openFileInApp) {
        const response = await fetch(`http://localhost:3001/api/files/${file.id}/path`);
        const data = await response.json();
        
        if (data.success && data.filePath) {
          const result = await window.electron.openFileInApp(data.filePath);
          
          if (!result.success) {
            setSuccessModal({
              isOpen: true,
              title: 'Error',
              message: result.error || 'Failed to open file with system application',
              type: 'error'
            });
          }
        } else {
          throw new Error('Could not get file path');
        }
      } else {
        const fileUrl = `http://localhost:3001${file.file_path}`;
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      setSuccessModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to open file. Please try again.',
        type: 'error'
      });
    }
  }, []);

  const handleFileClick = useCallback((file, e) => {
    e.stopPropagation();
    
    // Clear any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Check if this is a double-click (same file clicked twice quickly)
    if (lastClickedFileRef.current === file.id) {
      // Double-click detected - open file
      lastClickedFileRef.current = null;
      openFile(file);
    } else {
      // Single click - just set the reference, don't open modal
      lastClickedFileRef.current = file.id;
      clickTimerRef.current = setTimeout(() => {
        // Reset after delay
        lastClickedFileRef.current = null;
      }, DOUBLE_CLICK_DELAY);
    }
  }, [openFile]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const getStatusDisplayName = useCallback((dbStatus) => {
    if (!dbStatus) return 'Pending';
    
    switch (dbStatus) {
      case 'uploaded':
        return 'Pending Team Leader';
      case 'team_leader_approved':
        return 'Pending Admin';
      case 'final_approved':
        return 'Approved';
      case 'rejected_by_team_leader':
        return 'Rejected by Team Leader';
      case 'rejected_by_admin':
        return 'Rejected by Admin';
      default:
        return 'Pending';
    }
  }, []);

  const getStatusClass = useCallback((status) => {
    switch (status) {
      case 'uploaded':
      case 'team_leader_approved':
        return 'status-pending';
      case 'final_approved':
        return 'status-approved';
      case 'rejected_by_team_leader':
      case 'rejected_by_admin':
        return 'status-rejected';
      default:
        return 'status-default';
    }
  }, []);

  const formatDateTime = useCallback((dateString) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return { date: dateStr, time: timeStr };
  }, []);

  const submittedFiles = useMemo(() => 
    filteredFiles.filter(f => 
      f.status === 'final_approved' || f.status === 'uploaded' || 
      f.status === 'team_leader_approved' || f.status === 'rejected_by_team_leader' || 
      f.status === 'rejected_by_admin'
    ), [filteredFiles]
  );

  const pendingFiles = useMemo(() => 
    submittedFiles.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved'),
    [submittedFiles]
  );

  const approvedFiles = useMemo(() => 
    submittedFiles.filter(f => f.status === 'final_approved'),
    [submittedFiles]
  );

  const rejectedFiles = useMemo(() => 
    submittedFiles.filter(f => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin'),
    [submittedFiles]
  );

  const totalSize = useMemo(() => 
    submittedFiles.reduce((total, file) => total + file.file_size, 0),
    [submittedFiles]
  );

  // Pagination calculations
  const totalPages = useMemo(() => Math.ceil(submittedFiles.length / itemsPerPage), [submittedFiles.length, itemsPerPage]);
  
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return submittedFiles.slice(startIndex, endIndex);
  }, [submittedFiles, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredFiles, itemsPerPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(Number(e.target.value));
  }, []);

  const getPageNumbers = useCallback(() => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="user-my-files-component my-files-wrapper">
      <div className="my-files-header-top">
        {isLoading ? (
          <>
            <div className="header-left">
              <div className="skeleton-box-inline" style={{ height: '32px', width: '140px', marginBottom: '12px', borderRadius: '8px' }} />
              <div className="skeleton-box-inline" style={{ height: '18px', width: '200px', borderRadius: '6px' }} />
            </div>
            
            <div className="stats-row">
              <div className="stat-box-skeleton">
                <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
                <div className="stat-text-skeleton">
                  <div className="skeleton-box-inline" style={{ height: '28px', width: '40px', marginBottom: '8px', borderRadius: '6px' }} />
                  <div className="skeleton-box-inline" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
                </div>
              </div>
              
              <div className="stat-box-skeleton">
                <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
                <div className="stat-text-skeleton">
                  <div className="skeleton-box-inline" style={{ height: '28px', width: '40px', marginBottom: '8px', borderRadius: '6px' }} />
                  <div className="skeleton-box-inline" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
                </div>
              </div>
              
              <div className="stat-box-skeleton">
                <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
                <div className="stat-text-skeleton">
                  <div className="skeleton-box-inline" style={{ height: '28px', width: '40px', marginBottom: '8px', borderRadius: '6px' }} />
                  <div className="skeleton-box-inline" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
                </div>
              </div>
              
              <div className="stat-box-skeleton">
                <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
                <div className="stat-text-skeleton">
                  <div className="skeleton-box-inline" style={{ height: '28px', width: '40px', marginBottom: '8px', borderRadius: '6px' }} />
                  <div className="skeleton-box-inline" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="header-left">
              <h1>My Files</h1>
              <p className="header-subtitle">{submittedFiles.length} files • {formatFileSize(totalSize)} total</p>
            </div>
            
            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-icon">TL</div>
                <div className="stat-text">
                  <div className="stat-number">{pendingFiles.filter(f => f.status === 'uploaded').length}</div>
                  <div className="stat-name">Pending Team Leader</div>
                </div>
              </div>
              
              <div className="stat-box">
                <div className="stat-icon">AD</div>
                <div className="stat-text">
                  <div className="stat-number">{pendingFiles.filter(f => f.status === 'team_leader_approved').length}</div>
                  <div className="stat-name">Pending Admin</div>
                </div>
              </div>
              
              <div className="stat-box">
                <div className="stat-icon">AP</div>
                <div className="stat-text">
                  <div className="stat-number">{approvedFiles.length}</div>
                  <div className="stat-name">Approved Files</div>
                </div>
              </div>
              
              <div className="stat-box">
                <div className="stat-icon">RE</div>
                <div className="stat-text">
                  <div className="stat-number">{rejectedFiles.length}</div>
                  <div className="stat-name">Rejected Files</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="files-table-wrapper">
        {submittedFiles.length > 0 ? (
          <div className="files-list">
            <div className="table-header">
              <div className="col-filename">FILENAME</div>
              <div className="col-datetime">DATE & TIME</div>
              <div className="col-team">TEAM</div>
              <div className="col-status">STATUS</div>
            </div>
            {paginatedFiles.map((file) => {
              const { date, time } = formatDateTime(file.uploaded_at);
              return (
                <div 
                  key={file.id} 
                  className="file-row-new" 
                  onClick={(e) => handleFileClick(file, e)}
                  title="Double click to open file"
                >
                  <div className="col-filename">
                    <FileIcon 
                      fileType={file.original_name.split('.').pop().toLowerCase()} 
                      isFolder={false}
                      size="default"
                      altText={`${file.file_type} file`}
                      style={{
                        width: '44px',
                        height: '44px'
                      }}
                    />
                    <div className="file-text">
                      <div className="filename">{file.original_name}</div>
                      <div className="filesize">{formatFileSize(file.file_size)}</div>
                      <div className="datetime-mobile">
                        <div className="date-label">{date}</div>
                        <div className="time-label">{time}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-datetime">
                    <div className="date-label">{date}</div>
                    <div className="time-label">{time}</div>
                  </div>
                  <div className="col-team">
                    <span className="team-text">{file.user_team}</span>
                  </div>
                  <div className="col-status">
                    <span className={`status-tag ${getStatusClass(file.status)}`}>
                      {getStatusDisplayName(file.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No files found</h3>
            <p>
              {files.length === 0 
                ? "Ready to upload your first file? Click the button above to get started." 
                : "No files match your current search criteria."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {submittedFiles.length > 0 && (
        <div className="pagination-wrapper">
          <div className="pagination-info">
            <span className="pagination-text">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, submittedFiles.length)} of {submittedFiles.length} files
            </span>
            <div className="items-per-page">
              <label htmlFor="itemsPerPage">Show:</label>
              <select 
                id="itemsPerPage"
                value={itemsPerPage} 
                onChange={handleItemsPerPageChange}
                className="items-select"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          
          <div className="pagination-controls">
            <button
              className="pagination-btn pagination-prev"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              <span>‹</span>
            </button>
            
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  className={`pagination-btn pagination-number ${
                    currentPage === page ? 'active' : ''
                  }`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              )
            ))}
            
            <button
              className="pagination-btn pagination-next"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              <span>›</span>
            </button>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />
    </div>
  );
};

export default MyFilesTab;

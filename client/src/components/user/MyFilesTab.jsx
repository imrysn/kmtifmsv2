import './css/MyFilesTab.css';
import { API_BASE_URL } from '@/config/api';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import SuccessModal from './SuccessModal';
import FileOpenModal from '../shared/FileOpenModal';
import { FileIcon } from '../shared';
import { usePagination } from '../../hooks';
import { Trash2 } from 'lucide-react';

const MyFilesTab = ({
  filteredFiles,
  isLoading,
  fetchUserFiles,
  formatFileSize,
  files,
  user
}) => {
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, fileId: null, fileName: '', isFolder: false, folderName: null, folderFiles: [] });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOpenFileModal, setShowOpenFileModal] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);

  // Calculate submittedFiles FIRST (before pagination hook uses it)
  const submittedFiles = useMemo(() =>
    filteredFiles.filter(f =>
      f.status === 'final_approved' || f.status === 'uploaded' ||
      f.status === 'team_leader_approved' || f.status === 'rejected_by_team_leader' ||
      f.status === 'rejected_by_admin' || f.status === 'under_revision'
    ), [filteredFiles]
  );

  // Group files by folder
  const groupFilesByFolder = (files) => {
    const folders = {};
    const individualFiles = [];

    files.forEach(file => {
      if (file.folder_name) {
        if (!folders[file.folder_name]) {
          folders[file.folder_name] = [];
        }
        folders[file.folder_name].push(file);
      } else {
        individualFiles.push(file);
      }
    });

    return { folders, individualFiles };
  };

  // Pagination using custom hook (NOW submittedFiles exists)
  // Load itemsPerPage from localStorage or use default
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('myFilesItemsPerPage');
    return saved ? parseInt(saved, 10) : 10;
  });
  const {
    currentPage,
    paginatedItems: paginatedFiles,
    goToPage,
    canGoNext,
    canGoPrev,
    totalPages,
    startIndex,
    endIndex,
    resetPagination
  } = usePagination(submittedFiles, itemsPerPage);



  const openFile = useCallback(async (file) => {
    try {
      console.log('🔍 openFile called with:', { id: file.id, path: file.file_path, name: file.original_name });
      
      if (window.electron && window.electron.openFileInApp) {
        console.log(`📡 Fetching path for file ID: ${file.id}`);
        const response = await fetch(`${API_BASE_URL}/api/files/${file.id}/path`);
        const data = await response.json();
        console.log('📡 Path response:', data);

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
        const fileUrl = `${API_BASE_URL}${file.file_path}`;
        console.log(`🌐 Opening in browser: ${fileUrl}`);
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
    setFileToOpen(file);
    setShowOpenFileModal(true);
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (fileToOpen) {
      await openFile(fileToOpen);
      setShowOpenFileModal(false);
      setFileToOpen(null);
    }
  }, [fileToOpen, openFile]);

  const getStatusDisplayName = useCallback((dbStatus) => {
    if (!dbStatus) return 'Pending';

    switch (dbStatus) {
      case 'uploaded':
        return 'Pending Team Leader';
      case 'under_revision':
        return 'Revision';
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
      case 'under_revision':
        return 'status-revised';
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

  // Reset to page 1 when filters change or items per page changes
  useEffect(() => {
    resetPagination();
  }, [filteredFiles, itemsPerPage, resetPagination]);

  const handlePageChange = useCallback((page) => {
    goToPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [goToPage]);

  const handleItemsPerPageChange = useCallback((e) => {
    const newValue = Number(e.target.value);
    setItemsPerPage(newValue);
    localStorage.setItem('myFilesItemsPerPage', newValue.toString());
  }, []);

  const handleDeleteClick = useCallback((e, file) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      fileId: file.id,
      fileName: file.original_name,
      isFolder: false,
      folderName: null,
      folderFiles: []
    });
    document.body.style.overflow = 'hidden';
  }, []);

  const handleFolderDeleteClick = useCallback((e, folderName, folderFiles) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      fileId: null,
      fileName: null,
      isFolder: true,
      folderName,
      folderFiles
    });
    document.body.style.overflow = 'hidden';
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.fileId && !deleteModal.isFolder) return;

    setIsDeleting(true);
    try {
      if (deleteModal.isFolder) {
        // Delete all files in folder
        const deletePromises = deleteModal.folderFiles.map(file =>
          fetch(`${API_BASE_URL}/api/files/${file.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              adminId: user.id,
              adminUsername: user.username,
              adminRole: user.role,
              team: user.team
            })
          }).then(res => res.json())
        );

        const results = await Promise.all(deletePromises);
        const allSuccess = results.every(r => r.success);

        if (allSuccess) {
          setSuccessModal({
            isOpen: true,
            title: 'Folder Deleted',
            message: `All ${deleteModal.folderFiles.length} file(s) in "${deleteModal.folderName}" have been successfully deleted.`,
            type: 'success'
          });
          if (fetchUserFiles) await fetchUserFiles();
        } else {
          throw new Error('Failed to delete some files in the folder');
        }
      } else {
        // Delete single file
        const response = await fetch(`${API_BASE_URL}/api/files/${deleteModal.fileId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId: user.id,
            adminUsername: user.username,
            adminRole: user.role,
            team: user.team
          })
        });

        const data = await response.json();

        if (data.success) {
          setSuccessModal({
            isOpen: true,
            title: 'File Deleted',
            message: 'The file has been successfully deleted.',
            type: 'success'
          });
          if (fetchUserFiles) await fetchUserFiles();
        } else {
          throw new Error(data.message || 'Failed to delete file');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setSuccessModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Failed to delete. Please try again.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
      setDeleteModal({ isOpen: false, fileId: null, fileName: '', isFolder: false, folderName: null, folderFiles: [] });
      document.body.style.overflow = '';
    }
  }, [deleteModal, user, fetchUserFiles]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModal({ isOpen: false, fileId: null, fileName: '', isFolder: false, folderName: null, folderFiles: [] });
    document.body.style.overflow = '';
  }, []);

  // Memoize delete modal to prevent re-renders
  const DeleteModal = useMemo(() => {
    if (!deleteModal.isOpen) return null;

    return createPortal(
      <div className="delete-modal-overlay" onClick={handleDeleteCancel}>
        <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-header">
            <div className="delete-icon-wrapper">
              <Trash2 size={28} />
            </div>
            <h2>Delete File</h2>
          </div>
          <div className="delete-modal-body">
            <p className="delete-warning">Are you sure you want to delete this {deleteModal.isFolder ? 'folder' : 'file'}?</p>
            <p className="delete-filename">{deleteModal.isFolder ? deleteModal.folderName : deleteModal.fileName}</p>
            <p className="delete-note">
              {deleteModal.isFolder 
                ? `This will permanently delete all ${deleteModal.folderFiles?.length || 0} file(s) in this folder. This action cannot be undone.`
                : 'This action cannot be undone. The file will be permanently deleted from the system.'}
            </p>
          </div>
          <div className="delete-modal-footer">
            <button
              className="delete-cancel-btn"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="delete-confirm-btn"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className="delete-spinner"></span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete {deleteModal.isFolder ? 'Folder' : 'File'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [deleteModal.isOpen, deleteModal.folderName, deleteModal.fileName, deleteModal.isFolder, deleteModal.folderFiles, isDeleting, handleDeleteCancel, handleDeleteConfirm]);

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
              <div className="col-actions">ACTIONS</div>
            </div>
            {paginatedFiles.map((file) => {
              const { date, time } = formatDateTime(file.uploaded_at);
              return (
                <div
                  key={file.id}
                  className="file-row-new"
                  onClick={(e) => handleFileClick(file, e)}
                  title="Click to open file"
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
                  <div className="col-actions">
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteClick(e, file)}
                      title="Delete file"
                      aria-label="Delete file"
                    >
                      <Trash2 size={18} />
                    </button>
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
              Showing {startIndex + 1} to {endIndex} of {submittedFiles.length} files
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
                <option value={7}>7</option>
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
              disabled={!canGoPrev}
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
                  className={`pagination-btn pagination-number ${currentPage === page ? 'active' : ''
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
              disabled={!canGoNext}
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

      {/* File Open Modal */}
      <FileOpenModal
        isOpen={showOpenFileModal}
        onClose={() => {
          setShowOpenFileModal(false);
          setFileToOpen(null);
        }}
        onConfirm={handleOpenFile}
        file={fileToOpen}
      />

      {/* Custom Delete Confirmation Modal */}
      {DeleteModal}
    </div>
  );
};

export default MyFilesTab;

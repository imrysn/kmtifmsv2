import './css/MyFilesTab.css';
import { apiFetch, API_BASE_URL } from '@/config/api';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import SuccessModal from './SuccessModal';
import { FileIcon, FileOpenModal } from '../shared';
import { usePagination } from '../../hooks';
import { Trash2 } from 'lucide-react';

// Groups files within a top-level folder into their immediate subfolders
import { recursiveGroupByPath } from '@utils/folderUtils'

const MyFilesTab = ({
  filteredFiles,
  isLoading,
  fetchUserFiles,
  formatFileSize,
  files,
  user,
  highlightFileId,
  onClearFileHighlight,
}) => {
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, fileId: null, fileName: '', isFolder: false, folderName: null, folderFiles: [] });
  const [openFileModal, setOpenFileModal] = useState({ isOpen: false, file: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [sortOrder, setSortOrder] = useState('all');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const highlightedRowRef = useRef(null);
  const highlightTimerRef = useRef(null);

  // Cleanup highlight timer on unmount
  useEffect(() => () => clearTimeout(highlightTimerRef.current), []);

  useEffect(() => {
    if (!sortDropdownOpen) return;
    const handler = () => setSortDropdownOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [sortDropdownOpen]);

  // FIX: Added 'revision' and 'pending_team_leader' statuses so files uploaded
  // via tasks (which get status='revision' in bulkUploadFast) appear in My Files.
  const submittedFiles = useMemo(() =>
    filteredFiles.filter(f =>
      f.status === 'final_approved' || f.status === 'uploaded' ||
      f.status === 'team_leader_approved' || f.status === 'rejected_by_team_leader' ||
      f.status === 'rejected_by_admin' || f.status === 'under_revision' ||
      f.status === 'revision' || f.status === 'pending_team_leader' ||
      f.status === 'checked'
    ), [filteredFiles]
  );

  // When highlightFileId changes: find the file, reset filter to 'all', expand its folder,
  // then scroll + pulse-highlight the row.
  useEffect(() => {
    if (!highlightFileId || submittedFiles.length === 0) return;

    const targetFile = submittedFiles.find(f => f.id === parseInt(highlightFileId));
    if (!targetFile) return;

    // Reset status filter so the file is guaranteed to be visible
    setSortOrder('all');

    // If the file is inside a folder, expand that folder
    if (targetFile.folder_name) {
      setExpandedFolders(prev => ({ ...prev, [targetFile.folder_name]: true }));
    }

    // Wait for DOM to settle, then scroll + highlight
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      const el = document.querySelector(`[data-file-id="${highlightFileId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('file-row-highlighted');
        setTimeout(() => {
          el.classList.remove('file-row-highlighted');
          if (onClearFileHighlight) onClearFileHighlight();
        }, 3000);
      }
    }, 300);
  }, [highlightFileId, submittedFiles, onClearFileHighlight]);

  const groupFilesByFolder = useCallback((files) => {
    const folders = {};
    const individualFiles = [];
    for (const file of files) {
      if (file.folder_name) {
        if (!folders[file.folder_name]) folders[file.folder_name] = [];
        folders[file.folder_name].push(file);
      } else {
        individualFiles.push(file);
      }
    }
    return { folders, individualFiles };
  }, []);

  // Build display items FIRST so folders count as 1 row each, then paginate.
  // Without this, a 9-file folder consumed 9 of the 10 per-page slots.
  // Items are sorted by date descending (folders are NOT pinned to top).
  const displayItems = useMemo(() => {
    // Apply status filter before grouping
    const statusFilterMap = {
      all: null,
      pending_tl: (f) => f.status === 'uploaded' || f.status === 'under_revision' || f.status === 'revision' || f.status === 'pending_team_leader',
      pending_admin: (f) => f.status === 'team_leader_approved',
      approved: (f) => f.status === 'final_approved',
      rejected: (f) => f.status === 'rejected_by_team_leader' || f.status === 'rejected_by_admin',
    };
    const filterFn = statusFilterMap[sortOrder];
    const filesToShow = filterFn ? submittedFiles.filter(filterFn) : submittedFiles;

    const { folders, individualFiles } = groupFilesByFolder(filesToShow);
    const items = [];
    Object.keys(folders).forEach(folderName => {
      // Use the most recent file date in the folder as the folder's sort date
      const latestDate = folders[folderName].reduce((latest, f) => {
        const d = new Date(f.uploaded_at);
        return d > latest ? d : latest;
      }, new Date(0));
      items.push({ type: 'folder', folderName, files: folders[folderName], _sortDate: latestDate });
    });
    individualFiles.forEach(file => {
      items.push({ type: 'file', file, _sortDate: new Date(file.uploaded_at) });
    });
    // Sort all items together by date descending
    items.sort((a, b) => b._sortDate - a._sortDate);
    return items;
  }, [submittedFiles, groupFilesByFolder, sortOrder]);

  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('myFilesItemsPerPage');
    return saved ? parseInt(saved, 10) : 10;
  });
  
  const {
    currentPage,
    paginatedItems: paginatedDisplayItems,
    goToPage,
    canGoNext,
    canGoPrev,
    totalPages,
    startIndex,
    endIndex,
    resetPagination
  } = usePagination(displayItems, itemsPerPage);

  const openFile = useCallback(async (file) => {
    setSuccessModal({
      isOpen: true,
      title: 'Success',
      message: 'File opened successfully!',
      type: 'success'
    });

    try {
      if (window.electron?.openFileInApp) {
        const data = await apiFetch(`/api/files/${file.id}/path`);

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
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
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
    setOpenFileModal({ isOpen: true, file });
  }, []);

  const handleOpenFileConfirm = useCallback(async () => {
    if (openFileModal.file && !isOpeningFile) {
      setIsOpeningFile(true);
      await openFile(openFileModal.file);
      setIsOpeningFile(false);
      setOpenFileModal({ isOpen: false, file: null });
    }
  }, [openFileModal.file, openFile, isOpeningFile]);

  const handleOpenFileCancel = useCallback(() => {
    if (isOpeningFile) return;
    setOpenFileModal({ isOpen: false, file: null });
  }, [isOpeningFile]);

  const getStatusDisplayName = useCallback((dbStatus) => {
    if (!dbStatus) return 'Pending';

    const statusMap = {
      'uploaded': 'Pending Team Leader',
      'revision': 'Pending Team Leader',
      'pending_team_leader': 'Pending Team Leader',
      'under_revision': 'Checked - Need to Edit',
      'team_leader_approved': 'Pending Admin',
      'final_approved': 'Approved',
      'rejected_by_team_leader': 'Rejected by Team Leader',
      'rejected_by_admin': 'Rejected by Admin',
      'checked': 'Checked',
    };

    return statusMap[dbStatus] || 'Pending';
  }, []);

  const getStatusClass = useCallback((status) => {
    const classMap = {
      'uploaded': 'status-pending',
      'revision': 'status-pending',
      'pending_team_leader': 'status-pending',
      'team_leader_approved': 'status-pending',
      'under_revision': 'status-revised',
      'final_approved': 'status-approved',
      'rejected_by_team_leader': 'status-rejected',
      'rejected_by_admin': 'status-rejected',
      'checked': 'status-checked',
    };

    return classMap[status] || 'status-default';
  }, []);

  // Compute the folder-level status from all its files
  const getFolderStatus = useCallback((folderFiles) => {
    if (!folderFiles || folderFiles.length === 0) return { label: 'Pending Team Leader', cls: 'status-pending' };

    const statuses = folderFiles.map(f => f.status);
    const allFinalApproved  = statuses.every(s => s === 'final_approved');
    const anyRejected       = statuses.some(s => s === 'rejected_by_team_leader' || s === 'rejected_by_admin');
    const anyPendingTL      = statuses.some(s => s === 'uploaded' || s === 'under_revision' || s === 'revision' || s === 'pending_team_leader');
    const allTLApproved     = statuses.every(s => s === 'team_leader_approved' || s === 'final_approved');
    const allChecked        = statuses.every(s => s === 'checked' || s === 'final_approved' || s === 'team_leader_approved');
    const anyChecked        = statuses.some(s => s === 'checked');

    if (allFinalApproved)  return { label: 'Approved',            cls: 'status-approved' };
    if (anyPendingTL)      return { label: 'Pending Team Leader',  cls: 'status-pending'  };
    if (allTLApproved)     return { label: 'Pending Admin',        cls: 'status-pending'  };
    if (statuses.some(s => s === 'team_leader_approved')) return { label: 'Pending Admin', cls: 'status-pending' };
    if (anyRejected) {
      const hasTLRejection = statuses.some(s => s === 'rejected_by_team_leader');
      return hasTLRejection
        ? { label: 'Rejected by Team Leader', cls: 'status-rejected' }
        : { label: 'Rejected by Admin',       cls: 'status-rejected' };
    }
    if (anyChecked)        return { label: 'Checked',              cls: 'status-checked'  };

    return { label: 'Pending Team Leader', cls: 'status-pending' };
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
    submittedFiles.filter(f => f.status === 'uploaded' || f.status === 'team_leader_approved' || f.status === 'revision' || f.status === 'pending_team_leader'),
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
    submittedFiles.reduce((total, file) => total + (file.file_size || 0), 0),
    [submittedFiles]
  );

  useEffect(() => {
    resetPagination();
  }, [filteredFiles, itemsPerPage, resetPagination]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
        const deletePromises = deleteModal.folderFiles.map(file =>
          apiFetch(`/api/files/${file.id}`, {
            method: 'DELETE',
            body: JSON.stringify({
              adminId: user.id,
              adminUsername: user.username,
              adminRole: user.role,
              team: user.team
            })
          })
        );

        const results = await Promise.all(deletePromises);
        const allSuccess = results.every(r => r.success);

        if (allSuccess) {
          try {
            await apiFetch(`/api/files/folder/delete`, {
              method: 'POST',
              body: JSON.stringify({
                folderName: deleteModal.folderName,
                username: user.username,
                fileIds: deleteModal.folderFiles.map(f => f.id),
                userId: user.id,
                userRole: user.role,
                team: user.team
              })
            });
          } catch (_folderError) {
            // Directory cleanup is best-effort; DB records are already deleted
          }

          // FIX: Use type: 'delete' (red) instead of type: 'success' (green)
          setSuccessModal({
            isOpen: true,
            title: 'Folder Deleted',
            message: `All ${deleteModal.folderFiles.length} file(s) in "${deleteModal.folderName}" have been successfully deleted.`,
            type: 'delete'
          });
          if (fetchUserFiles) await fetchUserFiles();
        } else {
          throw new Error('Failed to delete some files in the folder');
        }
      } else {
        const data = await apiFetch(`/api/files/${deleteModal.fileId}`, {
          method: 'DELETE',
          body: JSON.stringify({
            adminId: user.id,
            adminUsername: user.username,
            adminRole: user.role,
            team: user.team
          })
        });

        if (data.success) {
          // FIX: Use type: 'delete' (red) instead of type: 'success' (green)
          setSuccessModal({
            isOpen: true,
            title: 'File Deleted',
            message: 'The file has been successfully deleted.',
            type: 'delete'
          });
          if (fetchUserFiles) await fetchUserFiles();
        } else {
          throw new Error(data.message || 'Failed to delete file');
        }
      }
    } catch (error) {
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

  const toggleFolder = useCallback((folderName) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  }, []);

  const DeleteModal = useMemo(() => {
    if (!deleteModal.isOpen) return null;

    return createPortal(
      <div className="delete-modal-overlay" onClick={handleDeleteCancel}>
        <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-header">
            <div className="delete-icon-wrapper">
              <Trash2 size={28} />
            </div>
            <h2>Delete {deleteModal.isFolder ? 'Folder' : 'File'}</h2>
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
            <button className="delete-cancel-btn" onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </button>
            <button className="delete-confirm-btn" onClick={handleDeleteConfirm} disabled={isDeleting}>
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

  const renderFileRows = useMemo(() => {
    const items = [];

    paginatedDisplayItems.forEach(displayItem => {
      if (displayItem.type === 'folder') {
        const { folderName, files: folderFiles } = displayItem;
        const isExpanded = expandedFolders[folderName];
        const firstFile = folderFiles[0];
        const { date, time } = formatDateTime(firstFile.uploaded_at);

        items.push(
          <div
            key={`folder-${folderName}`}
            className="file-row-new folder-row"
            onClick={() => toggleFolder(folderName)}
            style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f9fafb' : '#ffffff' }}
          >
            <div className="col-filename">
              <FileIcon
                fileType="folder"
                isFolder={true}
                size="default"
                altText="Folder"
                style={{ width: '48px', height: '48px' }}
              />
              <div className="file-text">
                <div className="filename" style={{ fontWeight: '600', fontSize: '13px' }}>
                  {folderName}
                </div>
                <div className="filesize">
                  {folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="col-datetime">
              <div className="date-label">{date}</div>
              <div className="time-label">{time}</div>
            </div>
            <div className="col-team">
              <span className="team-text">{firstFile.user_team}</span>
            </div>
            <div className="col-status" />
            <div className="col-actions">
              <button
                className="delete-btn"
                onClick={(e) => handleFolderDeleteClick(e, folderName, folderFiles)}
                title="Delete folder"
                aria-label="Delete folder"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        );

        if (isExpanded) {
          const renderRecursiveItems = (files, level = 1, parentKey = '', parentIsLastArr = []) => {
            const { subfolders, rootFiles } = recursiveGroupByPath(files);
            const subItems = [];

            const subfolderEntries = Object.entries(subfolders);
            const totalSubfolders = subfolderEntries.length;
            const totalRootFiles = rootFiles.length;

            subfolderEntries.forEach(([subName, subFiles], index) => {
              const isLast = (index === totalSubfolders - 1) && (totalRootFiles === 0);
              const subKey = parentKey ? `${parentKey}__${subName}` : `${folderName}__${subName}`;
              const isSubOpen = expandedFolders[subKey];
              const subFirstFile = subFiles[0].file || subFiles[0];
              const { date: subDate, time: subTime } = formatDateTime(subFirstFile.uploaded_at);

              subItems.push(
                <React.Fragment key={`subfolder-${subKey}`}>
                  <div
                    className="file-row-new folder-row"
                    onClick={() => setExpandedFolders(prev => ({ ...prev, [subKey]: !prev[subKey] }))}
                    style={{ cursor: 'pointer', backgroundColor: isSubOpen ? '#f0f4ff' : '#f5f7ff' }}
                  >
                    <div className="col-filename">
                      <div className="tl-tree-container">
                        {parentIsLastArr.map((isLastParent, i) => (
                          <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                        ))}
                        {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                        <FileIcon fileType="folder" isFolder={true} size="default" altText="Subfolder" style={{ width: '40px', height: '40px' }} />
                        <div className="file-text">
                          <div className="filename" style={{ fontWeight: '600', fontSize: '13px' }}>{subName}</div>
                          <div className="filesize">{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-datetime">
                      <div className="date-label">{subDate}</div>
                      <div className="time-label">{subTime}</div>
                    </div>
                    <div className="col-team">
                      <span className="team-text">{subFirstFile.user_team}</span>
                    </div>
                    <div className="col-status" />
                    <div className="col-actions" />
                  </div>
                  {isSubOpen && renderRecursiveItems(subFiles, level + 1, subKey, [...parentIsLastArr, isLast])}
                </React.Fragment>
              );
            });

            rootFiles.forEach((fileItem, index) => {
              const isLast = index === totalRootFiles - 1;
              const file = fileItem.file || fileItem;
              const { date: fDate, time: fTime } = formatDateTime(file.uploaded_at);
              subItems.push(
                <div
                  key={file.id}
                  data-file-id={file.id}
                  className="file-row-new"
                onClick={(e) => handleFileClick(file, e)}
            >
                  <div className="col-filename">
                    <div className="tl-tree-container">
                      {parentIsLastArr.map((isLastParent, i) => (
                        <div key={i} className={isLastParent ? "tl-tree-line-empty" : "tl-tree-line-vertical"} />
                      ))}
                      {level > 0 && <div className={`tl-tree-line-connector ${isLast ? 'last-item' : ''}`} />}
                      <FileIcon
                        fileType={file.original_name.split('.').pop().toLowerCase()}
                        isFolder={false}
                        size="default"
                        style={{ width: '40px', height: '40px' }}
                      />
                      <div className="file-text">
                        <div className="filename" style={{ fontSize: '13px' }}>{file.original_name}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-datetime">
                    <div className="date-label">{fDate}</div>
                    <div className="time-label">{fTime}</div>
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
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            });

            return subItems;
          };

          items.push(...renderRecursiveItems(folderFiles, 1, '', []));
        }
      } else {
        const file = displayItem.file;
        const { date, time } = formatDateTime(file.uploaded_at);
        items.push(
          <div
            key={file.id}
            data-file-id={file.id}
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
                style={{ width: '56px', height: '56px' }}
              />
              <div className="file-text">
                <div className="filename">{file.original_name}</div>
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
      }
    });

    return items;
  }, [paginatedDisplayItems, expandedFolders, formatDateTime, toggleFolder, handleFolderDeleteClick, handleFileClick, getStatusClass, getStatusDisplayName, handleDeleteClick, getFolderStatus]);

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
              {[...Array(4)].map((_, i) => (
                <div key={i} className="stat-box-skeleton">
                  <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
                  <div className="stat-text-skeleton">
                    <div className="skeleton-box-inline" style={{ height: '28px', width: '40px', marginBottom: '8px', borderRadius: '6px' }} />
                    <div className="skeleton-box-inline" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="header-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h1>My Files</h1>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSortDropdownOpen(prev => !prev); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      border: '1px solid #d5d5d9',
                      borderRadius: '6px',
                      background: 'white',
                      fontSize: '14px',
                      color: '#1d1d1f',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {sortOrder === 'all' && `All Files (${submittedFiles.length})`}
                    {sortOrder === 'pending_tl' && `Pending Team Leader (${pendingFiles.filter(f => f.status === 'uploaded' || f.status === 'revision' || f.status === 'pending_team_leader').length})`}
                    {sortOrder === 'pending_admin' && `Pending Admin (${pendingFiles.filter(f => f.status === 'team_leader_approved').length})`}
                    {sortOrder === 'approved' && `Approved (${approvedFiles.length})`}
                    {sortOrder === 'rejected' && `Rejected (${rejectedFiles.length})`}
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path d="M1 1.5L6 6.5L11 1.5" stroke="#1d1d1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {sortDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      background: 'white',
                      border: '1px solid #d5d5d9',
                      borderRadius: '8px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      zIndex: 100,
                      minWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      animation: 'sortDropdownIn 0.15s ease',
                    }}>
                      {[
                        { value: 'all', label: `All Files (${submittedFiles.length})` },
                        { value: 'pending_tl', label: `Pending Team Leader (${pendingFiles.filter(f => f.status === 'uploaded' || f.status === 'revision' || f.status === 'pending_team_leader').length})` },
                        { value: 'pending_admin', label: `Pending Admin (${pendingFiles.filter(f => f.status === 'team_leader_approved').length})` },
                        { value: 'approved', label: `Approved (${approvedFiles.length})` },
                        { value: 'rejected', label: `Rejected (${rejectedFiles.length})` },
                      ].map(opt => (
                        <div
                          key={opt.value}
                          onClick={() => { setSortOrder(opt.value); setSortDropdownOpen(false); }}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: sortOrder === opt.value ? 600 : 400,
                            color: sortOrder === opt.value ? '#5856d6' : '#1d1d1f',
                            background: sortOrder === opt.value ? '#f0f0ff' : 'white',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = sortOrder === opt.value ? '#f0f0ff' : '#f5f5f7'}
                          onMouseLeave={e => e.currentTarget.style.background = sortOrder === opt.value ? '#f0f0ff' : 'white'}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="header-subtitle">{submittedFiles.length} files • {formatFileSize(totalSize)} total</p>
            </div>

            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-icon">TL</div>
                <div className="stat-text">
                  <div className="stat-number">{pendingFiles.filter(f => f.status === 'uploaded' || f.status === 'revision' || f.status === 'pending_team_leader').length}</div>
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
            {renderFileRows}
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

      {submittedFiles.length > 0 && (
        <div className="pagination-wrapper">
          <div className="pagination-info">
            <span className="pagination-text">
              Showing {startIndex + 1} to {Math.min(endIndex, displayItems.length)} of {displayItems.length} items
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
                  className={`pagination-btn pagination-number ${currentPage === page ? 'active' : ''}`}
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

      {openFileModal.isOpen && createPortal(
        <FileOpenModal
          isOpen={openFileModal.isOpen}
          onClose={handleOpenFileCancel}
          onConfirm={handleOpenFileConfirm}
          file={openFileModal.file}
          isLoading={isOpeningFile}
        />,
        document.body
      )}

      {DeleteModal}
    </div>
  );
};

export default MyFilesTab;

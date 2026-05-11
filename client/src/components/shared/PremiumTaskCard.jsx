import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, MoreVertical, Send, Download, Trash2, CheckCircle, Eye, Copy, RefreshCcw, Edit2 } from 'lucide-react';
import { formatDate, formatTimeAgo } from '../../utils/ui-helpers';
import { MemberAvatar, PremiumBadge, FileSection, RoleBadge, StatusBadge, FileOpenModal } from './index';
import { openFile, recordFileView } from '../../utils/file-actions';
import './PremiumTaskCard.css';

/**
 * PremiumTaskCard — Unified task card with self-contained three-dot menu.
 * Supports role-based actions and optional hideSubmit for Team Tasks.
 */
const PremiumTaskCard = ({
  task,
  role = 'user',         // 'admin' | 'teamleader' | 'user'
  onCommentClick,
  onActionClick,         // Used for delete, edit, refresh
  onPrimaryClick,        // Submit (user), Review (TL/admin)
  onFileDelete,
  onFileClick,
  onDownloadFile,        // Triggers download confirmation toast/modal
  onOpenPath,
  openedFileIds = new Set(),
  hideSubmit = false,    // Set true on TeamTasksTab
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileToOpen, setFileToOpen] = useState(null);
  const [isOpening, setIsOpening] = useState(false);
  const menuRef = useRef(null);

  const isUser = role === 'user';
  const isTL = role === 'teamleader';
  const isAdmin = role === 'admin';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Status badge (unified style)
  const getStatusBadge = () => {
    if (task.status === 'completed') {
      return <StatusBadge status="completed" size="md" pill />;
    }
    if (task.submitted_files?.length > 0) {
      return <StatusBadge status="submitted" size="md" pill />;
    }
    if (task.due_date) {
      const daysLeft = Math.ceil((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24));
      const isOverdue = daysLeft < 0;
      return (
        <div className={`legacy-due-date ${isOverdue ? 'overdue' : ''}`}>
          Due: {formatDate(task.due_date)}
          <span className={`days-left ${isOverdue ? 'overdue' : daysLeft <= 3 ? 'urgent' : ''}`}>
            {' '}({isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
          </span>
        </div>
      );
    }
    return <StatusBadge status="pending" size="md" pill />;
  };

  const handleFileClickInternal = (file) => {
    setFileToOpen(file);
  };

  const handleConfirmOpenFile = async () => {
    if (!fileToOpen) return;
    setIsOpening(true);
    try {
      await openFile(fileToOpen, {
        onFileOpened: () => {
          setFileToOpen(null);
          // Notify parent if needed (e.g. for recording view in parent state)
          onFileClick?.(fileToOpen);
        },
        onError: (err) => {
          console.error('Failed to open file:', err);
          setFileToOpen(null);
        }
      });
    } finally {
      setIsOpening(false);
    }
  };

  // Role-based three-dot menu items
  const getMenuItems = () => {
    // If the role is 'user', we now hide the three-dot menu entirely
    if (isUser) return [];

    const items = [];

    // Universal Items (for non-users: admin, teamleader)
    items.push({
      label: 'Copy Task Title',
      icon: <Copy size={14} />,
      action: () => {
        navigator.clipboard.writeText(task.title);
        setMenuOpen(false);
      }
    });

    items.push({
      label: 'Refresh Task',
      icon: <RefreshCcw size={14} />,
      action: () => {
        setMenuOpen(false);
        onActionClick?.('refresh', task);
      }
    });

    // Role-Specific: Team Leader
    if (isTL) {
      if (task.status !== 'completed') {
        items.push({
          label: 'Mark as Done',
          icon: <CheckCircle size={14} />,
          action: () => { setMenuOpen(false); onPrimaryClick?.('done', task); }
        });
      }
      items.push({
        label: 'Edit Task',
        icon: <Edit2 size={14} />,
        action: () => { setMenuOpen(false); onActionClick?.('edit', task); }
      });
      items.push({
        label: 'Delete Task',
        icon: <Trash2 size={14} />,
        action: () => { setMenuOpen(false); onActionClick?.('delete', task); },
        className: 'menu-item-danger',
      });
    }

    // Role-Specific: Admin
    if (isAdmin) {
      items.push({
        label: 'Delete Task',
        icon: <Trash2 size={14} />,
        action: () => { setMenuOpen(false); onActionClick?.('delete', task); },
        className: 'menu-item-danger',
      });
    }

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <div className={`legacy-task-card ${className}`}>
      {/* Header */}
      <div className="task-card-header">
        <div className="header-left">
          <div className="header-info">
            <div className="assigned-text-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
              <MemberAvatar
                name={task.team_leader_fullname || task.creator_name || 'TL'}
                size="sm"
                className="header-avatar-inline"
              />
              <div className="assigned-text">
                <span className="leader-name">{task.team_leader_fullname || task.creator_name}</span>
                <RoleBadge role="TEAM_LEADER" size="sm" />
                <span className="assign-action-text"> assigned to </span>
                <span className="members-list-inline">
                  {(() => {
                    const details = task.assigned_member_details || [];
                    if (details.length === 0) {
                      return task.assigned_to === 'all' ? 'All Members' : 'Team';
                    }
                    const names = details.map(m => m.fullName || m.username);
                    if (names.length <= 3) return names.join(', ');
                    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} others`;
                  })()}
                </span>
              </div>
            </div>
            <div className="created-date-aligned">{formatTimeAgo(task.created_at)}</div>
          </div>
        </div>

        <div className="header-right">
          {/* Status badge / Due date - Aligned horizontally with menu */}
          {getStatusBadge()}

          {/* Self-contained three-dot menu */}
          {menuItems.length > 0 && (
            <div className="card-menu-wrapper" ref={menuRef}>
              <button
                className="task-menu-btn"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
                title="More options"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="card-menu-dropdown">
                  {menuItems.map((item, i) => (
                    <button
                      key={i}
                      className={`card-menu-item ${item.className || ''}`}
                      onClick={item.action}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="task-card-body">
        <h3 className="task-title">{task.title}</h3>
        {task.description && (
          <p className="task-description">
            {isExpanded
              ? task.description
              : task.description.length > 200
                ? `${task.description.substring(0, 200)}...`
                : task.description}
            {task.description.length > 200 && (
              <button className="expand-link" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        )}
      </div>

      {/* Files */}
      <div className="task-files-container">
        {task.attachments?.length > 0 && (
          <div className="file-group resources">
            <div className="group-label">📎 Attachments ({task.attachments.length})</div>
            <FileSection
              files={task.attachments}
              assignmentTitle={task.title}
              onFileClick={handleFileClickInternal}
              onDownloadFile={onDownloadFile}
              onOpenPath={onOpenPath}
              openedFileIds={openedFileIds}
              isAdmin={isAdmin}
              isTL={isTL}
            />
          </div>
        )}

        {/* Submit Task Action (User POV) - Below Attachments */}
        {isUser && !hideSubmit && task.status !== 'completed' && (
          <div className="file-group submission-box">
            <div className="group-label submissions-label">📤 Submission</div>
            <div className="submission-upload-area">
              <button
                className="submit-file-btn"
                onClick={() => onPrimaryClick?.('submit', task)}
              >
                <Send size={16} />
                <span>Submit File</span>
              </button>
              <p className="submission-hint">Select a file to complete this task</p>
            </div>
          </div>
        )}

        {task.submitted_files?.length > 0 && (
          <div className="file-group submissions">
            <div className="group-label submissions-label">📤 Submissions ({task.submitted_files.length})</div>
            <FileSection
              files={task.submitted_files}
              isAdmin={isAdmin || isTL}
              isTL={isTL}
              assignmentTitle={task.title}
              onDeleteFile={onFileDelete}
              onFileClick={handleFileClickInternal}
              onDownloadFile={onDownloadFile}
              onOpenPath={onOpenPath}
              openedFileIds={openedFileIds}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="task-card-footer">
        <div className="footer-left">
          <button className="comment-trigger" onClick={() => onCommentClick?.(task)}>
            <MessageSquare size={16} />
            <span>Comments</span>
            <span className="comment-count">{task.comment_count || 0}</span>
          </button>
        </div>

        <div className="footer-right">
          {/* Submit button moved to card body */}
        </div>
      </div>
      <FileOpenModal
        isOpen={!!fileToOpen}
        file={fileToOpen}
        isLoading={isOpening}
        onClose={() => setFileToOpen(null)}
        onConfirm={handleConfirmOpenFile}
      />
    </div>
  );
};

export default PremiumTaskCard;

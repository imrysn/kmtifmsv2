import { useMemo } from 'react'
import './TaskCard.css'
import FileIcon from '../../shared/FileIcon.jsx'

const TaskCard = ({
  assignment,
  authUser,
  isOpeningFile,
  expandedAssignments,
  toggleExpand,
  expandedAttachments,
  toggleAttachments,
  expandedFolders,
  toggleFolder,
  handleOpenFile,
  handleDownloadFile,
  handleDownloadFolder,
  openCommentsModal,
  setShowDeleteModal,
  setAssignmentToDelete,
  showMenuForAssignment,
  setShowMenuForAssignment,
  highlightedAssignmentId,
  highlightedFileId,
  // Actions
  onApproveFile,
  onRejectFile,
  onArchiveTask,
  onMarkDoneTask,
  // Utilities
  getInitials,
  formatDate,
  formatDaysLeft,
  formatDateTime,
  formatFileSize,
  groupFilesByFolder,
  getStatusColor,
  formatTimeAgo
}) => {
  const isHighlighted = highlightedAssignmentId === assignment.id

  const { folders, individualFiles } = useMemo(() => 
    groupFilesByFolder(assignment.recent_submissions || []),
    [assignment.recent_submissions, groupFilesByFolder]
  )

  const folderEntries = Object.entries(folders)
  
  const isTaskCompleted = useMemo(() => {
    if (!assignment.recent_submissions || assignment.recent_submissions.length === 0) return false;
    return assignment.recent_submissions.every(f => f.status === 'final_approved' || f.status === 'APPROVED');
  }, [assignment.recent_submissions]);

  const memberNames = useMemo(() => {
    if (assignment.assigned_to === 'all') return 'all members';
    const memberList = assignment.assigned_member_details || assignment.members || [];
    if (memberList.length === 0) return assignment.team_leader_fullname || assignment.team_leader_username || 'Unknown';
    const names = memberList.map(m => m.fullName || m.username);
    if (names.length === 1) return names[0];
    return `${names.length} members (${names.join(', ')})`;
  }, [assignment.assigned_member_details, assignment.members, assignment.assigned_to, assignment.team_leader_fullname, assignment.team_leader_username]);

  const displayHeaderName = assignment.team_leader_fullname || assignment.team_leader_username || assignment.created_by_username || 'KMTI Admin';

  const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  return (
    <div 
      className={`admin-assignment-card-fidelity ${isHighlighted ? 'highlighted-item' : ''}`}
      data-assignment-id={assignment.id}
    >
      <div className="card-fidelity-header">
        <div className="header-fidelity-left">
          <div className="user-avatar-fidelity">
            {getInitials(displayHeaderName)}
          </div>
          <div className="header-fidelity-info">
            <div className="info-top-line">
              <span className="fidelity-username">{displayHeaderName}</span>
              <span className="role-badge-fidelity">TEAM LEADER</span>
              <span className="assigned-text-fidelity">assigned to <strong>{memberNames}</strong></span>
            </div>
            <div className="info-bottom-line">
              <span className="fidelity-created-at">{formatDateTime(assignment.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="header-fidelity-right">
          {isTaskCompleted ? (
            <div className="completed-badge-fidelity">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Completed
            </div>
          ) : (
            <div className="due-info-fidelity">
              Due: {formatDate(assignment.due_date)} 
              <span 
                className="days-left-fidelity" 
                style={{ color: (new Date(assignment.due_date) < new Date() && assignment.status !== 'completed') ? '#ef4444' : '#22c55e' }}
              >
                ({formatDaysLeft(assignment.due_date)})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card-fidelity-body">
        <h3 className="fidelity-task-title">{assignment.title}</h3>
        <p className="fidelity-task-description">{assignment.description}</p>

        <div className="fidelity-attachments-section">
          {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
            <div className="attachments-container-fidelity">
              <div className="attachments-title-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <span>Submitted Files ({assignment.recent_submissions.length}):</span>
              </div>
              
              <div className="attachments-list-fidelity">
                {individualFiles.map(file => {
                  const isPending = file.status === 'team_leader_approved' || file.current_stage === 'pending_admin';
                  
                  return (
                    <div key={file.id} className="file-card-fidelity" onClick={() => handleOpenFile(file.file_path, file.id)}>
                      <div className="file-card-icon">
                        <FileIcon fileType={file.original_name.split('.').pop()} size="small" />
                      </div>
                      <div className="file-card-details">
                        <div className="file-card-name">{file.original_name}</div>
                        <div className="file-card-meta">
                          Submitted by <span className="submitter-name">{file.fullName || file.username || 'KMTI User'}</span> on {formatDate(file.uploaded_at || file.submitted_at)} 
                          {file.status === 'final_approved' || file.status === 'APPROVED' ? (
                            <span className="fidelity-status-badge approved">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              APPROVED
                            </span>
                          ) : (
                            <span className="fidelity-status-badge pending">PENDING ADMIN</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="file-actions-fidelity">
                        {isPending && (
                          <div className="approval-actions-fidelity">
                            <button 
                              className="approve-btn-mini" 
                              title="Approve File"
                              onClick={(e) => { e.stopPropagation(); onApproveFile(file, assignment.id); }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button 
                              className="reject-btn-mini" 
                              title="Reject File"
                              onClick={(e) => { e.stopPropagation(); onRejectFile(file, assignment.id); }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )}
                        <button className="file-fidelity-download" onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}>
                          <DownloadIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {folderEntries.map(([folderName, folderFiles]) => (
                  <div key={folderName} className="file-card-fidelity folder">
                    <div className="file-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#f1c40f" stroke="#f39c12" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div className="file-card-details">
                      <div className="file-card-name">{folderName}</div>
                      <div className="file-card-meta">Submitted by <span className="submitter-name">KMTI User</span> • {folderFiles.length} files</div>
                    </div>
                    <button className="file-fidelity-download" onClick={(e) => { e.stopPropagation(); handleDownloadFolder(folderFiles, folderName); }}>
                      <DownloadIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-attachments-fidelity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <span>No attachments yet</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-fidelity-footer">
        <div className="comments-fidelity-row" onClick={() => openCommentsModal(assignment)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Comments ({assignment.comment_count || 0})</span>
        </div>
        <div className="menu-fidelity-container">
          <button 
            className="menu-fidelity-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          {showMenuForAssignment === assignment.id && (
            <div className="fidelity-dropdown">
               <button onClick={() => { onEditTask(assignment); setShowMenuForAssignment(null); }}>Edit Task</button>
               <button onClick={() => { onMarkDoneTask(assignment); setShowMenuForAssignment(null); }}>Mark Done</button>
               <button onClick={() => { onArchiveTask(assignment); setShowMenuForAssignment(null); }}>Archive</button>
               <div className="dropdown-divider"></div>
               <button className="delete-action" onClick={() => { setAssignmentToDelete(assignment); setShowDeleteModal(true); setShowMenuForAssignment(null); }}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard

import React, { memo } from 'react'
import FileIcon from '../../shared/FileIcon'
import { getInitials, formatDateTime, formatDate, formatDaysLeft, getStatusColor, getStatusDisplayName } from '../../../utils/adminUtils'

const TaskCard = memo(({
    assignment,
    expandedAssignments,
    toggleExpand,
    expandedAttachments,
    toggleAttachments,
    onDelete,
    onOpenFile,
    showMenuForAssignment,
    setShowMenuForAssignment
}) => {
    return (
        <div className="admin-assignment-card">
            {/* Card Header */}
            <div className="admin-card-header">
                <div className="admin-header-left">
                    <div className="admin-avatar">
                        {getInitials(assignment.team_leader_fullname || assignment.team_leader_username)}
                    </div>
                    <div className="admin-header-info">
                        <div className="admin-assignment-assigned">
                            <span className="admin-team-leader-name">
                                {assignment.team_leader_fullname || assignment.team_leader_username}
                            </span>
                            <span className="role-badge team-leader">TEAM LEADER</span>
                            assigned to{' '}
                            <span className="admin-assigned-user">
                                {assignment.assigned_member_details && assignment.assigned_member_details.length > 0
                                    ? assignment.assigned_member_details.length === 1
                                        ? (assignment.assigned_member_details[0].fullName || assignment.assigned_member_details[0].username)
                                        : `${assignment.assigned_member_details.length} members (${assignment.assigned_member_details.map(m => m.fullName || m.username).join(', ')})`
                                    : assignment.assigned_to === 'all'
                                        ? 'All team members'
                                        : 'Unknown User'}
                            </span>
                        </div>
                        <div className="admin-assignment-created">
                            {assignment.created_at ? formatDateTime(assignment.created_at) : 'Unknown creation date'}
                        </div>
                    </div>
                </div>
                <div className="admin-header-right">
                    <div className="admin-card-menu">
                        <button
                            className="admin-menu-btn"
                            onClick={() => setShowMenuForAssignment(showMenuForAssignment === assignment.id ? null : assignment.id)}
                            title="More options"
                        >
                            ⋮
                        </button>
                        {showMenuForAssignment === assignment.id && (
                            <div className="admin-menu-dropdown">
                                <button
                                    className="admin-menu-item admin-delete-menu-item"
                                    onClick={() => {
                                        onDelete(assignment)
                                        setShowMenuForAssignment(null)
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                    {assignment.due_date && (
                        <div className="admin-due-date">
                            Due: {formatDate(assignment.due_date)}
                            <span
                                className="admin-days-left"
                                style={{ color: getStatusColor(assignment.due_date) }}
                            >
                                {' '}({formatDaysLeft(assignment.due_date)})
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Task Title */}
            <div className="admin-task-title-section">
                <h3 className="admin-assignment-title">{assignment.title}</h3>
            </div>

            {/* Task Description */}
            {assignment.description && (
                <div className="admin-task-description-section">
                    <p className="admin-assignment-description">
                        {expandedAssignments[assignment.id]
                            ? assignment.description
                            : assignment.description.length > 200
                                ? `${assignment.description.substring(0, 200)}...`
                                : assignment.description}
                        {assignment.description.length > 200 && (
                            <button
                                className="admin-expand-btn"
                                onClick={() => toggleExpand(assignment.id)}
                            >
                                {expandedAssignments[assignment.id] ? 'Show less' : 'Show more'}
                            </button>
                        )}
                    </p>
                </div>
            )}

            {/* Attachment */}
            <div className="admin-attachment-section">
                {assignment.recent_submissions && assignment.recent_submissions.length > 0 ? (
                    <div className="admin-attached-file">
                        <div className="admin-file-label">📎 Attachment{assignment.recent_submissions.length > 1 ? 's' : ''} ({assignment.recent_submissions.length}):</div>
                        {(expandedAttachments[assignment.id]
                            ? assignment.recent_submissions
                            : assignment.recent_submissions.slice(0, 5)
                        ).map((file, index) => (
                            <div
                                key={file.id}
                                className="admin-file-item"
                                onClick={() => onOpenFile(file)}
                                style={{
                                    cursor: 'pointer',
                                    marginBottom: index < (expandedAttachments[assignment.id] ? assignment.recent_submissions.length : Math.min(5, assignment.recent_submissions.length)) - 1 ? '8px' : '0'
                                }}
                            >
                                <FileIcon
                                    fileType={file.original_name.split('.').pop()}
                                    size="small"
                                    className="admin-file-icon"
                                />
                                <div className="admin-file-details">
                                    <div className="admin-file-name">
                                        {file.original_name}
                                        {file.status && (
                                            <span className={`admin-file-status ${file.status.toLowerCase().replace(/_/g, '-')}`}>
                                                {getStatusDisplayName(file.status)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="admin-file-meta">
                                        Submitted by <span className="admin-file-submitter">{file.fullName || file.username}</span> on {formatDate(file.submitted_at)}
                                        {file.tag && (
                                            <span className="team-badge" style={{ marginLeft: '8px' }}>
                                                {file.tag}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {assignment.recent_submissions.length > 5 && (
                            <button
                                className="admin-attachment-toggle-btn"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleAttachments(assignment.id)
                                }}
                            >
                                {expandedAttachments[assignment.id] ? 'Show fewer attachments' : `Show all ${assignment.recent_submissions.length} attachments`}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="admin-no-attachment">
                        <span className="admin-no-attachment-icon">⚠️</span>
                        <span className="admin-no-attachment-text">No submissions yet</span>
                    </div>
                )}
            </div>

            {/* Comments Section Trigger */}
            <div className="admin-comments-section">
                <div
                    className="admin-comments-text"
                    onClick={() => toggleExpand(assignment.id)}
                >
                    Comments ({assignment.comment_count || 0})
                </div>
            </div>
        </div>
    )
})

export default TaskCard

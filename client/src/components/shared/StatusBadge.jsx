import React from 'react';

/**
 * StatusBadge - Standardized badge for file and task statuses
 * @param {string} status - The status key from DB
 * @param {string} label - Optional custom label to override default status text
 */
const StatusBadge = ({ status, label, size = 'sm', pill = false, className = '', ...props }) => {
  const normalizeStatus = (status || 'pending').toLowerCase();

  const statusConfig = {
    // File / Submission Statuses
    'uploaded': {
      label: 'Pending Team Leader',
      color: '#f88d00'
    },
    'submitted': {
      label: 'Pending Team Leader',
      color: '#f88d00'
    },
    'edited': {
      label: 'Edited',
      color: '#1d4ed8'
    },
    'team_leader_approved': {
      label: 'Pending Admin',
      color: '#f88d00'
    },
    'final_approved': {
      label: 'Approved',
      color: '#10b981'
    },
    'approved': {
      label: 'Approved',
      color: '#10b981'
    },
    'rejected': {
      label: 'Rejected',
      color: '#ef4444'
    },
    'rejected_by_team_leader': {
      label: 'Rejected by Team Leader',
      color: '#ef4444'
    },
    'rejected_by_admin': {
      label: 'Rejected by Admin',
      color: '#ef4444'
    },
    'final_rejection': {
      label: 'Rejected',
      color: '#ef4444'
    },
    'under_revision': {
      label: 'Revision',
      color: '#1d4ed8'
    },

    // Task / Assignment Statuses
    'pending': {
      label: 'Pending',
      color: '#f88d00'
    },
    'in_progress': {
      label: 'In Progress',
      color: '#1d4ed8'
    },
    'completed': {
      label: 'Completed',
      color: '#10b981'
    },
    'overdue': {
      label: 'Overdue',
      color: '#ef4444'
    },
    'task reference': {
      label: 'Task Reference',
      color: '#1d4ed8'
    }
  };

  const config = statusConfig[normalizeStatus] || {
    label: status || 'Unknown',
    color: '#64748b'
  };

  return (
    <span
      className={`status-badge status-${normalizeStatus.replace(/_/g, '-')} ${size} ${pill ? 'pill' : ''} ${className}`}
      style={{
        padding: size === 'sm' ? '0.05rem 0.35rem' : '0.2rem 0.6rem',
        borderRadius: pill ? '9999px' : '4px',
        fontSize: size === 'sm' ? '10px' : '11px',
        lineHeight: '1.2',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        border: '1px solid',
        backgroundColor: `${config.color}15`,
        borderColor: config.color,
        color: config.color,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        width: 'fit-content',
        minWidth: 'fit-content',
        ...props.style
      }}
      {...props}
    >
      {label || config.label}
    </span>
  );
};

/**
 * FolderStatusSummary - Reusable component to show aggregated status of files in a folder
 * @param {Array} files - List of file objects with status field
 */
export const FolderStatusSummary = ({ files = [], size = 'sm', ...props }) => {
  const counts = {
    pendingTL: 0,
    pendingAdmin: 0,
    rejected: 0,
    approved: 0
  };

  files.forEach(f => {
    const status = f.status;
    if (status === 'uploaded' || status === 'submitted') counts.pendingTL++;
    else if (status === 'team_leader_approved') counts.pendingAdmin++;
    else if (status === 'rejected_by_team_leader' || status === 'rejected_by_admin' || status === 'rejected' || status === 'final_rejection') counts.rejected++;
    else if (status === 'final_approved' || status === 'approved') counts.approved++;
    // Note: 'Task Reference' status is ignored in the summary counts as it is not part of the review process
  });

  const hasAny = counts.pendingTL > 0 || counts.pendingAdmin > 0 || counts.rejected > 0 || counts.approved > 0;
  if (!hasAny) return null;

  return (
    <span className="folder-status-summary-pills" style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', verticalAlign: 'middle', width: 'fit-content' }} {...props}>
      {counts.pendingTL > 0 && (
        <StatusBadge status="uploaded" pill size={size} label={`${counts.pendingTL} Pending Team Leader`} />
      )}
      {counts.pendingAdmin > 0 && (
        <StatusBadge status="team_leader_approved" pill size={size} label={`${counts.pendingAdmin} Pending Admin`} />
      )}
      {counts.rejected > 0 && (
        <StatusBadge status="rejected" pill size={size} label={`${counts.rejected} Rejected`} />
      )}
      {counts.approved > 0 && (
        <StatusBadge status="approved" pill size={size} label={`${counts.approved} Approved`} />
      )}
    </span>
  );
};

export default StatusBadge;

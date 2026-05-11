import React from 'react';

/**
 * StatusBadge - Standardized badge for file and task statuses
 * @param {string} status - The status key from DB
 */
const StatusBadge = ({ status, size = 'sm', pill = false, className = '', ...props }) => {
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
        padding: size === 'sm' ? '0.375rem 0.875rem' : '0.5rem 1rem',
        borderRadius: pill ? '9999px' : '12px',
        fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
        fontWeight: '500',
        display: 'inline-block',
        textAlign: 'center',
        border: '1px solid',
        backgroundColor: 'transparent',
        borderColor: config.color,
        color: config.color,
        whiteSpace: 'nowrap',
        ...props.style
      }}
      {...props}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;

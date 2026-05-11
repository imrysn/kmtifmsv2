import React from 'react';

/**
 * RoleBadge - Standardized badge for user roles
 * @param {string} role - The role key (e.g., 'ADMIN', 'TEAM_LEADER', 'USER')
 */
const RoleBadge = ({ role, size = 'sm', pill = false, className = '', ...props }) => {
  const normalizeRole = (role || 'USER').toUpperCase();

  const roleConfig = {
    'ADMIN': {
      label: 'Admin',
      borderColor: '#dc2626'
    },
    'TEAM_LEADER': {
      label: 'Team Leader',
      borderColor: '#1d4ed8'
    },
    'USER': {
      label: 'User',
      borderColor: '#059669'
    },
    'SYSTEM': {
      label: 'System',
      borderColor: '#000000'
    }
  };

  const config = roleConfig[normalizeRole] || roleConfig['USER'];

  return (
    <span
      className={`role-badge ${normalizeRole.toLowerCase().replace('_', '-')} ${size} ${pill ? 'pill' : ''} ${className}`}
      style={{
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: pill ? '9999px' : '12px',
        fontSize: size === 'sm' ? '0.7rem' : '0.8rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        display: 'inline-block',
        border: '1px solid',
        backgroundColor: 'transparent',
        borderColor: config.borderColor,
        color: config.borderColor,
        ...props.style
      }}
      {...props}
    >
      {config.label}
    </span>
  );
};

export default RoleBadge;

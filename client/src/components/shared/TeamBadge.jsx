import React from 'react';

/**
 * TeamBadge - Standardized badge for team display
 * @param {string} team - The team name
 */
const TeamBadge = ({ team, size = 'sm', pill = false, className = '', ...props }) => {
  const teamName = team || 'N/A';


  return (
    <span
      className={`team-badge ${size} ${pill ? 'pill' : ''} ${className}`}
      style={{
        padding: size === 'sm' ? '0.375rem 0.875rem' : '0.5rem 1rem',
        borderRadius: pill ? '9999px' : '16px',
        fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
        fontWeight: '500',
        display: 'inline-block',
        textAlign: 'center',
        border: '1px solid #000000ff',
        backgroundColor: '#ffffff',
        color: '#101828',
        whiteSpace: 'nowrap',
        ...props.style
      }}
      {...props}
    >
      {teamName}
    </span>
  );
};

export default TeamBadge;

import React from 'react';
import { getInitials } from '../../utils/ui-helpers';
import './MemberAvatar.css';

/**
 * MemberAvatar Component
 * Standardized user avatar using initials or images.
 */
const MemberAvatar = ({ 
  name, 
  role, 
  size = 'md', 
  src, 
  className = '',
  showStatus = false,
  status = 'online'
}) => {
  const initials = getInitials(name);
  
  // Deterministic color based on name
  const colors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
  ];
  
  const charCodeSum = name ? name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) : 0;
  const bgColor = colors[charCodeSum % colors.length];

  const avatarClass = `member-avatar avatar-${size} ${className}`;

  return (
    <div className={avatarClass} style={{ backgroundColor: src ? 'transparent' : bgColor }}>
      {src ? (
        <img src={src} alt={name} className="avatar-img" />
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
      
      {showStatus && <span className={`status-ring status-${status}`} />}
    </div>
  );
};

export default MemberAvatar;

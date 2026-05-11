import React from 'react';
import './PremiumBadge.css';

/**
 * PremiumBadge Component
 * A standardized badge for statuses, roles, and tags.
 * 
 * Variants: primary, secondary, success, warning, danger, info
 */
const PremiumBadge = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  pill = false,
  className = '',
  icon: Icon,
  ...props 
}) => {
  const badgeClass = `premium-badge badge-${variant} badge-${size} ${pill ? 'badge-pill' : ''} ${className}`;

  return (
    <span className={badgeClass} {...props}>
      {Icon && <Icon size={size === 'sm' ? 12 : 14} className="badge-icon" />}
      {children}
    </span>
  );
};

export default PremiumBadge;

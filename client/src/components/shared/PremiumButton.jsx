import React from 'react';
import './PremiumButton.css';

/**
 * PremiumButton Component
 * A highly reusable button with premium animations and states.
 */
const PremiumButton = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading: isLoadingProp = false,
  loading: loadingProp = false,
  isDisabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  ...props
}) => {
  const isLoading = isLoadingProp || loadingProp;
  const buttonClass = `premium-btn btn-${variant} btn-${size} ${isLoading ? 'is-loading' : ''} ${className}`;

  return (
    <button
      className={buttonClass}
      disabled={isDisabled || isLoading}
      {...props}
    >
      {isLoading && <span className="btn-spinner" />}
      
      {!isLoading && Icon && iconPosition === 'left' && (
        <Icon size={size === 'sm' ? 14 : 18} className="btn-icon icon-left" />
      )}
      
      <span className="btn-text">{children}</span>
      
      {!isLoading && Icon && iconPosition === 'right' && (
        <Icon size={size === 'sm' ? 14 : 18} className="btn-icon icon-right" />
      )}
    </button>
  );
};

export default PremiumButton;

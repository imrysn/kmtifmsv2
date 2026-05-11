import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import PremiumButton from './PremiumButton';
import './PremiumModal.css';

/**
 * PremiumModal Component
 * A standardized modal with glassmorphism and smooth transitions.
 */
const PremiumModal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showClose = true,
  closeOnOverlay = true,
  className = '',
  variant = 'default', // 'default', 'danger'
}) => {
  const modalRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalSizeClass = `modal-${size}`;
  const modalVariantClass = `modal-variant-${variant}`;

  return createPortal(
    <div className={`premium-modal-overlay animate-fade-in`} onClick={handleOverlayClick}>
      <div 
        ref={modalRef}
        className={`premium-modal-container ${modalSizeClass} ${modalVariantClass} ${className} glass premium-shadow`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="premium-modal-header">
          <h3 className="premium-modal-title">{title}</h3>
          {showClose && (
            <button className="premium-modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="premium-modal-body custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="premium-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PremiumModal;

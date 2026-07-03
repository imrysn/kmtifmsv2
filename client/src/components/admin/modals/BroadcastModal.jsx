import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/config/api';
import useStore from '../../../store/useStore';

const BroadcastModal = ({ isOpen, onClose, onSuccess }) => {
  const { theme } = useStore();
  const isLight = theme === 'light';

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [targetType, setTargetType] = useState('all'); // 'all' or 'specific'
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Fetch users
      apiFetch('/api/users').then(res => {
        if (res.success && res.users) {
          setUsers(res.users);
        }
      }).catch(err => console.error('Error fetching users:', err));

      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.style.opacity = '1';
          modalRef.current.style.transform = 'translateY(0) scale(1)';
        }
      }, 10);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (modalRef.current) {
      modalRef.current.style.opacity = '0';
      modalRef.current.style.transform = 'translateY(20px) scale(0.95)';
    }
    setTimeout(onClose, 300);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      return newSet;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Message is required.');
      return;
    }

    if (targetType === 'specific' && selectedUserIds.size === 0) {
      setError('Please select at least one user.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ 
          title: 'Announcement', 
          message,
          targetUserIds: targetType === 'specific' ? Array.from(selectedUserIds) : []
        })
      });

      if (response.success) {
        onSuccess(response.count);
        setMessage('');
        handleClose();
      } else {
        setError(response.message || 'Failed to send broadcast');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      setError('An error occurred while sending the broadcast.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div 
        ref={modalRef}
        style={{
          background: isLight 
            ? 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' 
            : 'linear-gradient(145deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: isLight ? '1px solid #e2e8f0' : 'none',
          borderRadius: '24px',
          boxShadow: isLight
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 30px rgba(249, 115, 22, 0.05)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 30px rgba(249, 115, 22, 0.2)',
          width: '100%',
          maxWidth: '500px',
          padding: '0',
          overflow: 'hidden',
          opacity: 0,
          transform: 'translateY(20px) scale(0.95)',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        <div style={{ padding: '32px 32px 24px', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: isLight ? '#0f172a' : '#f8fafc', letterSpacing: '-0.02em' }}>Send Broadcast</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: isLight ? '#64748b' : '#94a3b8' }}>Notify users instantly</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="hide-scrollbar" style={{ padding: '0 32px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {error && (
            <div style={{ 
              marginTop: '24px',
              padding: '12px 16px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ marginRight: '8px', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {/* Target Selection */}
          <div style={{ marginTop: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: isLight ? '#475569' : '#cbd5e1', marginBottom: '8px', fontWeight: '600' }}>Target Audience</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setTargetType('all')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: targetType === 'all' ? 'rgba(249, 115, 22, 0.1)' : (isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)'),
                  border: `1px solid ${targetType === 'all' ? 'rgba(249, 115, 22, 0.5)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`,
                  color: targetType === 'all' ? '#f97316' : (isLight ? '#64748b' : '#94a3b8'),
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                All Users
              </button>
              <button
                type="button"
                onClick={() => setTargetType('specific')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: targetType === 'specific' ? 'rgba(249, 115, 22, 0.1)' : (isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)'),
                  border: `1px solid ${targetType === 'specific' ? 'rgba(249, 115, 22, 0.5)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`,
                  color: targetType === 'specific' ? '#f97316' : (isLight ? '#64748b' : '#94a3b8'),
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Specific Users
              </button>
            </div>
          </div>

          {/* User List for Specific Target */}
          {targetType === 'specific' && (
            <div 
              className="hide-scrollbar"
              style={{ 
              marginTop: '16px', 
              maxHeight: '200px', 
              overflowY: 'auto',
              background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '12px',
              padding: '8px',
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none' // IE/Edge
            }}>
              {users.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>Loading users...</div>
              ) : (
                users.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    style={{
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      background: selectedUserIds.has(u.id) ? (isLight ? 'rgba(249, 115, 22, 0.05)' : 'rgba(255,255,255,0.05)') : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: `1px solid ${selectedUserIds.has(u.id) ? '#f97316' : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.2)')}`,
                      background: selectedUserIds.has(u.id) ? '#f97316' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      {selectedUserIds.has(u.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: isLight ? '#1e293b' : '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>{u.fullName || u.username}</div>
                      <div style={{ color: isLight ? '#64748b' : '#64748b', fontSize: '12px' }}>{u.role}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: isLight ? '#475569' : '#cbd5e1', marginBottom: '8px', fontWeight: '600' }}>Message</label>
            <textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your announcement here..."
              required
              rows={4}
              style={{ 
                width: '100%', 
                padding: '16px', 
                background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.6)', 
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`, 
                borderRadius: '16px', 
                color: isLight ? '#0f172a' : '#f8fafc',
                fontSize: '15px',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: isLight ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : 'inset 0 2px 4px rgba(0,0,0,0.2)',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(249, 115, 22, 0.5)';
                e.target.style.boxShadow = isLight 
                  ? 'inset 0 1px 2px rgba(0,0,0,0.05), 0 0 0 2px rgba(249, 115, 22, 0.1)' 
                  : 'inset 0 2px 4px rgba(0,0,0,0.2), 0 0 0 2px rgba(249, 115, 22, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)';
                e.target.style.boxShadow = isLight ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : 'inset 0 2px 4px rgba(0,0,0,0.2)';
              }}
            />
          </div>
          
          <div style={{ 
            padding: '16px 0 32px', 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px' 
          }}>
            <button 
              type="button" 
              onClick={handleClose} 
              disabled={isLoading}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: isLight ? '#64748b' : '#cbd5e1',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => !isLoading && (e.target.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => !isLoading && (e.target.style.background = 'transparent')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading || !message.trim() || (targetType === 'specific' && selectedUserIds.size === 0)}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: (isLoading || !message.trim() || (targetType === 'specific' && selectedUserIds.size === 0)) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !message.trim() || (targetType === 'specific' && selectedUserIds.size === 0)) ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && message.trim() && (targetType === 'all' || selectedUserIds.size > 0)) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && message.trim()) {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="16" height="16">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Broadcast Now
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default BroadcastModal;

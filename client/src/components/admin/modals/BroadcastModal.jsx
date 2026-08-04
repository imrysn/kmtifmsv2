import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiFetch, API_BASE_URL } from '@/config/api';
import useStore from '../../../store/useStore';
import Avatar from '@/components/shared/Avatar';
import FullscreenImageViewer from '@/components/shared/FullscreenImageViewer';

// ── Memoized message item ─────────────────────────────────────────────────────
// Extracted from inline JSX so the expensive regex only runs when the message
// content actually changes — not on every parent re-render.
const MessageItem = React.memo(function MessageItem({ reply, isLight, currentUserRole, onMarkRead, onDelete }) {
  // Parse message content once per message change — NOT on every parent render
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const { text, images } = useMemo(() => {
    const rawMessage = (reply.message || '')
      .replace(/.*replied to your broadcast:\n\n"/, '')
      .replace(/"$/, '');

    const images = [];
    const matchRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = matchRegex.exec(rawMessage)) !== null) {
      const src = match[1].startsWith('/') ? `${API_BASE_URL}${match[1]}` : match[1];
      images.push(src);
    }
    
    // Remove all image markdown from text
    const text = rawMessage.replace(/!\[.*?\]\((.*?)\)/g, '').trim();
    
    return { text, images };
  }, [reply.message]);

  const isUnread = reply.is_read === 0 || !reply.is_read;
  const senderName = reply.action_by_username || (currentUserRole === 'ADMIN' ? 'A user' : 'Admin');

  return (
    <div
      key={reply.id}
      onClick={() => isUnread && onMarkRead(reply.id)}
      style={{
        padding: '12px',
        marginBottom: '8px',
        background: isUnread
          ? (isLight ? 'rgba(234, 88, 12, 0.05)' : 'rgba(234, 88, 12, 0.15)')
          : (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)'),
        border: isUnread
          ? `1px solid ${isLight ? 'rgba(234, 88, 12, 0.2)' : 'rgba(234, 88, 12, 0.3)'}`
          : `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '8px',
        cursor: isUnread ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {isUnread && (
        <div style={{ position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar
            user={{
              id: reply.action_by_id || (currentUserRole === 'ADMIN' ? '0' : '1'),
              username: senderName,
              fullName: senderName,
              role: reply.action_by_role || (currentUserRole === 'ADMIN' ? 'USER' : 'ADMIN'),
              profile_picture: reply.action_by_profile_picture
            }}
            size="sm"
          />
          <div style={{ color: '#f97316', fontSize: '13px', fontWeight: '600' }}>{senderName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: '#64748b', fontSize: '11px' }}>{new Date(reply.created_at).toLocaleString()}</div>
          <button
            type="button"
            onClick={(e) => onDelete(reply.id, e)}
            title="Delete message"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div style={{ color: isLight ? '#334155' : '#cbd5e1', fontSize: '14px', lineHeight: '1.6', paddingLeft: '48px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {text && <div style={{ marginBottom: images.length > 0 ? '12px' : '0' }}>{text}</div>}
        
        {images.length > 0 && (
          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '-24px' }}>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img 
                src={images[currentSlide]} 
                alt={`Attachment ${currentSlide + 1}`} 
                loading="lazy"
                decoding="async"
                onClick={() => setFullScreenImage(images[currentSlide])}
                style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`, objectFit: 'contain', display: 'block', cursor: 'pointer' }} 
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '8px',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'white',
                      transition: 'background 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '8px',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'white',
                      transition: 'background 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>

                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}>
                    {currentSlide + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {fullScreenImage && (
        <FullscreenImageViewer 
          imageUrl={fullScreenImage} 
          onClose={() => setFullScreenImage(null)} 
        />
      )}
    </div>
  );
});



const BroadcastModal = ({ isOpen, onClose, onSuccess, onReplyRead }) => {
  const { theme, user } = useStore();
  const isLight = theme === 'light';

  const [message, setMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [replies, setReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [targetType, setTargetType] = useState('all'); // 'all', 'specific', or 'replies'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const modalRef = useRef(null);
  const repliesLoaded = useRef(false); // prevent redundant fetches on every tab switch

  // Memoized filtered lists — avoid re-filtering on every render (e.g. while typing)
  const adminRepliesList = useMemo(() => replies, [replies]);
  const broadcastHistoryList = useMemo(
    () => replies.filter(r => r.title !== 'Message from Admin' && r.type !== 'broadcast_reply'),
    [replies]
  );
  const messageHistoryList = useMemo(
    () => replies.filter(r => r.title === 'Message from Admin' || r.type === 'broadcast_reply'),
    [replies]
  );
  const unreadAdminCount = useMemo(() => replies.filter(r => r.is_read === 0 || !r.is_read).length, [replies]);
  const unreadBroadcastHistoryCount = useMemo(
    () => broadcastHistoryList.filter(r => r.is_read === 0 || !r.is_read).length,
    [broadcastHistoryList]
  );
  const unreadMessageHistoryCount = useMemo(
    () => messageHistoryList.filter(r => r.is_read === 0 || !r.is_read).length,
    [messageHistoryList]
  );
  // Derive the active list for the current tab
  const activeRepliesList = useMemo(() => {
    if (user?.role === 'ADMIN') return adminRepliesList;
    if (targetType === 'broadcast_history') return broadcastHistoryList;
    return messageHistoryList;
  }, [user?.role, targetType, adminRepliesList, broadcastHistoryList, messageHistoryList]);
  // Filtered users for the search box
  const filteredUsers = useMemo(
    () => users.filter(u => (u.fullName || u.username).toLowerCase().includes(searchQuery.toLowerCase())),
    [users, searchQuery]
  );

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
      setTargetType('all');
      setMessage('');
      setImagePreviews([]);
      setSearchQuery('');
      setSelectedUserIds(new Set());
      setReplies([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset repliesLoaded when modal closes so next open re-fetches
  useEffect(() => {
    if (!isOpen) {
      repliesLoaded.current = false;
    }
  }, [isOpen]);

  // Fetch messages immediately when the modal opens and silently poll every 3 seconds while open.
  // This ensures that if the modal is already open when a new message arrives via SSE,
  // the messages list and badges automatically update without the user needing to close and reopen.
  useEffect(() => {
    if (!isOpen || !user) return;

    let controller = new AbortController();

    const fetchMessages = async () => {
      // Only show the loading spinner on the very first fetch
      if (!repliesLoaded.current) {
        setIsLoadingReplies(true);
      }
      
      const fetchType = user.role === 'ADMIN' ? 'broadcast_reply' : 'broadcast_history';
      
      try {
        const res = await apiFetch(`/api/notifications/user/${user.id}/broadcasts?limit=50&type=${fetchType}`, { signal: controller.signal });
        if (res.success && res.notifications) {
          setReplies(res.notifications);
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching replies:', err);
      } finally {
        setIsLoadingReplies(false);
        repliesLoaded.current = true;
      }
    };

    // Initial fetch
    fetchMessages();

    // Silent background poll every 3 seconds
    const intervalId = setInterval(fetchMessages, 3000);

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, [isOpen, user]);



  if (!isOpen) return null;

  const handleClose = () => {
    if (modalRef.current) {
      modalRef.current.style.opacity = '0';
      modalRef.current.style.transform = 'translateY(20px) scale(0.95)';
    }
    setTimeout(onClose, 300);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          hasImage = true;
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreviews(prev => [...prev, reader.result]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
    if (hasImage) {
      e.preventDefault();
    }
  };

  // We use a useEffect to listen to paste events globally while the modal is open
  useEffect(() => {
    if (!isOpen) return;
    
    const globalHandlePaste = (e) => {
      // Ignore if pasting directly into an input or textarea (they handle their own onPaste)
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', globalHandlePaste);
    return () => window.removeEventListener('paste', globalHandlePaste);
  }, [isOpen]);

  const handleMarkAsRead = useCallback((replyId) => {
    const reply = replies.find(r => r.id === replyId);
    if (!reply || reply.is_read === 1) return;

    // Optimistically update UI
    setReplies(prev => prev.map(r => r.id === replyId ? { ...r, is_read: 1 } : r));

    // Call API
    apiFetch(`/api/notifications/${replyId}/read`, { method: 'PUT' })
      .then(() => {
        if (typeof onReplyRead === 'function') {
          onReplyRead();
        }
      })
      .catch(err => {
        console.error('Error marking reply as read:', err);
      });
  }, [replies, onReplyRead]);

  const handleDeleteReply = (replyId, e) => {
    e.stopPropagation(); // Prevent marking as read when clicking delete
    setMessageToDelete(replyId);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    setIsDeletingMessage(true);
    
    try {
      const response = await apiFetch(`/api/notifications/${messageToDelete}`, {
        method: 'DELETE'
      });
      if (response.success) {
        setReplies(prev => prev.filter(r => r.id !== messageToDelete));
      } else {
        console.error('Failed to delete message:', response.message);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    } finally {
      setIsDeletingMessage(false);
      setMessageToDelete(null);
    }
  };

  const toggleUserSelection = useCallback((userId) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) newSet.delete(userId);
      else newSet.add(userId);
      return newSet;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() && imagePreviews.length === 0) {
      setError('Message or image is required.');
      return;
    }

    if (targetType === 'specific' && selectedUserIds.size === 0) {
      setError('Please select at least one user.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', user.role === 'ADMIN' 
        ? (targetType === 'specific' ? 'Message from Admin' : 'Announcement') 
        : `Message from ${user.username || 'User'}`);
      formData.append('message', message);
      
      if (targetType === 'specific') {
        formData.append('targetUserIds', JSON.stringify(Array.from(selectedUserIds)));
      }
      
      if (imagePreviews.length > 0) {
        formData.append('imagesBase64', JSON.stringify(imagePreviews));
      }
      
      console.log('--- FORM DATA ---');
      console.log('title:', formData.get('title'));
      console.log('message:', formData.get('message'));
      console.log('imagesBase64 count:', imagePreviews.length);

      const response = await apiFetch('/api/notifications/broadcast', {
        method: 'POST',
        body: formData
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

  const executeClearAllReplies = async () => {
    try {
      let deleteType = 'broadcast_history';
      if (user?.role === 'ADMIN') deleteType = 'broadcast_reply';
      else if (targetType === 'broadcast_history') deleteType = 'broadcast_announcements';
      else if (targetType === 'message_history') deleteType = 'broadcast_messages';

      const res = await apiFetch(`/api/notifications/user/${user.id}/delete-all?type=${deleteType}`, {
        method: 'DELETE'
      });
      if (res.success) {
        if (user?.role === 'ADMIN') {
          setReplies([]);
        } else {
          // Remove only the messages of the current tab from the replies array
          if (targetType === 'broadcast_history') {
            setReplies(prev => prev.filter(r => r.title === 'Message from Admin' || r.type === 'broadcast_reply'));
          } else if (targetType === 'message_history') {
            setReplies(prev => prev.filter(r => r.title !== 'Message from Admin' && r.type !== 'broadcast_reply'));
          }
        }
        setShowConfirmClear(false);
      } else {
        setError('Failed to clear messages');
      }
    } catch (err) {
      console.error('Error clearing messages:', err);
      setError('An error occurred while clearing messages');
    }
  };

  const handleClearAllReplies = () => {
    setShowConfirmClear(true);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(15, 23, 42, 0.6)',
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
        <div style={{ padding: '24px 32px 16px', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{
              background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22">
                <path d="M 75.8,20.4 86.4,12.7 89.2,21.5 Z" fill="#64748b"/>
                <path d="M 85.1,38.9 97.4,32.3 98.4,41.9 Z" fill="#64748b"/>
                <path d="M 86.6,56.8 98.9,56.1 97.1,65.3 Z" fill="#64748b"/>
                <path d="M 78.5,72.4 88.0,79.5 81.3,86.6 Z" fill="#64748b"/>
                <path d="M 33.1,69.5 41.5,89.2 C 43.1,93.0 48.0,91.2 46.5,87.6 L 39.5,71.1 Z" fill="#cbd5e1"/>
                <path d="M 23.3,46.9 C 10.1,51.8 11.4,70.9 25.1,73.1 L 34.0,70.0 L 29.5,45.0 Z" fill="#dc2626"/>
                <path d="M 26.5,45.5 C 38.0,38.0 49.5,25.0 59.8,27.5 C 70.1,30.0 73.1,65.0 63.8,70.5 C 54.5,76.0 42.0,70.0 31.5,71.0 Z" fill="#e2e8f0"/>
                <ellipse cx="61.5" cy="49" rx="11" ry="24" fill="#64748b" transform="rotate(-12 61.5 49)"/>
                <ellipse cx="60" cy="49" rx="5" ry="12" fill="#ffffff" transform="rotate(-12 60 49)"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: isLight ? '#0f172a' : '#f8fafc', letterSpacing: '-0.02em' }}>
                {user.role === 'ADMIN' ? 'Send Broadcast' : 'Report Admin'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: isLight ? '#64748b' : '#94a3b8' }}>
                {user.role === 'ADMIN' ? 'Notify users instantly' : 'Send a direct message to the admin team'}
              </p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
          <div className="hide-scrollbar" style={{ padding: '0 32px', overflowY: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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

          {/* Target Selection / Tab Toggle */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: isLight ? '#475569' : '#cbd5e1', marginBottom: '8px', fontWeight: '600' }}>
              {user.role === 'ADMIN' ? 'Target Audience' : 'Action'}
            </label>
            <div style={{ 
              display: 'inline-flex', 
              background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '8px', 
              padding: '3px',
              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}`
            }}>
              {user.role === 'ADMIN' ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setTargetType('all'); setError(''); }}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'all' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'all' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'all' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'all' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('specific'); setError(''); }}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'specific' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'specific' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'specific' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'specific' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Specific Users
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('replies'); setError(''); }}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'replies' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'replies' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'replies' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'replies' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Messages
                    {unreadAdminCount > 0 && (
                      <span style={{
                        background: '#ea580c',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        lineHeight: '1'
                      }}>
                        {unreadAdminCount}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'all' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'all' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'all' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'all' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Send Message
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('broadcast_history'); setError(''); }}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'broadcast_history' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'broadcast_history' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'broadcast_history' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'broadcast_history' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Broadcast History
                    {unreadBroadcastHistoryCount > 0 && (
                      <span style={{
                        background: '#ea580c',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        lineHeight: '1'
                      }}>
                        {unreadBroadcastHistoryCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('message_history'); setError(''); }}
                    style={{
                      padding: '6px 16px',
                      background: targetType === 'message_history' ? (isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: targetType === 'message_history' ? '#ea580c' : (isLight ? '#64748b' : '#94a3b8'),
                      fontWeight: targetType === 'message_history' ? '600' : '500',
                      fontSize: '13px',
                      boxShadow: targetType === 'message_history' ? (isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.4)') : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Message History
                    {unreadMessageHistoryCount > 0 && (
                      <span style={{
                        background: '#ea580c',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        lineHeight: '1'
                      }}>
                        {unreadMessageHistoryCount}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          {/* User List for Specific Target */}
          {targetType === 'specific' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                    background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                    color: isLight ? '#1e293b' : '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f97316';
                    e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.1)';
                    e.target.style.background = isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.6)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)';
                    e.target.style.boxShadow = 'none';
                    e.target.style.background = isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)';
                  }}
                />
              </div>
              <div 
                className="hide-scrollbar"
                style={{ 
                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '12px',
                padding: '8px',
              }}>
                {users.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>Loading users...</div>
                ) : (
                  filteredUsers.map(u => (
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
                      <div style={{ marginRight: '12px' }}>
                        <Avatar user={u} size="sm" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isLight ? '#1e293b' : '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>{u.fullName || u.username}</div>
                        <div style={{ color: isLight ? '#64748b' : '#64748b', fontSize: '12px' }}>{u.role}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Replies List */}
          {(targetType === 'replies' || targetType === 'broadcast_history' || targetType === 'message_history') && (
            <div style={{ marginTop: '16px' }}>
              {!isLoadingReplies && activeRepliesList.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={handleClearAllReplies}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Clear All Messages
                  </button>
                </div>
              )}
              
              <div 
                className="hide-scrollbar"
                style={{ 
                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '12px',
                padding: '12px',
              }}>
                {isLoadingReplies ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>Loading replies...</div>
                ) : activeRepliesList.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    <div>No messages yet.</div>
                  </div>
                ) : (
                  <>
                    {activeRepliesList.map(reply => (
                      <MessageItem
                        key={reply.id}
                        reply={reply}
                        isLight={isLight}
                        currentUserRole={user?.role}
                        onMarkRead={handleMarkAsRead}
                        onDelete={handleDeleteReply}
                      />
                    ))}
                    {/* Spacer to fix WebKit scroll padding bug causing the last item's bottom to be clipped */}
                    <div style={{ height: '12px', width: '100%', flexShrink: 0 }}></div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {targetType !== 'replies' && targetType !== 'broadcast_history' && targetType !== 'message_history' && (
            <div style={{ marginTop: '20px', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', color: isLight ? '#475569' : '#cbd5e1', marginBottom: '8px', fontWeight: '600' }}>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                placeholder="Type your message here... (You can also paste images)"
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '16px',
                  background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.5)',
                  border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px',
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
              
              {imagePreviews.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                      <img 
                        src={preview} 
                        alt={`Preview ${idx + 1}`} 
                        onClick={() => setFullScreenImage(preview)}
                        style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '8px', border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`, objectFit: 'cover', cursor: 'pointer' }} 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                        }}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  cursor: 'pointer',
                  color: isLight ? '#64748b' : '#94a3b8',
                  fontSize: '13px',
                  padding: '6px 12px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  Attach Image
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreviews(prev => [...prev, reader.result]);
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = ''; // Reset input to allow selecting the same file again
                    }}
                  />
                </label>
              </div>
            </div>
          )}
          
          </div>
          
          <div style={{ 
            padding: '16px 32px 24px', 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px',
            borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
            background: 'transparent',
            flexShrink: 0
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
              {(targetType === 'replies' || targetType === 'broadcast_history' || targetType === 'message_history') ? 'Close' : 'Cancel'}
            </button>
            {targetType !== 'replies' && targetType !== 'broadcast_history' && targetType !== 'message_history' && (
              <button 
                type="submit" 
                disabled={isLoading || (!message.trim() && imagePreviews.length === 0) || (targetType === 'specific' && selectedUserIds.size === 0)}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isLoading || (!message.trim() && imagePreviews.length === 0) || (targetType === 'specific' && selectedUserIds.size === 0)) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || (!message.trim() && imagePreviews.length === 0) || (targetType === 'specific' && selectedUserIds.size === 0)) ? 0.7 : 1,
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
                    {user.role === 'ADMIN' ? (targetType === 'specific' ? 'Send' : 'Broadcast Now') : 'Send Message'}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Custom Confirmation Modal */}
      {showConfirmClear && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
          borderRadius: '24px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: isLight ? '#ffffff' : '#1e293b',
            border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '16px',
            padding: '24px',
            width: '85%',
            maxWidth: '320px',
            boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.1)' : '0 10px 25px rgba(0,0,0,0.5)',
            textAlign: 'center',
            animation: 'scaleUp 0.2s ease'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#ef4444" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '18px', color: isLight ? '#0f172a' : '#f8fafc' }}>Clear All Messages</h4>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: isLight ? '#64748b' : '#94a3b8' }}>
              Are you sure you want to permanently delete all messages? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                  color: isLight ? '#475569' : '#cbd5e1',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearAllReplies}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {!!messageToDelete && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
          borderRadius: '24px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: isLight ? '#ffffff' : '#1e293b',
            border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '16px',
            padding: '24px',
            width: '85%',
            maxWidth: '320px',
            boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.1)' : '0 10px 25px rgba(0,0,0,0.5)',
            textAlign: 'center',
            animation: 'scaleUp 0.2s ease'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#ef4444" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '18px', color: isLight ? '#0f172a' : '#f8fafc' }}>Delete Message</h4>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: isLight ? '#64748b' : '#94a3b8' }}>
              Are you sure you want to permanently delete this message? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => !isDeletingMessage && setMessageToDelete(null)}
                disabled={isDeletingMessage}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                  color: isLight ? '#475569' : '#cbd5e1',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeletingMessage ? 'not-allowed' : 'pointer',
                  opacity: isDeletingMessage ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMessage}
                disabled={isDeletingMessage}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeletingMessage ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  opacity: isDeletingMessage ? 0.7 : 1
                }}
              >
                {isDeletingMessage ? 'Processing...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer for Draft Attachments */}
      {fullScreenImage && (
        <FullscreenImageViewer 
          imageUrl={fullScreenImage} 
          onClose={() => setFullScreenImage(null)} 
        />
      )}
    </div>
  );
};

export default BroadcastModal;

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiFetch, API_BASE_URL } from '../../config/api';
import useStore from '../../store/useStore';
import './Avatar.css';

/**
 * Avatar — Displays the user's profile picture or initials fallback.
 *
 * Interaction (editable=true):
 *   • If no photo  → hover shows a camera icon overlay; click anywhere on circle → file picker
 *   • If has photo → hover splits circle into two halves:
 *       top half (camera)  → click → file picker (change photo)
 *       bottom half (trash) → click → remove photo
 *
 * All interactive elements stay INSIDE the circle so they work
 * correctly inside overflow:hidden containers (like the sidebar).
 */
const Avatar = ({ user, size = 'md', editable = false, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef              = useRef(null);
  const updateUser                = useStore((s) => s.updateUser);

  /* ── helpers ─────────────────────────────────────────── */
  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getHue = (fullName) => {
    if (!fullName) return 220;
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  };

  const buildImageUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  /* ── upload ───────────────────────────────────────────── */
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const data = await apiFetch('/api/users/profile/picture', {
        method: 'POST',
        body: formData,
      });

      if (data.success) {
        const baseUrl = data.profilePictureUrl.split('?')[0];
        const freshUrl = `${baseUrl}?t=${Date.now()}`;
        updateUser({ profile_picture: freshUrl });
        if (onUpdate) onUpdate(freshUrl);
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
      setShowModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [updateUser, onUpdate]);

  /* ── remove ───────────────────────────────────────────── */
  const handleRemove = useCallback(async (e) => {
    e.stopPropagation();
    setUploading(true);
    setError(null);

    try {
      const data = await apiFetch('/api/users/profile/picture', { method: 'DELETE' });
      if (data.success) {
        updateUser({ profile_picture: null });
        if (onUpdate) onUpdate(null);
      }
    } catch (err) {
      setError(err.message || 'Remove failed');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
      setShowModal(false);
    }
  }, [updateUser, onUpdate]);

  /* ── derived ──────────────────────────────────────────── */
  const hasPhoto = !!user?.profile_picture;
  const initials = getInitials(user?.fullName);
  const hue      = getHue(user?.fullName);
  const imageUrl = hasPhoto ? buildImageUrl(user.profile_picture) : null;

  /* ── render ───────────────────────────────────────────── */
  return (
    <div className={`av-root av-${size} ${editable ? 'av-editable' : ''}`}>

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {/* ── Circle ── */}
      <div
        className={`av-circle ${uploading ? 'av-uploading' : ''}`}
        style={{ '--av-hue': hue }}
      >
        {/* Initials fallback (always rendered behind image to act as a placeholder while loading) */}
        <span className="av-initials">
          {initials}
        </span>

        {hasPhoto && (
          <img
            src={imageUrl}
            alt={user?.fullName || 'Profile'}
            className="av-img"
            onLoad={(e) => {
              e.target.style.display = 'block';
            }}
            onError={(e) => {
              // fallback if image fails to load
              e.target.style.display = 'none';
            }}
          />
        )}

        {/* Spinner overlay while uploading (hidden from main avatar if modal is open, since modal will handle it) */}
        {uploading && !showModal && (
          <div className="av-spinner-overlay">
            <div className="av-spinner" />
          </div>
        )}

        {/* ── Editable hover overlay ── */}
        {editable && !uploading && (
          <div
            className="av-overlay av-overlay-full"
            onClick={() => setShowModal(true)}
            title="Edit photo"
          >
            {/* Pencil icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* ── Modal Portal ── */}
      {showModal && ReactDOM.createPortal(
        <div className="av-modal-backdrop" onClick={() => !uploading && setShowModal(false)}>
          <div className="av-modal-content" onClick={(e) => e.stopPropagation()}>
            {uploading && (
              <div className="av-modal-uploading-overlay">
                <div className="av-spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
                <span style={{ marginTop: '12px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Uploading...</span>
              </div>
            )}
            
            <div className="av-modal-header">
              <h3>Profile Picture</h3>
              <button className="av-modal-close" onClick={() => !uploading && setShowModal(false)} disabled={uploading}>✕</button>
            </div>
            <div className="av-modal-body">
              {/* Modal Avatar Preview */}
              <div className="av-modal-preview">
                <div className="av-circle av-modal-preview-circle" style={{ '--av-hue': hue }}>
                  <span className="av-initials">{initials}</span>
                  {hasPhoto && (
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="av-img"
                      onLoad={(e) => { e.target.style.display = 'block'; }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>

              <button className={`av-modal-btn av-btn-primary ${uploading ? 'btn-loading' : ''}`} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                {hasPhoto ? 'Change Photo' : 'Upload Photo'}
              </button>
              {hasPhoto && (
                <button className={`av-modal-btn av-btn-danger ${uploading ? 'btn-loading' : ''}`} disabled={uploading} onClick={handleRemove}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Inline error */}
      {error && <div className="av-error-inline">{error}</div>}
    </div>
  );
};

export default Avatar;

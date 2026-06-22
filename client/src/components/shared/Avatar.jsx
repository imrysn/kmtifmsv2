import { useState, useRef, useCallback } from 'react';
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
        const freshUrl = `${data.profilePictureUrl}?t=${Date.now()}`;
        updateUser({ profile_picture: freshUrl });
        if (onUpdate) onUpdate(freshUrl);
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
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

        {/* Photo */}
        {hasPhoto && (
          <img
            src={imageUrl}
            alt={user?.fullName || 'Profile'}
            className="av-img"
            onError={(e) => {
              // fallback if image fails to load
              e.target.style.display = 'none';
            }}
          />
        )}

        {/* Spinner overlay while uploading */}
        {uploading && (
          <div className="av-spinner-overlay">
            <div className="av-spinner" />
          </div>
        )}

        {/* ── Editable hover overlays (both inside the circle) ── */}
        {editable && !uploading && !hasPhoto && (
          /* No photo: full circle = click to upload */
          <div
            className="av-overlay av-overlay-full"
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo"
          >
            {/* Camera icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        )}

        {editable && !uploading && hasPhoto && (
          /* Has photo: split top (change) / bottom (remove) */
          <>
            {/* Top half — change photo */}
            <div
              className="av-overlay av-overlay-top"
              onClick={() => fileInputRef.current?.click()}
              title="Change photo"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            {/* Bottom half — remove photo */}
            <div
              className="av-overlay av-overlay-bottom"
              onClick={handleRemove}
              title="Remove photo"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Inline error */}
      {error && <div className="av-error-inline">{error}</div>}
    </div>
  );
};

export default Avatar;

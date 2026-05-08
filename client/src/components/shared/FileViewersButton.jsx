import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch, API_BASE_URL } from '@/config/api'

/**
 * FileViewersButton
 * Eye icon button that shows a popover listing everyone who has viewed a file.
 * Usage: <FileViewersButton fileId={file.id} />
 */
const FileViewersButton = ({ fileId, size = 14, externalCount }) => {
  const [viewers, setViewers] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(null)

  // Use externalCount when provided (instant update from parent)
  const displayCount = externalCount !== undefined ? externalCount : (count ?? 0)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const popoverRef = useRef(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 })

  // Close popover when clicking outside (works with portal)
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      const clickedInsideBtn = ref.current && ref.current.contains(e.target)
      const clickedInsidePopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!clickedInsideBtn && !clickedInsidePopover) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Reposition popover on scroll or resize
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        setPopoverPos({
          top: rect.bottom + window.scrollY + 4,
          right: window.innerWidth - rect.right,
        })
      }
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  // Fetch count on mount
  useEffect(() => {
    if (!fileId) return
    apiFetch(`${API_BASE_URL}/api/files/${fileId}/views`)
      .then(d => { if (d.success) setCount(d.viewers?.length ?? 0) })
      .catch(() => {})
  }, [fileId])

  const fetchViewers = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/files/${fileId}/views`)
      if (data.success) {
        setViewers(data.viewers || [])
        setCount(data.viewers?.length ?? 0)
      }
    } catch {}
    setLoading(false)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (!open) {
      fetchViewers()
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        setPopoverPos({
          top: rect.bottom + window.scrollY + 4,
          right: window.innerWidth - rect.right,
        })
      }
    }
    setOpen(v => !v)
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRoleColor = (role) => {
    if (!role) return '#6b7280'
    const r = role.toUpperCase()
    if (r.includes('ADMIN')) return '#7c3aed'
    if (r.includes('TEAM_LEADER')) return '#1d4ed8'
    return '#059669'
  }

  const getRoleLabel = (role) => {
    if (!role) return 'User'
    const r = role.toUpperCase()
    if (r.includes('ADMIN')) return 'Admin'
    if (r.includes('TEAM_LEADER')) return 'Team Leader'
    return 'User'
  }

  // Displayed name: prefer full_name, fallback to username
  const getDisplayName = (v) => v.full_name || v.username || 'Unknown'

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleClick}
        title={displayCount > 0 ? `${displayCount} view${displayCount !== 1 ? 's' : ''} — click to see who` : 'No views yet'}
        style={{
          background: open ? '#f0fdf4' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          width: `${size + 14}px`,
          height: `${size + 14}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: open ? '#16a34a' : displayCount > 0 ? '#16a34a' : '#9ca3af',
          flexShrink: 0,
          transition: 'all 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = '#f0fdf4'
          e.currentTarget.style.color = '#16a34a'
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = displayCount > 0 ? '#16a34a' : '#9ca3af'
          }
        }}
      >
        {/* Eye icon */}
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        {/* Viewer count badge */}
        {displayCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '1px',
            right: '1px',
            background: '#16a34a',
            color: '#fff',
            fontSize: '9px',
            fontWeight: '700',
            borderRadius: '8px',
            minWidth: '14px',
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {displayCount > 99 ? '99+' : displayCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
          position: 'absolute',
          top: `${popoverPos.top}px`,
          right: `${popoverPos.right}px`,
          zIndex: 99999,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          minWidth: '240px',
          maxWidth: '300px',
          padding: '12px',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            marginBottom: '10px', paddingBottom: '8px',
            borderBottom: '1px solid #f3f4f6'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
              Viewed by{!loading && viewers.length > 0 ? ` (${viewers.length})` : ''}
            </span>
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: '#9ca3af', fontSize: '13px' }}>
              Loading...
            </div>
          ) : viewers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 6px', display: 'block' }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>No views yet</div>
            </div>
          ) : (
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {viewers.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 0',
                    borderBottom: i < viewers.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  {/* Avatar circle with initials */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: getRoleColor(v.role),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '11px', fontWeight: '700', flexShrink: 0,
                    letterSpacing: '0.5px',
                  }}>
                    {getInitials(getDisplayName(v))}
                  </div>

                  {/* Name + username + role + time */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Full name (big, bold) */}
                    <div style={{
                      fontSize: '13px', fontWeight: '700', color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {getDisplayName(v)}
                    </div>

                    {/* Username (if different from full_name) */}
                    {v.username && v.full_name && v.username !== v.full_name && (
                      <div style={{
                        fontSize: '11px', color: '#6b7280',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginTop: '1px',
                      }}>
                        @{v.username}
                      </div>
                    )}

                    {/* Role badge + time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: '600',
                        color: getRoleColor(v.role),
                        background: `${getRoleColor(v.role)}18`,
                        padding: '2px 7px', borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {getRoleLabel(v.role)}
                      </span>
                      {v.viewed_at && (
                        <>
                          <span style={{ fontSize: '10px', color: '#d1d5db' }}>·</span>
                          <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {formatTime(v.viewed_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default FileViewersButton

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch, API_BASE_URL } from '@/config/api'
import useStore from '../../store/useStore'

const PING_INTERVAL = 30000 // 30s heartbeat
const MEMBERS_REFRESH_INTERVAL = 60000 // refresh full member list every 60s

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  '#7c3aed', '#1d4ed8', '#059669', '#dc2626',
  '#d97706', '#0891b2', '#be185d', '#4f46e5'
]

const getAvatarColor = (name = '') => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * OnlineMembersPanel
 * Shows ALL team members with real-time online/offline status via SSE.
 * Props:
 *   user       — current logged-in user
 *   teamFilter — if set, only shows members of this team
 */
const OnlineMembersPanel = ({ user, teamFilter }) => {
  const [open, setOpen] = useState(false)
  // allMembers: full list from DB with online:true/false
  const [allMembers, setAllMembers] = useState([])
  // onlineIds: Set of userId strings currently online (from SSE)
  const onlineIdsRef = useRef(new Set())
  const [, forceUpdate] = useState(0)
  const [connected, setConnected] = useState(false)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })
  const esRef = useRef(null)
  const reconnectTimer = useRef(null)

  // ── Fetch all members from DB with current online status ──────────────────────
  const fetchMembers = useCallback(async () => {
    if (!user?.id) return
    try {
      const params = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : ''
      const data = await apiFetch(`/api/presence/members${params}`)
      if (data.success) {
        setAllMembers(data.members || [])
        // Sync onlineIds from the fresh server snapshot
        const ids = new Set((data.members || []).filter(m => m.online).map(m => m.userId))
        onlineIdsRef.current = ids
        forceUpdate(n => n + 1)
      }
    } catch { }
  }, [user, teamFilter])

  // ── Heartbeat ping ────────────────────────────────────────────────────────
  const ping = useCallback(async () => {
    if (!user?.id) return
    try {
      await apiFetch('/api/presence/ping', {
        method: 'POST',
        body: JSON.stringify({ team: user.team || teamFilter || null })
      })
    } catch { }
  }, [user, teamFilter])

  // ── SSE connection ────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (!user?.id) return
    const { token } = useStore.getState()
    const url = `${API_BASE_URL}/api/presence/stream${token ? `?token=${token}` : ''}`

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      // Ping immediately on SSE open so we're in the store before the
      // server sends the first snapshot — this is what makes us appear instantly
      ping()
    }

    es.onmessage = (event) => {
      if (!event.data || event.data === 'ping') return
      try {
        const { online } = JSON.parse(event.data)
        // Update onlineIds from SSE push, then re-apply to allMembers
        const ids = new Set(
          (online || [])
            .filter(u => !teamFilter || u.team === teamFilter)
            .map(u => u.userId)
        )
        onlineIdsRef.current = ids
        // Update allMembers online flags in-place and re-sort
        setAllMembers(prev => {
          const updated = prev.map(m => ({ ...m, online: ids.has(m.userId) }))
          updated.sort((a, b) => {
            if (a.online !== b.online) return a.online ? -1 : 1
            return (a.fullName || a.username).localeCompare(b.fullName || b.username)
          })
          return updated
        })
      } catch { }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      reconnectTimer.current = setTimeout(connectSSE, 5000)
    }
  }, [user, teamFilter, ping])

  // Init: ping → fetch members → connect SSE
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const init = async () => {
      await ping()              // register ourselves first
      await fetchMembers()     // load full list with online flags
      if (!cancelled) connectSSE()
    }
    init()

    // sendBeacon fires reliably on tab close / browser kill where fetch cannot
    const handleUnload = () => {
      const { token } = useStore.getState()
      if (token) {
        navigator.sendBeacon(
          `${API_BASE_URL}/api/presence/ping?_method=DELETE&token=${token}`,
          new Blob([], { type: 'application/json' })
        )
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', handleUnload)
      if (esRef.current) esRef.current.close()
      clearTimeout(reconnectTimer.current)
      const { token } = useStore.getState()
      if (token) {
        apiFetch('/api/presence/ping', { method: 'DELETE' }).catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat ping every 30s
  useEffect(() => {
    const interval = setInterval(ping, PING_INTERVAL)
    return () => clearInterval(interval)
  }, [ping])

  // Refresh full member list every 60s (picks up newly added users)
  useEffect(() => {
    const interval = setInterval(fetchMembers, MEMBERS_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchMembers])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const handleToggle = () => {
    setOpen(v => !v)
  }

  // Recalculate panel position after button expands (open state changes DOM size)
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPanelPos({
        top: rect.bottom + window.scrollY + 12,
        right: window.innerWidth - rect.right,
      })
    }
  }, [open])

  const onlineCount = allMembers.filter(m => m.online).length
  const totalCount = allMembers.length

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger Button */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Online Members"
        style={{
          display: 'flex', alignItems: 'center', gap: open ? '8px' : '0',
          background: open ? '#f0fdf4' : 'transparent',
          border: open ? '1.5px solid #86efac' : 'none',
          borderRadius: '999px',
          padding: open ? '5px 12px 5px 6px' : '0',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: open ? '0 0 0 3px #bbf7d040' : 'none',
        }}
      >
        {/* Avatar with status dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: getAvatarColor(user?.fullName || user?.username),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '13px', fontWeight: '700',
            boxShadow: open ? 'none' : '0 0 0 2px #e5e7eb',
            transition: 'box-shadow 0.2s'
          }}>
            {getInitials(user?.fullName || user?.username)}
          </div>
          <span style={{
            position: 'absolute', bottom: '1px', right: '1px',
            width: '10px', height: '10px', borderRadius: '50%',
            background: connected ? '#22c55e' : '#9ca3af',
            border: '2px solid #fff',
            transition: 'background 0.3s'
          }} />
        </div>
        {/* Name + status — only when open */}
        {open && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>
              {user?.fullName || user?.username}
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', color: connected ? '#16a34a' : '#9ca3af' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#22c55e' : '#9ca3af', display: 'inline-block', transition: 'background 0.3s' }} />
              {connected ? 'Online' : 'Connecting...'}
            </div>
          </div>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: `${panelPos.top}px`,
            right: `${panelPos.right}px`,
            zIndex: 99999,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            minWidth: '260px',
            maxWidth: '300px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', gap: '7px'
          }}>
            {/* Pulsing green dot */}
            <span style={{ position: 'relative', display: 'inline-flex', width: '10px', height: '10px', flexShrink: 0 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#22c55e', opacity: 0.4,
                animation: 'presencePulse 1.8s ease-in-out infinite'
              }} />
              <span style={{ position: 'relative', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
            </span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
              Online Members ({onlineCount}/{totalCount})
            </span>
            {/* Live indicator */}
            <span style={{
              marginLeft: 'auto', fontSize: '9.5px', fontWeight: '700',
              color: '#16a34a', background: '#dcfce7',
              padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.3px'
            }}>LIVE</span>
          </div>

          {/* Members list */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px 0' }}>
            {allMembers.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No members found
              </div>
            ) : (
              allMembers.map((member) => (
                <div
                  key={member.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 16px',
                    background: member.userId === String(user?.id) ? '#f0fdf4' : 'transparent',
                    opacity: member.online ? 1 : 0.65,
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => {
                    if (member.userId !== String(user?.id))
                      e.currentTarget.style.background = '#f9fafb'
                  }}
                  onMouseLeave={e => {
                    if (member.userId !== String(user?.id))
                      e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Avatar + status dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: getAvatarColor(member.fullName || member.username),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '12px', fontWeight: '700',
                    }}>
                      {getInitials(member.fullName || member.username)}
                    </div>
                    <span style={{
                      position: 'absolute', bottom: '1px', right: '1px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: member.online ? '#22c55e' : '#9ca3af',
                      border: '2px solid #fff',
                      transition: 'background 0.3s'
                    }} />
                  </div>

                  {/* Name + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: '600', color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      {member.fullName || member.username}
                      {member.userId === String(user?.id) && (
                        <span style={{
                          fontSize: '9.5px', fontWeight: '600', color: '#16a34a',
                          background: '#dcfce7', padding: '1px 5px', borderRadius: '4px', flexShrink: 0
                        }}>You</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: member.online ? '#16a34a' : '#9ca3af',
                      fontWeight: '500',
                      display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px'
                    }}>
                      <span style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: member.online ? '#22c55e' : '#9ca3af',
                        display: 'inline-block'
                      }} />
                      {member.online ? 'Active now' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
        </div>,
        document.body
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes presencePulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default OnlineMembersPanel

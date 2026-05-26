const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query: dbQuery } = require('../config/database');

// In-memory presence store: userId -> { userId, username, fullName, role, team, lastSeen }
const presenceStore = new Map();
const ONLINE_THRESHOLD_MS = 35 * 1000; // 35 seconds — user drops offline quickly after missing a heartbeat

// SSE clients: Set of res objects
const sseClients = new Set();

// ── Broadcast updated online list to all SSE clients ─────────────────────────
function broadcastOnlineUsers() {
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  const online = [];
  for (const data of presenceStore.values()) {
    if (data.lastSeen >= cutoff) online.push(data);
  }
  online.sort((a, b) => b.lastSeen - a.lastSeen);

  const payload = `data: ${JSON.stringify({ online, count: online.length })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Cleanup stale entries every 30s and broadcast if anything changed
setInterval(() => {
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  let changed = false;
  for (const [userId, data] of presenceStore.entries()) {
    if (data.lastSeen < cutoff) {
      presenceStore.delete(userId);
      changed = true;
    }
  }
  if (changed) broadcastOnlineUsers();
}, 30 * 1000);

// ── GET /api/presence/stream — real-time SSE stream ──────────────────────────
router.get('/stream', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send current online list immediately on connect
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  const online = [];
  for (const data of presenceStore.values()) {
    if (data.lastSeen >= cutoff) online.push(data);
  }
  online.sort((a, b) => b.lastSeen - a.lastSeen);
  res.write(`data: ${JSON.stringify({ online, count: online.length })}\n\n`);

  sseClients.add(res);

  // Keepalive every 25s to prevent proxy/firewall timeouts
  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepalive); }
  }, 25000);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(keepalive);
  });
});

// ── POST /api/presence/ping — heartbeat OR sendBeacon offline signal ────────
router.post('/ping', authenticateToken, (req, res) => {
  // navigator.sendBeacon() can only POST. Detect ?_method=DELETE as offline signal.
  if (req.query._method === 'DELETE') {
    const { id: userId } = req.user;
    const wasOnline = presenceStore.has(String(userId));
    presenceStore.delete(String(userId));
    if (wasOnline) broadcastOnlineUsers();
    return res.json({ success: true });
  }

  const { id: userId, username, fullName, role } = req.user;
  const { team } = req.body;

  presenceStore.set(String(userId), {
    userId: String(userId),
    username,
    fullName,
    role,
    team: team || null,
    lastSeen: Date.now()
  });

  // Always broadcast — ensures reconnects and new logins appear instantly for all viewers
  broadcastOnlineUsers();

  res.json({ success: true });
});

// ── DELETE /api/presence/ping — explicit offline ──────────────────────────────
router.delete('/ping', authenticateToken, (req, res) => {
  const { id: userId } = req.user;
  const wasOnline = presenceStore.has(String(userId));
  presenceStore.delete(String(userId));
  if (wasOnline) broadcastOnlineUsers();
  res.json({ success: true });
});

// ── GET /api/presence/members — all members with online/offline status ────────
// Returns every user in a team (from DB) merged with their presence status.
// Query params:
//   team  — filter by team name (required for TEAM_LEADER, optional for ADMIN)
router.get('/members', authenticateToken, asyncHandler(async (req, res) => {
  const { team } = req.query;
  const { role } = req.user;
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

  // Build the SQL query
  let members;
  if (team) {
    members = await dbQuery(
      `SELECT id, fullName, username, role, team FROM users WHERE team = ? ORDER BY fullName`,
      [team]
    );
  } else if (role === 'ADMIN') {
    members = await dbQuery(
      `SELECT id, fullName, username, role, team FROM users ORDER BY fullName`
    );
  } else {
    return res.status(400).json({ success: false, message: 'team parameter required' });
  }

  // Merge with presence store
  const result = (members || []).map(m => {
    const presence = presenceStore.get(String(m.id));
    const isOnline = presence && presence.lastSeen >= cutoff;
    return {
      userId: String(m.id),
      username: m.username,
      fullName: m.fullName,
      role: m.role,
      team: m.team,
      online: isOnline,
      lastSeen: presence ? presence.lastSeen : null,
    };
  });

  // Online first, then offline alphabetically
  result.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (a.fullName || a.username).localeCompare(b.fullName || b.username);
  });

  res.json({ success: true, members: result, count: result.length });
}));

router.get('/online', authenticateToken, (req, res) => {
  const { team } = req.query;
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

  let online = [];
  for (const data of presenceStore.values()) {
    if (data.lastSeen >= cutoff) online.push(data);
  }
  if (team) online = online.filter(u => u.team === team);
  online.sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({ success: true, online, count: online.length });
});

module.exports = router;

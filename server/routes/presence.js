const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query: dbQuery } = require('../config/database');

const ONLINE_THRESHOLD_MS = 35 * 1000; // 35 seconds — user drops offline quickly after missing a heartbeat

// SSE clients: Set of res objects
const sseClients = new Set();

// ── Broadcast updated online list to all SSE clients ─────────────────────────
async function broadcastOnlineUsers() {
  try {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

    // Fetch currently online users directly from DB
    const onlineUsers = await dbQuery(
      'SELECT id as userId, username, fullName, role, team, last_seen as lastSeen FROM users WHERE last_seen >= ? ORDER BY last_seen DESC',
      [cutoff]
    );

    // Ensure types match what the frontend expects
    const online = onlineUsers.map(u => ({
      ...u,
      userId: String(u.userId)
    }));

    const payload = `data: ${JSON.stringify({ online, count: online.length })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  } catch (err) {
    console.error('❌ Error broadcasting online users:', err.message);
  }
}

// Cleanup stale entries every 15s and broadcast if anyone changed state
// With DB-driven presence, we must poll to see if other server instances updated presence
setInterval(() => {
  if (sseClients.size > 0) {
    broadcastOnlineUsers();
  }
}, 15 * 1000);

// ── GET /api/presence/stream — real-time SSE stream ──────────────────────────
router.get('/stream', authenticateToken, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  sseClients.add(res);

  // Send current online list immediately on connect
  try {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
    const onlineUsers = await dbQuery(
      'SELECT id as userId, username, fullName, role, team, last_seen as lastSeen FROM users WHERE last_seen >= ? ORDER BY last_seen DESC',
      [cutoff]
    );
    const online = onlineUsers.map(u => ({ ...u, userId: String(u.userId) }));
    res.write(`data: ${JSON.stringify({ online, count: online.length })}\n\n`);
  } catch (err) {
    // Ignore initial fetch error
  }

  // Keepalive every 25s to prevent proxy/firewall timeouts
  const keepalive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepalive);
    }
  }, 25000);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(keepalive);
  });
});

// ── POST /api/presence/ping — heartbeat OR sendBeacon offline signal ────────
router.post('/ping', authenticateToken, asyncHandler(async (req, res) => {
  const { id: userId } = req.user;

  // navigator.sendBeacon() can only POST. Detect ?_method=DELETE as offline signal.
  if (req.query._method === 'DELETE') {
    await dbQuery('UPDATE users SET last_seen = 0 WHERE id = ?', [userId]);
    broadcastOnlineUsers();
    return res.json({ success: true });
  }

  await dbQuery('UPDATE users SET last_seen = ? WHERE id = ?', [Date.now(), userId]);

  // Always broadcast — ensures reconnects and new logins appear instantly for all viewers
  broadcastOnlineUsers();

  res.json({ success: true });
}));

// ── DELETE /api/presence/ping — explicit offline ──────────────────────────────
router.delete('/ping', authenticateToken, asyncHandler(async (req, res) => {
  const { id: userId } = req.user;
  await dbQuery('UPDATE users SET last_seen = 0 WHERE id = ?', [userId]);
  broadcastOnlineUsers();
  res.json({ success: true });
}));

// ── GET /api/presence/members — all members with online/offline status ────────
// Returns every user in a team (from DB) merged with their presence status.
// Query params:
//   team  — filter by team name (required for TEAM_LEADER, optional for ADMIN)
router.get('/members', authenticateToken, asyncHandler(async (req, res) => {
  const { team } = req.query;
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

  // Build the SQL query
  let members;
  if (team) {
    members = await dbQuery(
      'SELECT id, fullName, username, role, team, profile_picture, last_seen FROM users WHERE team = ? ORDER BY fullName',
      [team]
    );
  } else {
    members = await dbQuery(
      'SELECT id, fullName, username, role, team, profile_picture, last_seen FROM users ORDER BY fullName'
    );
  }

  const result = (members || []).map(m => {
    const isOnline = m.last_seen >= cutoff;
    return {
      userId: String(m.id),
      username: m.username,
      fullName: m.fullName,
      role: m.role,
      team: m.team,
      profile_picture: m.profile_picture,
      online: isOnline,
      lastSeen: m.last_seen || null
    };
  });

  // Online first, then offline alphabetically
  result.sort((a, b) => {
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }
    return (a.fullName || a.username).localeCompare(b.fullName || b.username);
  });

  res.json({ success: true, members: result, count: result.length });
}));

router.get('/online', authenticateToken, asyncHandler(async (req, res) => {
  const { team } = req.query;
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

  let onlineUsers;
  if (team) {
    onlineUsers = await dbQuery(
      'SELECT id as userId, username, fullName, role, team, last_seen as lastSeen FROM users WHERE last_seen >= ? AND team = ? ORDER BY last_seen DESC',
      [cutoff, team]
    );
  } else {
    onlineUsers = await dbQuery(
      'SELECT id as userId, username, fullName, role, team, last_seen as lastSeen FROM users WHERE last_seen >= ? ORDER BY last_seen DESC',
      [cutoff]
    );
  }

  const online = onlineUsers.map(u => ({ ...u, userId: String(u.userId) }));

  res.json({ success: true, online, count: online.length });
}));

module.exports = router;

const express = require('express');
const { queryBatch, query, queryOne } = require('../config/database');
const { categorizeFileTypes } = require('../utils/fileTypeUtils');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { calculateAllUserPerformance } = require('../services/performanceService');
const { getCache, setCache, invalidateCache, getRecomputePromise, setRecomputePromise } = require('../utils/cacheUtils');

const router = express.Router();

// Export for use in other routes (keeping the same handle name)
router.invalidatePerformanceCache = invalidateCache;

router.use(authenticateToken);

// GET /api/dashboard/test
router.get('/test', (req, res) => res.json({ success: true, message: 'Dashboard route works' }));

/**
 * GET /api/dashboard/summary
 * All aggregate queries run on a single pooled connection to avoid
 * exhausting the pool on slow NAS-hosted MySQL.
 */
router.get('/summary', authorizeRole('ADMIN'), asyncHandler(async (req, res) => {
  const now = new Date();
  const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const trendDateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');
  const prevStart = firstDayOfPrevMonth.toISOString();
  const prevEnd = firstDayOfCurrentMonth.toISOString();

  // All 11 queries on ONE connection — no pool exhaustion
  const results = await queryBatch([
    ['SELECT COUNT(*) as total FROM files', []],
    ["SELECT COUNT(*) as approved FROM files WHERE status = 'final_approved'", []],
    ["SELECT COUNT(*) as pending FROM files WHERE status NOT IN ('final_approved','rejected_by_admin','rejected_by_team_leader')", []],
    ["SELECT COUNT(*) as rejected FROM files WHERE status LIKE 'rejected%'", []],
    ['SELECT file_type, COUNT(*) as count FROM files GROUP BY file_type ORDER BY count DESC', []],
    ['SELECT id, username, role, team, activity, timestamp FROM activity_logs ORDER BY timestamp DESC LIMIT 6', []],
    ['SELECT COUNT(*) as total FROM files WHERE uploaded_at >= ? AND uploaded_at < ?', [prevStart, prevEnd]],
    ["SELECT COUNT(*) as approved FROM files WHERE status = 'final_approved' AND uploaded_at >= ? AND uploaded_at < ?", [prevStart, prevEnd]],
    ["SELECT COUNT(*) as pending FROM files WHERE status NOT IN ('final_approved','rejected_by_admin','rejected_by_team_leader') AND uploaded_at >= ? AND uploaded_at < ?", [prevStart, prevEnd]],
    ["SELECT COUNT(*) as rejected FROM files WHERE status LIKE 'rejected%' AND uploaded_at >= ? AND uploaded_at < ?", [prevStart, prevEnd]],
    [`SELECT DATE(uploaded_at) as date,
        SUM(CASE WHEN status = 'final_approved' OR current_stage = 'published_to_public' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files WHERE uploaded_at >= ?
      GROUP BY DATE(uploaded_at) ORDER BY date ASC`, [trendDateStr]]
  ]);

  const [
    totalRows, approvedRows, pendingRows, rejectedRows,
    fileTypes, recentActivity,
    prevTotalRows, prevApprovedRows, prevPendingRows, prevRejectedRows,
    trends
  ] = results;

  const totalResult     = totalRows[0]     || {};
  const approvedResult  = approvedRows[0]  || {};
  const pendingResult   = pendingRows[0]   || {};
  const rejectedResult  = rejectedRows[0]  || {};
  const prevTotalResult    = prevTotalRows[0]    || {};
  const prevApprovedResult = prevApprovedRows[0] || {};
  const prevPendingResult  = prevPendingRows[0]  || {};
  const prevRejectedResult = prevRejectedRows[0] || {};

  const totalFiles = totalResult.total || 0;
  const approved   = approvedResult.approved || 0;
  const approvalRate = totalFiles > 0 ? Math.round((approved / totalFiles) * 100 * 10) / 10 : 0;

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  res.json({
    success: true,
    summary: {
      totalFiles,
      approved,
      pending: pendingResult.pending || 0,
      rejected: rejectedResult.rejected || 0,
      fileTypes: categorizeFileTypes(fileTypes || []),
      recentActivity: recentActivity || [],
      approvalRate,
      previousMonth: {
        totalFiles: prevTotalResult.total || 0,
        approved:   prevApprovedResult.approved || 0,
        pending:    prevPendingResult.pending || 0,
        rejected:   prevRejectedResult.rejected || 0
      },
      approvalTrends: (trends || []).map(t => {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return { month: 'Invalid', date: t.date, approved: 0, rejected: 0 };
        return {
          month: `${monthNames[d.getMonth()]} ${d.getDate()}`,
          date: t.date,
          approved: Number(t.approved) || 0,
          rejected: Number(t.rejected) || 0
        };
      })
    }
  });
}));

/**
 * GET /api/dashboard/team-leader/:userId
 */
router.get('/team-leader/:userId', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== parseInt(userId) && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied: You can only view your own dashboard' });
  }

  const ledTeams = await query(`
    SELECT DISTINCT t.name FROM team_leaders tl
    JOIN teams t ON tl.team_id = t.id WHERE tl.user_id = ?
  `, [userId]);

  const teamNames = (ledTeams || []).map(t => t.name);

  if (teamNames.length === 0) {
    return res.json({
      success: true,
      analytics: {
        totalFiles: 0, approvedFiles: 0, pendingTeamLeaderReview: 0, pendingAdminReview: 0,
        rejectedFiles: 0, teamMembers: 0, fileTypes: [], topContributors: [],
        approvalRate: 0, avgReviewTime: 0, stageBreakdown: [], recentActivity: []
      }
    });
  }

  const ph = teamNames.map(() => '?').join(',');

  const results = await queryBatch([
    [`SELECT COUNT(*) as total FROM files WHERE user_team IN (${ph})`, teamNames],
    [`SELECT COUNT(*) as approved FROM files WHERE user_team IN (${ph}) AND status = 'final_approved'`, teamNames],
    [`SELECT COUNT(*) as pending FROM files WHERE user_team IN (${ph}) AND current_stage = 'pending_team_leader'`, teamNames],
    [`SELECT COUNT(*) as pending FROM files WHERE user_team IN (${ph}) AND current_stage = 'pending_admin'`, teamNames],
    [`SELECT COUNT(*) as rejected FROM files WHERE user_team IN (${ph}) AND current_stage LIKE 'rejected%'`, teamNames],
    [`SELECT COUNT(DISTINCT id) as total FROM users WHERE team IN (${ph}) AND role != 'TEAM_LEADER'`, teamNames],
    [`SELECT file_type, COUNT(*) as count FROM files WHERE user_team IN (${ph}) GROUP BY file_type ORDER BY count DESC`, teamNames],
    [`SELECT u.id, u.fullName, u.username, COUNT(f.id) as fileCount
      FROM users u LEFT JOIN files f ON u.id = f.user_id
      WHERE u.team IN (${ph}) AND u.role != 'TEAM_LEADER'
      GROUP BY u.id, u.fullName, u.username ORDER BY fileCount DESC LIMIT 5`, teamNames],
    [`SELECT AVG(DATEDIFF(team_leader_reviewed_at, uploaded_at)) as avgDays
      FROM files WHERE user_team IN (${ph}) AND team_leader_reviewed_at IS NOT NULL`, teamNames],
    [`SELECT current_stage, COUNT(*) as count FROM files WHERE user_team IN (${ph}) GROUP BY current_stage`, teamNames],
    [`SELECT username, role, activity, timestamp FROM activity_logs
      WHERE team IN (${ph}) ORDER BY timestamp DESC LIMIT 10`, teamNames]
  ]);

  const [
    totalRows, approvedRows, pendingTLRows, pendingAdminRows, rejectedRows,
    membersRows, fileTypes, topContributors, avgTimeRows, stageBreakdown, recentActivity
  ] = results;

  const totalFiles   = totalRows[0]?.total || 0;
  const approvedFiles = approvedRows[0]?.approved || 0;

  res.json({
    success: true,
    analytics: {
      totalFiles,
      approvedFiles,
      pendingTeamLeaderReview: pendingTLRows[0]?.pending || 0,
      pendingAdminReview:      pendingAdminRows[0]?.pending || 0,
      rejectedFiles:           rejectedRows[0]?.rejected || 0,
      teamMembers:             membersRows[0]?.total || 0,
      fileTypes:               categorizeFileTypes(fileTypes || []),
      topContributors:         topContributors || [],
      approvalRate: totalFiles > 0 ? Math.round((approvedFiles / totalFiles) * 100 * 10) / 10 : 0,
      avgReviewTime: avgTimeRows[0]?.avgDays ? Math.round(avgTimeRows[0].avgDays * 10) / 10 : 0,
      stageBreakdown: stageBreakdown || [],
      recentActivity: recentActivity || []
    }
  });
}));

/**
 * GET /api/dashboard/team/:teamName
 */
router.get('/team/:teamName', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { teamName } = req.params;

  if (req.user.role === 'TEAM_LEADER' && req.user.team !== teamName) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not lead this team' });
  }

  const results = await queryBatch([
    ['SELECT COUNT(*) as total FROM files WHERE user_team = ?', [teamName]],
    ["SELECT COUNT(*) as approved FROM files WHERE user_team = ? AND status = 'final_approved'", [teamName]],
    ["SELECT COUNT(*) as pending FROM files WHERE user_team = ? AND current_stage = 'pending_team_leader'", [teamName]],
    ["SELECT COUNT(*) as pending FROM files WHERE user_team = ? AND current_stage = 'pending_admin'", [teamName]],
    ["SELECT COUNT(*) as rejected FROM files WHERE user_team = ? AND current_stage LIKE 'rejected%'", [teamName]],
    ["SELECT COUNT(*) as total FROM users WHERE team = ? AND role != 'TEAM_LEADER'", [teamName]],
    ['SELECT file_type, COUNT(*) as count FROM files WHERE user_team = ? GROUP BY file_type ORDER BY count DESC', [teamName]],
    [`SELECT u.id, u.fullName, u.username, COUNT(f.id) as fileCount
      FROM users u LEFT JOIN files f ON u.id = f.user_id
      WHERE u.team = ? AND u.role != 'TEAM_LEADER'
      GROUP BY u.id, u.fullName, u.username ORDER BY fileCount DESC LIMIT 5`, [teamName]],
    [`SELECT AVG(DATEDIFF(team_leader_reviewed_at, uploaded_at)) as avgDays
      FROM files WHERE user_team = ? AND team_leader_reviewed_at IS NOT NULL`, [teamName]],
    ['SELECT current_stage, COUNT(*) as count FROM files WHERE user_team = ? GROUP BY current_stage', [teamName]],
    ['SELECT username, role, activity, timestamp FROM activity_logs WHERE team = ? ORDER BY timestamp DESC LIMIT 10', [teamName]]
  ]);

  const [
    totalRows, approvedRows, pendingTLRows, pendingAdminRows, rejectedRows,
    membersRows, fileTypes, topContributors, avgTimeRows, stageBreakdown, recentActivity
  ] = results;

  const totalFiles    = totalRows[0]?.total || 0;
  const approvedFiles = approvedRows[0]?.approved || 0;

  res.json({
    success: true,
    analytics: {
      totalFiles,
      approvedFiles,
      pendingTeamLeaderReview: pendingTLRows[0]?.pending || 0,
      pendingAdminReview:      pendingAdminRows[0]?.pending || 0,
      rejectedFiles:           rejectedRows[0]?.rejected || 0,
      teamMembers:             membersRows[0]?.total || 0,
      fileTypes:               categorizeFileTypes(fileTypes || []),
      topContributors:         topContributors || [],
      approvalRate: totalFiles > 0 ? Math.round((approvedFiles / totalFiles) * 100 * 10) / 10 : 0,
      avgReviewTime: avgTimeRows[0]?.avgDays ? Math.round(avgTimeRows[0].avgDays * 10) / 10 : 0,
      stageBreakdown: stageBreakdown || [],
      recentActivity: recentActivity || []
    }
  });
}));

/**
 * GET /api/dashboard/user-quickstats/:userId
 * Lightweight dashboard-only endpoint — returns only the counts the DashboardTab
 * stat cards need, plus 3 recent notifications.
 * Runs 4 COUNT queries batched on one connection instead of fetching full
 * assignment rows + attachments + members + submissions.
 * ~10-50ms vs the 500-2000ms of the full assignments route.
 */
router.get('/user-quickstats/:userId', authorizeRole(['USER', 'TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== parseInt(userId) && req.user.role === 'USER') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const user = await queryOne('SELECT team FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const { team } = user;

  const [taskRows, fileRows, teamTaskRows, notifRows] = await queryBatch([
    // Task stats: total, submitted, overdue (only what the stat card shows)
    [`SELECT
        COUNT(DISTINCT a.id) as total,
        SUM(CASE WHEN am.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN a.due_date < NOW() AND (am.status IS NULL OR am.status != 'submitted') AND a.status != 'completed' THEN 1 ELSE 0 END) as overdue
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      WHERE (a.assigned_to = 'all' AND a.team = ?) OR (a.assigned_to = 'specific' AND am.user_id = ?)`,
      [userId, team, userId]],

    // File stats: total, pending, approved, rejected
    [`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN current_stage LIKE '%pending%' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'final_approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files WHERE user_id = ?`,
      [userId]],

    // Team task count
    [`SELECT COUNT(*) as total FROM assignments WHERE team = ?`, [team]],

    // 3 most recent notifications
    [`SELECT id, title, type, is_read, created_at, assignment_id, file_id
      FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`,
      [userId]]
  ]);

  const tasks = taskRows[0] || {};
  const files = fileRows[0] || {};
  const teamCount = teamTaskRows[0]?.total || 0;

  res.json({
    success: true,
    tasks: {
      total: tasks.total || 0,
      submitted: tasks.submitted || 0,
      pending: (tasks.total || 0) - (tasks.submitted || 0),
      overdue: tasks.overdue || 0
    },
    files: {
      total: files.total || 0,
      pending: files.pending || 0,
      approved: files.approved || 0,
      rejected: files.rejected || 0
    },
    team: { totalTasks: teamCount },
    recentNotifications: notifRows || []
  });
}));

/**
 * GET /api/dashboard/bulk-performance
 * Fetches performance data for multiple users in a single request
 * Optimized with GROUP BY to avoid N+1 queries
 */
router.get('/bulk-performance', authorizeRole(['TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { teamId } = req.query;

  // 0. Check Cache First
  const cached = getCache();
  if (!teamId && cached) {
    return res.json({
      success: true,
      performanceMap: cached.data,
      cached: true,
      timestamp: cached.timestamp
    });
  }
  
  const performanceMap = await calculateAllUserPerformance(teamId);

  // Save to cache if global (no team filter)
  if (!teamId) {
    setCache(performanceMap);
  }

  res.json({
    success: true,
    performanceMap
  });
}));

router.get('/user-performance/:userId', authorizeRole(['USER', 'TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== parseInt(userId) && req.user.role === 'USER') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // 1. Serve stale cache immediately if available (stale-while-revalidate)
  const cached = getCache();
  if (cached) {
    const performanceData = (cached.data || {})[userId] || {};
    const taskTotal     = performanceData.taskTotal     || 0;
    const taskSubmitted = performanceData.taskSubmitted  || 0;
    const fileApproved  = performanceData.fileApproved  || 0;
    const fileRejected  = performanceData.fileRejected  || 0;
    const processedFiles = fileApproved + fileRejected;
    const taskCompletionRate = taskTotal > 0 ? Math.round((taskSubmitted / taskTotal) * 100) : 0;
    const onTimeRate    = performanceData.onTimeRate     ?? 100;
    const onTimeCount   = Math.round((onTimeRate / 100) * taskTotal);

    // Trigger background recompute if dirty but don't wait for it
    if (cached.isDirty && !getRecomputePromise()) {
      const p = calculateAllUserPerformance()
        .then(map => setCache(map))
        .catch(err => { console.error('Background perf recompute failed:', err); setRecomputePromise(null); });
      setRecomputePromise(p);
    }

    return res.json({
      success: true,
      cached: true,
      performance: {
        ...performanceData,
        taskCompletionRate,
        fileApprovalRate:  processedFiles > 0 ? Math.round((fileApproved  / processedFiles) * 100) : (taskTotal > 0 ? 0 : 100),
        fileRejectionRate: processedFiles > 0 ? Math.round((fileRejected / processedFiles) * 100) : 0,
        onTimeCount
      }
    });
  }

  // 2. No cache at all — deduplicate concurrent recalculations
  let recompute = getRecomputePromise();
  if (!recompute) {
    recompute = calculateAllUserPerformance()
      .then(map => { setCache(map); return map; })
      .catch(err => { setRecomputePromise(null); throw err; });
    setRecomputePromise(recompute);
  }

  const allPerformanceMap = await recompute;
  const performanceData = allPerformanceMap[userId] || {};

  const taskTotal     = performanceData.taskTotal     || 0;
  const taskSubmitted = performanceData.taskSubmitted  || 0;
  const fileApproved  = performanceData.fileApproved  || 0;
  const fileRejected  = performanceData.fileRejected  || 0;
  const processedFiles = fileApproved + fileRejected;
  const taskCompletionRate = taskTotal > 0 ? Math.round((taskSubmitted / taskTotal) * 100) : 0;
  const onTimeRate    = performanceData.onTimeRate     ?? 100;
  const onTimeCount   = Math.round((onTimeRate / 100) * taskTotal);

  res.json({
    success: true,
    performance: {
      ...performanceData,
      taskCompletionRate,
      fileApprovalRate:  processedFiles > 0 ? Math.round((fileApproved  / processedFiles) * 100) : (taskTotal > 0 ? 0 : 100),
      fileRejectionRate: processedFiles > 0 ? Math.round((fileRejected / processedFiles) * 100) : 0,
      onTimeCount
    }
  });
}));

/**
 * GET /api/dashboard/user-performance/:userId/history
 * Returns the last 12 snapshots for sparkline and streak calculation.
 */
router.get('/user-performance/:userId/history', authorizeRole(['USER', 'TEAM_LEADER', 'ADMIN']), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  if (req.user.id !== parseInt(userId) && req.user.role === 'USER') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const history = await query(`
    SELECT overall_score, quality_factor, snapshot_date 
    FROM user_performance_snapshots 
    WHERE user_id = ? 
    ORDER BY snapshot_date ASC 
    LIMIT 12
  `, [userId]);

  // Calculate Personal Best
  const personalBestResult = await queryOne(`
    SELECT MAX(overall_score) as pb FROM user_performance_snapshots WHERE user_id = ?
  `, [userId]);

  // Calculate Streak (consecutive weeks with score >= 85)
  const allHistory = await query(`
    SELECT overall_score, snapshot_date 
    FROM user_performance_snapshots 
    WHERE user_id = ? 
    ORDER BY snapshot_date DESC
  `, [userId]);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  allHistory.forEach((snapshot, index) => {
    if (snapshot.overall_score >= 85) {
      tempStreak++;
      if (index === currentStreak) currentStreak++; // Still in current streak
    } else {
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      tempStreak = 0;
    }
  });
  if (tempStreak > longestStreak) longestStreak = tempStreak;

  res.json({
    success: true,
    history: history || [],
    personalBest: personalBestResult?.pb || 0,
    currentStreak,
    longestStreak
  });
}));


module.exports = router;

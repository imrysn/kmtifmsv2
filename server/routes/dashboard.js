const express = require('express');
const { queryBatch, queryOneBatch, query, queryOne } = require('../config/database');
const { categorizeFileTypes } = require('../utils/fileTypeUtils');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getBusinessHoursDiff, calculateSpeedFactor } = require('../utils/performanceUtils');
const { calculateAllUserPerformance } = require('../services/performanceService');


const { getCache, setCache, invalidateCache } = require('../utils/cacheUtils');

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

  // Fetch data for WPI calculation
  const results = await queryBatch([
    // 1. Task Metrics (Totals and Submissions)
    [`SELECT 
        COUNT(DISTINCT a.id) as total,
        SUM(CASE WHEN am.status = 'submitted' THEN 1 ELSE 0 END) as submitted
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      JOIN users u ON u.id = ?
      WHERE (a.assigned_to = 'all' AND a.team = u.team)
         OR (a.assigned_to = 'specific' AND am.user_id = ?)`, [userId, userId, userId]],

    // 2. Reliability (R) - 20%
    [`SELECT 
        COUNT(DISTINCT a.id) as total_with_deadline,
        SUM(CASE WHEN am.status = 'submitted' AND a.due_date IS NOT NULL AND am.submitted_at <= a.due_date THEN 1 ELSE 0 END) as on_time
      FROM assignments a
      JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      JOIN users u ON u.id = ?
      WHERE a.due_date IS NOT NULL
        AND ((a.assigned_to = 'all' AND a.team = u.team) OR (a.assigned_to = 'specific' AND am.user_id = ?))`,
      [userId, userId, userId]],

    // 3. Overdue Tasks
    [`SELECT COUNT(DISTINCT a.id) as overdue
      FROM assignments a
      LEFT JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      JOIN users u ON u.id = ?
      WHERE a.due_date IS NOT NULL
        AND (am.status IS NULL OR am.status != 'submitted')
        AND a.due_date < NOW()
        AND ((a.assigned_to = 'all' AND a.team = u.team) OR (a.assigned_to = 'specific' AND am.user_id = ?))`,
      [userId, userId, userId]],

    // 4. Quality (Files Approved/Rejected)
    [`SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'final_approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files WHERE user_id = ?`, [userId]],

    // 5. Speed Factor Data (Task Timestamps)
    [`SELECT a.created_at, a.due_date, am.submitted_at
      FROM assignments a
      JOIN assignment_members am ON a.id = am.assignment_id AND am.user_id = ?
      WHERE am.status = 'submitted' AND a.due_date IS NOT NULL AND am.submitted_at IS NOT NULL
      LIMIT 50`, [userId]],

    // 6. Management Metrics (For Team Leaders)
    [`SELECT 
        COUNT(*) as total_reviewed,
        AVG(TIMESTAMPDIFF(HOUR, am.submitted_at, f.team_leader_reviewed_at)) as avg_review_hours
      FROM files f
      JOIN assignment_members am ON f.id = am.file_id
      WHERE f.team_leader_id = ? AND f.team_leader_reviewed_at IS NOT NULL`, [userId]],

    // 7. Management Pending Queue
    [`SELECT COUNT(f.id) as pending_reviews
      FROM users u
      JOIN files f ON u.team = f.user_team
      WHERE u.id = ? AND f.current_stage = 'pending_team_leader'`, [userId]]
  ]);

  const taskStats = results[0][0] || {};
  const onTimeStats = results[1][0] || {};
  const overdueStats = results[2][0] || {};
  const fileStats = results[3][0] || {};
  const speedData = results[4] || [];
  const managementStats = results[5][0] || {};
  const managementQueue = results[6][0] || {};

  const taskTotal = taskStats.total || 0;
  const taskSubmitted = taskStats.submitted || 0;
  const taskCompletionRate = taskTotal > 0 ? Math.round((taskSubmitted / taskTotal) * 100) : 0;

  // Reliability (R) - 20%
  const deadlineTotal = onTimeStats.total_with_deadline || 0;
  const onTimeCount = onTimeStats.on_time || 0;
  const effectiveOnTime = onTimeCount + (taskTotal - deadlineTotal);
  const onTimeRate = taskTotal > 0 ? Math.round((effectiveOnTime / taskTotal) * 100) : 100;
  const reliabilityScore = onTimeRate / 100;

  // Quality (Q) - 45%
  const fileTotal = fileStats.total || 0;
  const fileApproved = fileStats.approved || 0;
  const fileRejected = fileStats.rejected || 0;
  const processedFiles = fileApproved + fileRejected;
  // Default quality is 0% if nothing processed, or 50% if files uploaded but not yet reviewed
  const qualityFactor = processedFiles > 0 ? (fileApproved / processedFiles) : (fileTotal > 0 ? 0.5 : 0);
  // Apply a small penalty for rejections to differentiate from perfect quality
  const qualityScore = Math.max(0, qualityFactor - (fileRejected * 0.01));

  // Speed Factor (S) - 35%
  let totalSpeedFactor = 0;
  let speedTasksCount = 0;

  speedData.forEach(task => {
    const timeAllocated = getBusinessHoursDiff(task.created_at, task.due_date);
    const timeTaken = getBusinessHoursDiff(task.created_at, task.submitted_at);
    
    if (timeAllocated > 0 && timeTaken > 0) {
      totalSpeedFactor += calculateSpeedFactor(timeAllocated, timeTaken);
      speedTasksCount++;
    }
  });

  const avgSpeedFactor = speedTasksCount > 0 ? (totalSpeedFactor / speedTasksCount) : 0;
  // Normalize speed factor for 0-100 score (1.0 = 100%, clamped at 1.5)
  const speedScore = Math.min(1.5, avgSpeedFactor);

  // Final Weighted Performance Index (WPI)
  // Performance% = (Q * 45) + (S * 35) + (R * 20)
  // If no tasks are assigned OR no work has been submitted, score is 0
  const hasActivity = taskSubmitted > 0 || processedFiles > 0;
  const overallScore = (taskTotal > 0 && hasActivity) ? Math.max(0, Math.round(
    (qualityScore * 45) + 
    (speedScore * 35) + 
    (reliabilityScore * 20)
  )) : 0;

  // FIX #1 — pass userId so only this user's rows are fetched from MySQL
  const performanceData = (await calculateAllUserPerformance(null, userId))[userId] || {};

  res.json({
    success: true,
    performance: {
      ...performanceData,
      // Keep legacy fields if any were different (most match the service now)
      taskCompletionRate,
      fileApprovalRate: processedFiles > 0 ? Math.round((fileApproved / processedFiles) * 100) : (fileTotal > 0 ? 0 : 100),
      fileRejectionRate: processedFiles > 0 ? Math.round((fileRejected / processedFiles) * 100) : 0,
      onTimeCount: effectiveOnTime
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

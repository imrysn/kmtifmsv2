const { queryBatch, query } = require('../config/database');
const { getBusinessHoursDiff, calculateSpeedFactor } = require('../utils/performanceUtils');

/**
 * Calculates Weighted Performance Index (WPI) for all non-admin users (or a
 * single user when userId is provided).
 *
 * FIX #1 — single-user path: when userId is given, every SQL query is filtered
 *   to that user so we never fetch everyone's data just to pick one row.
 * FIX #2 — O(n²) JS .find() replaced with O(1) Map lookups.
 *
 * @param {number|null} teamId  - optional team filter
 * @param {number|null} userId  - optional single-user filter (new)
 */
async function calculateAllUserPerformance(teamId = null, userId = null) {
  // Build WHERE fragments shared across queries
  let userFilter = 'u.role != "ADMIN"';
  const baseParams = [];

  if (userId) {
    userFilter += ' AND u.id = ?';
    baseParams.push(userId);
  } else if (teamId) {
    userFilter += ' AND u.team = (SELECT team_name FROM teams WHERE id = ?)';
    baseParams.push(teamId);
  }

  // Quality and speed queries need a different filter when single-user
  const fileUserFilter = userId ? 'user_id = ?' : '1=1';
  const fileUserParams = userId ? [userId] : [];

  const speedUserJoin = userId ? 'AND am.user_id = ?' : '';
  const speedUserParams = userId ? [userId] : [];

  const results = await queryBatch([
    // 1. Task Metrics
    [`SELECT 
        u.id as user_id,
        SUM(CASE WHEN am.status = 'submitted' THEN COALESCE(fc.file_count, 1) ELSE 0 END) as submitted_files,
        SUM(COALESCE(fc.file_count, 1)) as total_files
      FROM users u
      LEFT JOIN assignment_members am ON u.id = am.user_id
      LEFT JOIN assignments a ON a.id = am.assignment_id OR (a.assigned_to = 'all' AND a.team = u.team)
      LEFT JOIN (SELECT assignment_id, user_id, COUNT(*) as file_count FROM files GROUP BY assignment_id, user_id) fc 
        ON a.id = fc.assignment_id AND u.id = fc.user_id
      WHERE ${userFilter}
      GROUP BY u.id`, baseParams],

    // 2. Reliability
    [`SELECT 
        u.id as user_id,
        SUM(COALESCE(fc.file_count, 1)) as total_files_with_deadline,
        SUM(CASE WHEN am.status = 'submitted' AND a.due_date IS NOT NULL AND am.submitted_at <= a.due_date THEN COALESCE(fc.file_count, 1) ELSE 0 END) as on_time_files
      FROM users u
      JOIN assignment_members am ON u.id = am.user_id
      JOIN assignments a ON a.id = am.assignment_id
      LEFT JOIN (SELECT assignment_id, user_id, COUNT(*) as file_count FROM files GROUP BY assignment_id, user_id) fc 
        ON a.id = fc.assignment_id AND u.id = fc.user_id
      WHERE ${userFilter} AND a.due_date IS NOT NULL
      GROUP BY u.id`, baseParams],

    // 3. Overdue
    [`SELECT u.id as user_id, COUNT(DISTINCT a.id) as overdue
      FROM users u
      LEFT JOIN assignment_members am ON u.id = am.user_id
      LEFT JOIN assignments a ON (a.id = am.assignment_id OR (a.assigned_to = 'all' AND a.team = u.team))
      WHERE ${userFilter} AND a.due_date IS NOT NULL
        AND (am.status IS NULL OR am.status != 'submitted')
        AND a.due_date < NOW()
      GROUP BY u.id`, baseParams],

    // 4. Quality — filtered to user when single-user mode
    [`SELECT user_id, COUNT(*) as total,
        SUM(CASE WHEN status = 'final_approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files
      WHERE ${fileUserFilter}
      GROUP BY user_id`, fileUserParams],

    // 5. Speed Data — filtered to user when single-user mode
    [`SELECT am.user_id, a.created_at, a.due_date, am.submitted_at, COALESCE(fc.file_count, 1) as file_count
      FROM assignments a
      JOIN assignment_members am ON a.id = am.assignment_id ${speedUserJoin}
      LEFT JOIN (SELECT assignment_id, user_id, COUNT(*) as file_count FROM files GROUP BY assignment_id, user_id) fc 
        ON a.id = fc.assignment_id AND am.user_id = fc.user_id
      WHERE am.status = 'submitted' AND a.due_date IS NOT NULL AND am.submitted_at IS NOT NULL
      ORDER BY am.submitted_at DESC`, speedUserParams],

    // 6. Management Metrics
    [`SELECT 
        f.team_leader_id as user_id,
        COUNT(*) as total_reviewed,
        AVG(TIMESTAMPDIFF(HOUR, am.submitted_at, f.team_leader_reviewed_at)) as avg_review_hours
      FROM files f
      JOIN assignment_members am ON f.id = am.file_id
      WHERE f.team_leader_id IS NOT NULL AND f.team_leader_reviewed_at IS NOT NULL
        ${userId ? 'AND f.team_leader_id = ?' : ''}
      GROUP BY f.team_leader_id`, userId ? [userId] : []],

    // 7. Management Pending Queue
    [`SELECT 
        u.id as user_id,
        COUNT(f.id) as pending_reviews
      FROM users u
      JOIN files f ON u.team = f.user_team
      WHERE u.role = 'TEAM_LEADER' AND f.current_stage = 'pending_team_leader'
        ${userId ? 'AND u.id = ?' : ''}
      GROUP BY u.id`, userId ? [userId] : []]
  ]);

  const [taskStats, reliabilityStats, overdueStats, qualityStats, speedRaw, managementStats, managementQueue] = results;

  // FIX #2 — O(1) Map lookups instead of O(n) .find() inside forEach
  const reliabilityMap  = new Map(reliabilityStats.map(r => [r.user_id, r]));
  const overdueMap      = new Map(overdueStats.map(o => [o.user_id, o]));
  const qualityMap      = new Map(qualityStats.map(q => [q.user_id, q]));
  const managementMap   = new Map(managementStats.map(m => [m.user_id, m]));
  const managementQMap  = new Map(managementQueue.map(mq => [mq.user_id, mq]));

  // Group speed data by user (cap at 20 per user)
  const speedMap = new Map();
  for (const row of speedRaw) {
    if (!speedMap.has(row.user_id)) speedMap.set(row.user_id, []);
    const arr = speedMap.get(row.user_id);
    if (arr.length < 20) arr.push(row);
  }

  const performanceMap = {};

  for (const stat of taskStats) {
    const uid = stat.user_id;
    const rStat = reliabilityMap.get(uid)  || {};
    const oStat = overdueMap.get(uid)      || {};
    const qStat = qualityMap.get(uid)      || {};
    const sData = speedMap.get(uid)        || [];

    const totalFilesVolume    = stat.total_files     || 0;
    const submittedFilesVolume = stat.submitted_files || 0;

    // Reliability
    const totalFilesWithDeadline = rStat.total_files_with_deadline || 0;
    const onTimeFiles            = rStat.on_time_files             || 0;
    const onTimeRate             = totalFilesWithDeadline > 0
      ? Math.round((onTimeFiles / totalFilesWithDeadline) * 100) : 100;
    const reliabilityScore = onTimeRate / 100;

    // Quality
    const fileTotal      = qStat.total    || 0;
    const fileApproved   = qStat.approved || 0;
    const fileRejected   = qStat.rejected || 0;
    const processedFiles = fileApproved + fileRejected;
    const qualityFactor  = processedFiles > 0
      ? (fileApproved / processedFiles) : (fileTotal > 0 ? 0.5 : 0);
    const qualityScore = Math.max(0, qualityFactor - (fileRejected * 0.01));

    // Speed
    let totalWeightedSpeedFactor = 0;
    let totalFilesWeight = 0;
    for (const task of sData) {
      const timeAllocated = getBusinessHoursDiff(task.created_at, task.due_date);
      const timeTaken     = getBusinessHoursDiff(task.created_at, task.submitted_at);
      if (timeAllocated > 0 && timeTaken > 0) {
        const factor = calculateSpeedFactor(timeAllocated, timeTaken);
        const weight = task.file_count || 1;
        totalWeightedSpeedFactor += factor * weight;
        totalFilesWeight         += weight;
      }
    }
    const avgSpeedFactor = totalFilesWeight > 0 ? totalWeightedSpeedFactor / totalFilesWeight : 0;
    const speedScore     = Math.min(1.5, avgSpeedFactor);

    // WPI
    const hasActivity  = submittedFilesVolume > 0 || processedFiles > 0;
    const overallScore = (totalFilesVolume > 0 && hasActivity)
      ? Math.max(0, Math.round((qualityScore * 45) + (speedScore * 35) + (reliabilityScore * 20)))
      : 0;

    const mStat  = managementMap.get(uid)  || {};
    const mqStat = managementQMap.get(uid) || {};

    performanceMap[uid] = {
      taskTotal:      totalFilesVolume,
      taskSubmitted:  submittedFilesVolume,
      taskPending:    totalFilesVolume - submittedFilesVolume,
      onTimeRate,
      overdue:        oStat.overdue || 0,
      fileTotal,
      fileApproved,
      fileRejected,
      overallScore,
      efficiencyRatio: Math.round(avgSpeedFactor * 100) / 100,
      qualityFactor:   Math.round(qualityScore * 100),
      management: {
        avgReviewHours:  Math.round((mStat.avg_review_hours || 0) * 10) / 10,
        totalReviewed:   mStat.total_reviewed  || 0,
        pendingReviews:  mqStat.pending_reviews || 0,
        managementScore: Math.max(0, Math.min(100, Math.round(
          mStat.avg_review_hours
            ? (Math.max(0, 24 - mStat.avg_review_hours) / 24) * 100
            : 100
        )))
      }
    };
  }

  // Rank calculation (skip when single-user — meaningless without all peers)
  if (!userId) {
    const scores    = Object.values(performanceMap).map(p => p.overallScore).sort((a, b) => b - a);
    const totalUsers = scores.length;

    for (const uid of Object.keys(performanceMap)) {
      const userScore = performanceMap[uid].overallScore;
      if (userScore === 0) {
        performanceMap[uid].percentileRank = 0;
        performanceMap[uid].rank           = totalUsers;
        performanceMap[uid].totalUsers     = totalUsers;
        continue;
      }
      const numericRank   = scores.indexOf(userScore) + 1;
      const countBelow    = scores.filter(s => s < userScore).length;
      const countAt       = scores.filter(s => s === userScore).length;
      const pRank         = (countBelow + (0.5 * countAt)) / totalUsers;
      performanceMap[uid].rank           = numericRank;
      performanceMap[uid].totalUsers     = totalUsers;
      performanceMap[uid].percentileRank = Math.round(pRank * 100);
    }
  }

  return performanceMap;
}

module.exports = { calculateAllUserPerformance };

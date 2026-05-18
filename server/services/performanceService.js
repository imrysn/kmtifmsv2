const { queryBatch, query } = require('../config/database');
const { getBusinessHoursDiff, calculateSpeedFactor } = require('../utils/performanceUtils');

/**
 * Calculates Weighted Performance Index (WPI) for a list of users.
 * This is the core logic shared between the dashboard API and the snapshot scheduler.
 */
async function calculateAllUserPerformance(teamId = null) {
  let userFilter = 'u.role != "ADMIN"';
  let params = [];
  if (teamId) {
    userFilter += ' AND u.team = (SELECT team_name FROM teams WHERE id = ?)';
    params = [teamId];
  }

  const results = await queryBatch([
    // 1. Global Task Metrics (Weighted by File Count)
    [`SELECT 
        u.id as user_id,
        SUM(CASE WHEN am.status = 'submitted' THEN COALESCE(fc.file_count, 1) ELSE 0 END) as submitted_files,
        SUM(COALESCE(fc.file_count, 1)) as total_files
      FROM users u
      LEFT JOIN assignment_members am ON u.id = am.user_id
      LEFT JOIN assignments a ON a.id = am.assignment_id
      LEFT JOIN (SELECT assignment_id, user_id, COUNT(*) as file_count FROM files WHERE assignment_id IS NOT NULL GROUP BY assignment_id, user_id) fc 
        ON a.id = fc.assignment_id AND u.id = fc.user_id
      WHERE ${userFilter}
      GROUP BY u.id`, params],

    // 2. Global Reliability (Weighted by Files)
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
      GROUP BY u.id`, params],

    // 3. Global Overdue
    [`SELECT u.id as user_id, COUNT(DISTINCT a.id) as overdue
      FROM users u
      LEFT JOIN assignment_members am ON u.id = am.user_id
      LEFT JOIN assignments a ON (a.id = am.assignment_id OR (a.assigned_to = 'all' AND a.team = u.team))
      WHERE ${userFilter} AND a.due_date IS NOT NULL
        AND (am.status IS NULL OR am.status != 'submitted')
        AND a.due_date < NOW()
      GROUP BY u.id`, params],

    // 4. Global Quality
    [`SELECT user_id, COUNT(*) as total,
        SUM(CASE WHEN status = 'final_approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files 
      GROUP BY user_id`, []],

    // 5. Global Speed Data (Weighted by File Count)
    [`SELECT am.user_id, a.created_at, a.due_date, am.submitted_at, COALESCE(fc.file_count, 1) as file_count
      FROM assignments a
      JOIN assignment_members am ON a.id = am.assignment_id
      LEFT JOIN (SELECT assignment_id, user_id, COUNT(*) as file_count FROM files GROUP BY assignment_id, user_id) fc 
        ON a.id = fc.assignment_id AND am.user_id = fc.user_id
      WHERE am.status = 'submitted' AND a.due_date IS NOT NULL AND am.submitted_at IS NOT NULL
      ORDER BY am.submitted_at DESC`, []],

    // 6. Management Metrics (For Team Leaders)
    [`SELECT 
        f.team_leader_id as user_id,
        COUNT(*) as total_reviewed,
        AVG(TIMESTAMPDIFF(HOUR, am.submitted_at, f.team_leader_reviewed_at)) as avg_review_hours
      FROM files f
      JOIN assignment_members am ON f.id = am.file_id
      WHERE f.team_leader_id IS NOT NULL AND f.team_leader_reviewed_at IS NOT NULL
      GROUP BY f.team_leader_id`, []],

    // 7. Management Pending Queue
    [`SELECT 
        u.id as user_id,
        COUNT(f.id) as pending_reviews
      FROM users u
      JOIN files f ON u.team = f.user_team
      WHERE u.role = 'TEAM_LEADER' AND f.current_stage = 'pending_team_leader'
      GROUP BY u.id`, []]
  ]);

  const [taskStats, reliabilityStats, overdueStats, qualityStats, speedRaw, managementStats, managementQueue] = results;
  
  // Group speed data by user
  const speedMap = {};
  speedRaw.forEach(row => {
    if (!speedMap[row.user_id]) speedMap[row.user_id] = [];
    if (speedMap[row.user_id].length < 20) speedMap[row.user_id].push(row);
  });

  const performanceMap = {};
  
  // Process all users
  taskStats.forEach(stat => {
    const userId = stat.user_id;
    const rStat = reliabilityStats.find(r => r.user_id === userId) || {};
    const oStat = overdueStats.find(o => o.user_id === userId) || {};
    const qStat = qualityStats.find(q => q.user_id === userId) || {};
    const sData = speedMap[userId] || [];

    const totalFilesVolume = stat.total_files || 0;
    const submittedFilesVolume = stat.submitted_files || 0;
    
    // Reliability (File-Weighted)
    const totalFilesWithDeadline = rStat.total_files_with_deadline || 0;
    const onTimeFiles = rStat.on_time_files || 0;
    const onTimeRate = totalFilesWithDeadline > 0 ? Math.round((onTimeFiles / totalFilesWithDeadline) * 100) : 100;
    const reliabilityScore = onTimeRate / 100;

    // Quality
    const fileTotal = qStat.total || 0;
    const fileApproved = qStat.approved || 0;
    const fileRejected = qStat.rejected || 0;
    const processedFiles = fileApproved + fileRejected;
    const qualityFactor = processedFiles > 0 ? (fileApproved / processedFiles) : (fileTotal > 0 ? 0.5 : 0);
    const qualityScore = Math.max(0, qualityFactor - (fileRejected * 0.01));

    // Speed (File-Weighted)
    let totalWeightedSpeedFactor = 0;
    let totalFilesWeight = 0;
    sData.forEach(task => {
      const timeAllocated = getBusinessHoursDiff(task.created_at, task.due_date);
      const timeTaken = getBusinessHoursDiff(task.created_at, task.submitted_at);
      if (timeAllocated > 0 && timeTaken > 0) {
        const factor = calculateSpeedFactor(timeAllocated, timeTaken);
        const weight = task.file_count || 1;
        totalWeightedSpeedFactor += (factor * weight);
        totalFilesWeight += weight;
      }
    });
    const avgSpeedFactor = totalFilesWeight > 0 ? (totalWeightedSpeedFactor / totalFilesWeight) : 0;
    const speedScore = Math.min(1.5, avgSpeedFactor);

    // Final WPI
    const hasActivity = submittedFilesVolume > 0 || processedFiles > 0;
    const overallScore = (totalFilesVolume > 0 && hasActivity) ? Math.max(0, Math.round(
      (qualityScore * 45) + (speedScore * 35) + (reliabilityScore * 20)
    )) : 0;

    const mStat = managementStats.find(m => m.user_id === userId) || {};
    const mqStat = managementQueue.find(mq => mq.user_id === userId) || {};

    performanceMap[userId] = {
      taskTotal: totalFilesVolume,
      taskSubmitted: submittedFilesVolume,
      taskPending: totalFilesVolume - submittedFilesVolume,
      onTimeRate,
      overdue: oStat.overdue || 0,
      fileTotal,
      fileApproved,
      fileRejected,
      overallScore,
      efficiencyRatio: Math.round(avgSpeedFactor * 100) / 100,
      qualityFactor: Math.round(qualityScore * 100),
      management: {
        avgReviewHours: Math.round((mStat.avg_review_hours || 0) * 10) / 10,
        totalReviewed: mStat.total_reviewed || 0,
        pendingReviews: mqStat.pending_reviews || 0,
        managementScore: Math.max(0, Math.min(100, Math.round(
          (mStat.avg_review_hours ? (Math.max(0, 24 - mStat.avg_review_hours) / 24) * 100 : 100)
        )))
      }
    };
  });

  // Calculate Absolute Rank (1 to N) and Percentile Rank
  const scores = Object.values(performanceMap).map(p => p.overallScore).sort((a, b) => b - a); // Sort DESC
  const totalUsers = scores.length;

  Object.keys(performanceMap).forEach(uid => {
    const userScore = performanceMap[uid].overallScore;
    if (userScore === 0) {
      performanceMap[uid].percentileRank = 0;
      performanceMap[uid].rank = totalUsers;
      performanceMap[uid].totalUsers = totalUsers;
      return;
    }

    // Numeric Rank (1-based, ties get the same rank)
    const numericRank = scores.indexOf(userScore) + 1;
    performanceMap[uid].rank = numericRank;
    performanceMap[uid].totalUsers = totalUsers;

    // Percentile logic still used internally for badge colors
    const countBelow = scores.filter(s => s < userScore).length;
    const countAt = scores.filter(s => s === userScore).length;
    const pRank = (countBelow + (0.5 * countAt)) / totalUsers;
    performanceMap[uid].percentileRank = Math.round(pRank * 100);
  });

  return performanceMap;
}

module.exports = {
  calculateAllUserPerformance
};

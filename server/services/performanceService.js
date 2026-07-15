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

    // 3. Global Overdue — counts distinct assignments per user that are overdue
    [`SELECT u.id as user_id, COUNT(DISTINCT a.id) as overdue
      FROM users u
      LEFT JOIN assignments a ON a.due_date IS NOT NULL AND a.due_date < NOW() AND (
         EXISTS (SELECT 1 FROM assignment_members am WHERE am.assignment_id = a.id AND am.user_id = u.id AND (am.status != 'submitted' OR am.submitted_at > a.due_date))
         OR
         (a.assigned_to = 'all' AND a.team = u.team AND NOT EXISTS (SELECT 1 FROM assignment_members am WHERE am.assignment_id = a.id AND am.user_id = u.id AND am.status = 'submitted' AND am.submitted_at <= a.due_date))
      )
      WHERE ${userFilter} AND a.id IS NOT NULL
      GROUP BY u.id`, params],

    // 4. Global Quality (- penalty_percentage per file)
    [`SELECT user_id, 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'final_approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected,
        AVG(
          CASE 
            WHEN status = 'final_approved' THEN GREATEST(0, 100 - COALESCE(penalty_percentage, 0))
            WHEN status IN ('checked', 'team_leader_approved', 'pending_team_leader') THEN LEAST(60, GREATEST(0, 100 - COALESCE(penalty_percentage, 0)))
            ELSE GREATEST(0, 100 - COALESCE(penalty_percentage, 0))
          END
        ) as avg_quality_score
      FROM files 
      WHERE checked_by IS NOT NULL OR status IN ('final_approved', 'revision', 'checked', 'rejected_by_team_leader', 'rejected_by_admin')
      GROUP BY user_id`, []],

    // 5. Global Speed Data (Weighted by File Count and Complexity)
    [`SELECT am.user_id, a.created_at, a.due_date, am.submitted_at, COALESCE(fc.file_count, 1) as file_count, COALESCE(a.complexity, 'Medium') as complexity
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
      GROUP BY u.id`, []],

    // 8. Checking Metrics
    [`SELECT 
        u.id as user_id, 
        COUNT(f.id) as checking_assigned, 
        SUM(CASE WHEN f.checked_by IN (u.username, u.fullName) THEN 1 ELSE 0 END) as checking_completed,
        SUM(CASE WHEN f.checked_by IN (u.username, u.fullName) THEN COALESCE(f.checker_penalty_percentage, 0) ELSE 0 END) as total_checker_penalty
      FROM users u 
      JOIN assignments a ON (
        a.checker_ids IS NOT NULL 
        AND a.checker_ids != '[]' 
        AND CONCAT(',', REPLACE(REPLACE(REPLACE(a.checker_ids,'[',''),']',''),'"',''), ',') LIKE CONCAT('%,', u.id, ',%')
      ) 
      JOIN assignment_submissions asub ON asub.assignment_id = a.id
      JOIN files f ON f.id = asub.file_id 
      GROUP BY u.id`, []],

    // 9. Checker Speed Data
    [`SELECT 
        u.id as user_id, 
        f.uploaded_at, 
        COALESCE(f.checked_at, f.updated_at) as checked_at
      FROM users u 
      JOIN assignments a ON (
        a.checker_ids IS NOT NULL 
        AND a.checker_ids != '[]' 
        AND CONCAT(',', REPLACE(REPLACE(REPLACE(a.checker_ids,'[',''),']',''),'"',''), ',') LIKE CONCAT('%,', u.id, ',%')
      ) 
      JOIN assignment_submissions asub ON asub.assignment_id = a.id
      JOIN files f ON f.id = asub.file_id 
      WHERE f.checked_by IN (u.username, u.fullName) AND f.status != 'pending_team_leader' AND f.status != 'pending_checker' AND f.status != 'uploaded'
      `, []]
  ]);

  const [taskStats, reliabilityStats, overdueStats, qualityStats, speedRaw, managementStats, managementQueue, checkingStats, checkerSpeedRaw] = results;

  // Group speed data by user
  const speedMap = {};
  speedRaw.forEach(row => {
    if (!speedMap[row.user_id]) {
      speedMap[row.user_id] = [];
    }
    if (speedMap[row.user_id].length < 20) {
      speedMap[row.user_id].push(row);
    }
  });

  const checkerSpeedMap = {};
  checkerSpeedRaw.forEach(row => {
    if (!checkerSpeedMap[row.user_id]) {
      checkerSpeedMap[row.user_id] = [];
    }
    checkerSpeedMap[row.user_id].push(row);
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
    const overdueCount = parseInt(oStat.overdue) || 0;
    
    // totalFilesWithDeadline already includes late submissions. We only add overdueCount if it exceeds
    // the known late files, to account for 'all' tasks the user never started (which wouldn't be in totalFilesWithDeadline).
    const knownLateFiles = totalFilesWithDeadline - onTimeFiles;
    const unstartedOverdueTasks = Math.max(0, overdueCount - knownLateFiles);
    
    const effectiveTotalForReliability = totalFilesWithDeadline + unstartedOverdueTasks;
    const onTimeRate = effectiveTotalForReliability > 0
      ? Math.round((onTimeFiles / effectiveTotalForReliability) * 100)
      : 100;
    const reliabilityScore = onTimeRate / 100;

    // Quality — rejection penalty applied via avg_quality_score (already in DB)
    const fileTotal = qStat.total || 0;
    const fileApproved = qStat.approved || 0;
    const fileRejected = qStat.rejected || 0;
    const processedFiles = fileApproved + fileRejected;
    
    // avg_quality_score is AVG(100 - penalty_percentage) per file from DB query.
    // This ALREADY accounts for rejections. We don't apply an extra rejection ratio penalty to avoid double dipping.
    let baseQualityScore = qStat.avg_quality_score != null ? qStat.avg_quality_score : (fileTotal > 0 ? 50 : 0);

    const mStat = managementStats.find(m => m.user_id === userId) || {};
    const mqStat = managementQueue.find(mq => mq.user_id === userId) || {};
    const cStat = checkingStats.find(c => c.user_id === userId) || {};
    const checkingAssigned = parseInt(cStat.checking_assigned) || 0;
    const checkingCompleted = parseInt(cStat.checking_completed) || 0;
    const checkingCompletionRate = checkingAssigned > 0 ? Math.round((checkingCompleted / checkingAssigned) * 100) : 0;
    
    // Calculate Checking Penalty Deduction
    const totalCheckerPenalty = parseInt(cStat.total_checker_penalty) || 0;
    const checkingPenaltyDeduction = checkingAssigned > 0 ? (totalCheckerPenalty / checkingAssigned) : 0;

    // If they have no submissions but they are a checker, give them a baseline of 100 to deduct from
    if (fileTotal === 0 && checkingAssigned > 0) {
      baseQualityScore = 100;
    }

    // Apply checking penalty to main quality score
    const finalQualityDisplay = Number(Math.max(0, baseQualityScore - checkingPenaltyDeduction).toFixed(1));
    const qualityScore = finalQualityDisplay / 100;

    // Speed (File-Weighted) — overdue tasks apply a direct speed penalty
    let totalWeightedSpeedFactor = 0;
    let totalFilesWeight = 0;
    let earlyCompletionBonus = 0;
    sData.forEach(task => {
      const timeAllocated = getBusinessHoursDiff(task.created_at, task.due_date);
      const timeTaken = getBusinessHoursDiff(task.created_at, task.submitted_at);
      if (timeAllocated > 0 && timeTaken > 0) {
        const factor = calculateSpeedFactor(timeAllocated, timeTaken);
        const complexityMultiplier = task.complexity === 'High' ? 2 : task.complexity === 'Low' ? 0.5 : 1;
        const weight = (task.file_count || 1) * complexityMultiplier;
        totalWeightedSpeedFactor += (factor * weight);
        totalFilesWeight += weight;
        
        // Early completion bonus: finished 24+ business hours early
        if ((timeAllocated - timeTaken) >= 24) {
          earlyCompletionBonus += 0.05;
        }
      }
    });
    let avgSpeedFactor = totalFilesWeight > 0 ? (totalWeightedSpeedFactor / totalFilesWeight) : 0;
    
    // Each overdue task reduces speed by 5% (capped at 50% total deduction)
    if (overdueCount > 0 && totalFilesVolume > 0) {
      const speedPenalty = Math.min(0.50, overdueCount * 0.05);
      avgSpeedFactor = avgSpeedFactor * (1 - speedPenalty);
    }
    
    // Checker SLA (Turnaround Time) Penalty
    let checkerSlaPenalty = 0;
    const csData = checkerSpeedMap[userId] || [];
    csData.forEach(cf => {
      if (cf.checked_at && cf.uploaded_at) {
        const turnaround = getBusinessHoursDiff(cf.uploaded_at, cf.checked_at);
        if (turnaround > 24) {
          checkerSlaPenalty += 0.05; // 5% penalty per late checked file
        }
      }
    });
    // Apply Checker SLA penalty to speed factor
    if (checkerSlaPenalty > 0) {
      avgSpeedFactor = avgSpeedFactor * (1 - Math.min(0.50, checkerSlaPenalty));
    }
    
    const speedScore = Math.min(1.5, avgSpeedFactor);

    // Flawless Bonuses
    const flawlessSubmitterBonus = (baseQualityScore === 100 && submittedFilesVolume > 10) ? 0.05 : 0;
    const flawlessCheckerBonus = (totalCheckerPenalty === 0 && checkingCompleted > 10) ? 0.05 : 0;
    const cappedEarlyBonus = Math.min(0.05, earlyCompletionBonus);
    const totalBonusFactor = cappedEarlyBonus + flawlessSubmitterBonus + flawlessCheckerBonus;

    // Final WPI (Raw)
    const hasActivity = submittedFilesVolume > 0 || processedFiles > 0;
    let rawOverallScore = (totalFilesVolume > 0 && hasActivity) ? Math.max(0, Math.round(
      (qualityScore * 45) + (speedScore * 35) + (reliabilityScore * 20) + (totalBonusFactor * 100)
    )) : 0;
    
    // Cap at 110 to show true over-performers, but prevent ridiculous scores
    rawOverallScore = Math.min(110, rawOverallScore);

    // Apply Bayesian Smoothing to balance low-volume vs high-volume users
    // We add 5 "dummy" tasks with an average score of 75% to naturally pull low-volume users toward the average
    const DUMMY_TASKS = 5;
    const DUMMY_SCORE = 75;
    const totalActivityVolume = Number(submittedFilesVolume) + Number(checkingCompleted) + Number(mStat.total_reviewed || 0);
    
    let overallScore = 0;
    if (hasActivity) {
      overallScore = Math.round(((rawOverallScore * totalActivityVolume) + (DUMMY_SCORE * DUMMY_TASKS)) / (totalActivityVolume + DUMMY_TASKS));
    }

    // Calculate Checking Quality
    const checkingQualityFactor = finalQualityDisplay;

    performanceMap[userId] = {
      taskTotal: totalFilesVolume,
      taskSubmitted: submittedFilesVolume,
      taskPending: totalFilesVolume - submittedFilesVolume,
      onTimeRate,
      overdue: overdueCount,
      fileTotal,
      fileApproved,
      fileRejected,
      overallScore,
      checkingAssigned,
      checkingCompleted,
      checkingCompletionRate,
      checkingQualityFactor,
      efficiencyRatio: Math.round(avgSpeedFactor * 100) / 100,
      qualityFactor: finalQualityDisplay,
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

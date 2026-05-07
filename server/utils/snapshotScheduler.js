const { query } = require('../config/database');
const { calculateAllUserPerformance } = require('../services/performanceService');
const { logInfo, logError } = require('./logger');

/**
 * Weekly Snapshot Scheduler
 * Captures user performance metrics every Sunday at midnight.
 */

async function takeWeeklySnapshots() {
  logInfo('🚀 Starting weekly performance snapshot job...');
  try {
    const performanceMap = await calculateAllUserPerformance();
    const userIds = Object.keys(performanceMap);
    const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let savedCount = 0;
    for (const userId of userIds) {
      const data = performanceMap[userId];
      await query(`
        INSERT INTO user_performance_snapshots 
          (user_id, overall_score, quality_factor, efficiency_ratio, on_time_rate, overdue_count, snapshot_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          overall_score = VALUES(overall_score),
          quality_factor = VALUES(quality_factor),
          efficiency_ratio = VALUES(efficiency_ratio),
          on_time_rate = VALUES(on_time_rate),
          overdue_count = VALUES(overdue_count)
      `, [
        userId, 
        data.overallScore, 
        data.qualityFactor, 
        data.efficiencyRatio, 
        data.onTimeRate, 
        data.overdue, 
        snapshotDate
      ]);
      savedCount++;
    }

    logInfo(`✅ Weekly snapshot completed. Saved ${savedCount} user records for ${snapshotDate}.`);
  } catch (error) {
    logError(error, { context: 'weekly-snapshot-scheduler' });
  }
}

function scheduleWeeklyJob() {
  // Calculate time until next Sunday at midnight
  const now = new Date();
  const nextSunday = new Date();
  nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
  nextSunday.setHours(24, 0, 0, 0); // Next midnight

  let timeUntilNextJob = nextSunday.getTime() - now.getTime();
  
  // If it's already Sunday midnight or close, push it to next week
  if (timeUntilNextJob < 1000) {
    timeUntilNextJob += 7 * 24 * 60 * 60 * 1000;
  }

  logInfo(`📅 Weekly performance snapshots scheduled. Next run in ${Math.round(timeUntilNextJob / 3600000)} hours.`);

  setTimeout(() => {
    takeWeeklySnapshots();
    // After the first run, run every 7 days
    setInterval(takeWeeklySnapshots, 7 * 24 * 60 * 60 * 1000);
  }, timeUntilNextJob);
}

module.exports = {
  scheduleWeeklyJob,
  takeWeeklySnapshots // Exported for manual trigger if needed
};

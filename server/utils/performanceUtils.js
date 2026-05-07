/**
 * performanceUtils.js
 * Utilities for calculating weighted performance metrics.
 */

/**
 * Calculates the difference between two dates in hours, excluding weekends.
 * @param {Date|string} start - Start date
 * @param {Date|string} end - End date
 * @returns {number} Hours difference excluding weekends
 */
const getBusinessHoursDiff = (start, end) => {
  const dStart = new Date(start);
  const dEnd = new Date(end);
  
  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return 0;
  if (dEnd < dStart) return 0;

  let totalHours = 0;
  const current = new Date(dStart);

  while (current < dEnd) {
    const dayOfWeek = current.getDay();
    const isWeekend = (dayOfWeek === 6) || (dayOfWeek === 0); // 6 = Saturday, 0 = Sunday

    if (!isWeekend) {
      // Calculate remaining time in the current day or until the end date
      const endOfDay = new Date(current);
      endOfDay.setHours(23, 59, 59, 999);
      
      const segmentEnd = dEnd < endOfDay ? dEnd : endOfDay;
      const diffMs = segmentEnd - current;
      totalHours += diffMs / (1000 * 60 * 60);
    }
    
    // Move to the start of the next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return Math.max(0, totalHours);
};

/**
 * Calculates the Speed Factor (S) clamped at 1.5x.
 * @param {number} timeAllocated - Allocated hours
 * @param {number} timeTaken - Actual hours taken
 * @returns {number} Clamped speed factor
 */
const calculateSpeedFactor = (timeAllocated, timeTaken) => {
  if (timeTaken <= 0) return 1.0; // Avoid division by zero
  const factor = timeAllocated / timeTaken;
  return Math.min(1.5, Math.max(0, factor));
};

module.exports = {
  getBusinessHoursDiff,
  calculateSpeedFactor
};

/**
 * OT Dates Utilities
 * Shared helpers for calculating business days with approved OT weekend dates.
 */

/**
 * Returns the list of weekend dates (Saturdays & Sundays) between today and a due date.
 * @param {string} dueDateStr  ISO date string "YYYY-MM-DD"
 * @returns {string[]} array of "YYYY-MM-DD" strings for weekend dates
 */
function getWeekendDatesBetween(startDateStr, dueDateStr) {
  if (!dueDateStr) {
    return [];
  }
  const start = new Date(startDateStr || new Date());
  const end   = new Date(dueDateStr);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // Use local date to avoid UTC timezone shift (e.g. UTC+8 midnight = prev day UTC)
  const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const weekends = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 6) { // Saturday only
      weekends.push(toLocalISO(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return weekends;
}

/**
 * Calculates business days remaining until the due date,
 * treating any date in `otDates` as a working day even if it falls on a weekend.
 *
 * Rules:
 *  - Counts Mon–Fri as working days by default.
 *  - Dates listed in `otDates` (Sat/Sun) are ALSO counted as working days.
 *  - The current day counts if it is before end-of-business (treated as included).
 *
 * @param {string}   dueDateStr  "YYYY-MM-DD" or ISO datetime
 * @param {string[]} otDates     array of "YYYY-MM-DD" strings for approved OT weekends
 * @param {Date}     [from]      reference "today" — defaults to new Date()
 * @returns {number}  positive = days left, 0 = due today, negative = overdue
 */
function calcBusinessDaysLeft(dueDateStr, otDates = [], from = new Date()) {
  if (!dueDateStr) {
    return null;
  }

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const otSet = new Set(Array.isArray(otDates) ? otDates : []);

  // Use local date to avoid UTC timezone shift
  const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let businessDays = 0;
  const cursor = new Date(today);

  while (cursor <= due) {
    const day = cursor.getDay();
    const iso = toLocalISO(cursor);
    const isWeekend = (day === 0 || day === 6);

    if (!isWeekend || otSet.has(iso)) {
      businessDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // If due date is in the past, return a negative value
  if (due < today) {
    // Count how many business days overdue
    let overdue = 0;
    const c2 = new Date(due);
    c2.setDate(c2.getDate() + 1); // start from day after due
    while (c2 <= today) {
      const day = c2.getDay();
      const iso = toLocalISO(c2);
      if (day !== 0 && day !== 6) {
        overdue++;
      } else if (otSet.has(iso)) {
        overdue++;
      }
      c2.setDate(c2.getDate() + 1);
    }
    return -overdue;
  }

  // businessDays includes today itself as "day 1", so subtract 1 for "days LEFT"
  return businessDays > 0 ? businessDays - 1 : 0;
}

module.exports = { getWeekendDatesBetween, calcBusinessDaysLeft };

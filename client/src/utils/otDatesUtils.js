/**
 * OT Dates Utilities — Client-side mirror of server/utils/otDatesUtils.js
 *
 * Calculates business-days countdown for the due-date display across
 * Admin, Team Leader, and User views.
 */

/**
 * Returns all weekend dates (Sat + Sun) between today and the due date.
 * @param {string} dueDateStr  "YYYY-MM-DD"
 * @param {Date}   [from]      reference "today" (defaults to new Date())
 * @returns {string[]}  array of "YYYY-MM-DD" strings
 */
export function getWeekendDatesBetween(dueDateStr, from = new Date()) {
  if (!dueDateStr) return [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dueDateStr);
  end.setHours(0, 0, 0, 0);

  // Helper: format a Date as local YYYY-MM-DD (avoids UTC shift from toISOString)
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
 * treating dates in `otDates` as working days even on weekends.
 *
 * @param {string}   dueDateStr  "YYYY-MM-DD" or ISO datetime
 * @param {string[]|string|null} otDates  JSON string or array of approved OT weekend dates
 * @param {Date}     [from]       reference "today" (defaults to new Date())
 * @returns {number|null}  positive = days left, 0 = due today, negative = overdue, null = no due date
 */
export function calcBusinessDaysLeft(dueDateStr, otDates = [], from = new Date()) {
  if (!dueDateStr) return null;

  // Parse otDates if it came in as a JSON string from the DB
  let otArr = [];
  try {
    if (typeof otDates === 'string') {
      otArr = JSON.parse(otDates);
    } else if (Array.isArray(otDates)) {
      otArr = otDates;
    }
  } catch (_) {
    otArr = [];
  }

  const otSet = new Set(Array.isArray(otArr) ? otArr : []);

  // Use local date formatting to avoid UTC timezone shift (e.g. UTC+8 sees Sat as Fri via toISOString)
  const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    // Count overdue business days (negative)
    let overdue = 0;
    const c = new Date(due);
    c.setDate(c.getDate() + 1);
    while (c <= today) {
      const day = c.getDay();
      const iso = toLocalISO(c);
      if (day !== 0 && day !== 6) overdue++;
      else if (otSet.has(iso)) overdue++;
      c.setDate(c.getDate() + 1);
    }
    return -overdue;
  }

  // Count forward from today to due date (inclusive on both ends = "days including today")
  let businessDays = 0;
  const cursor = new Date(today);
  while (cursor <= due) {
    const day = cursor.getDay();
    const iso = toLocalISO(cursor);
    if (day !== 0 && day !== 6) businessDays++;
    else if (otSet.has(iso)) businessDays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  // businessDays counts today as 1, so "days left" is businessDays - 1
  return businessDays > 0 ? businessDays - 1 : 0;
}

/**
 * Formats the business-days countdown for display.
 * @param {string}               dueDateStr
 * @param {string[]|string|null} otDates
 * @returns {string}
 */
export function formatBusinessDaysLeft(dueDateStr, otDates = []) {
  if (!dueDateStr) return '';
  const days = calcBusinessDaysLeft(dueDateStr, otDates);
  if (days === null) return '';
  if (days < 0) {
    const abs = Math.abs(days);
    return `${abs} working ${abs === 1 ? 'day' : 'days'} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return '1 working day left';
  return `${days} working days left`;
}

/**
 * Returns a CSS colour string based on urgency of the business-days countdown.
 */
export function getBusinessDaysColor(dueDateStr, otDates = []) {
  if (!dueDateStr) return '#95a5a6';
  const days = calcBusinessDaysLeft(dueDateStr, otDates);
  if (days === null) return '#95a5a6';
  if (days < 0) return '#e74c3c';
  if (days <= 2) return '#f39c12';
  return '#27ae60';
}

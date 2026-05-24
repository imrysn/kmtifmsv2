// Due-Date Notifier Service
// Runs every hour and sends two types of notifications to assigned users:
//   • 'due_soon'  — task is due tomorrow (1 calendar day left, same logic as UI badge)
//   • 'overdue'   — task's due date has passed and it's not completed
//
// Uses DATE() comparison (not timestamp math) so it matches exactly what
// the "1 days left" badge in TasksTab shows to users.

const { query } = require('../config/database');
const { pushToUser } = require('../routes/notifications');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

async function getAssignedUserIds(assignment) {
  const ids = new Set();
  if (assignment.assigned_to === 'all') {
    const members = await query(
      'SELECT id FROM users WHERE team = ? AND role = ?',
      [assignment.team, 'USER']
    );
    for (const m of (members || [])) ids.add(m.id);
  } else {
    const members = await query(
      'SELECT user_id FROM assignment_members WHERE assignment_id = ?',
      [assignment.id]
    );
    for (const m of (members || [])) ids.add(m.user_id);
  }
  return [...ids];
}

async function alreadyNotified(userId, assignmentId, type) {
  const rows = await query(
    `SELECT id FROM notifications WHERE user_id = ? AND assignment_id = ? AND type = ? LIMIT 1`,
    [userId, assignmentId, type]
  );
  return rows && rows.length > 0;
}

async function insertNotification(userId, assignmentId, type, title, message, actionById, actionByUsername) {
  await query(
    `INSERT INTO notifications
       (user_id, assignment_id, file_id, type, title, message, action_by_id, action_by_username, action_by_role)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'SYSTEM')`,
    [userId, assignmentId, type, title, message, actionById, actionByUsername || 'System']
  );
  pushToUser(userId);
}

// ── Main check ────────────────────────────────────────────────────────────────

async function checkDueDates() {
  try {
    console.log('⏰ [due-date notifier] Running check...');

    // ── 1. DUE SOON — due_date is exactly tomorrow (calendar day) ─────────────
    // DATE(due_date) = DATE(NOW() + 1 day)  → matches the "1 days left" UI badge
    const dueSoonAssignments = await query(
      `SELECT id, title, due_date, assigned_to, team, team_leader_id, team_leader_username
       FROM assignments
       WHERE status NOT IN ('completed', 'checked')
         AND due_date IS NOT NULL
         AND DATE(due_date) = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))`
    );

    for (const asgn of (dueSoonAssignments || [])) {
      const userIds = await getAssignedUserIds(asgn);
      for (const uid of userIds) {
        if (await alreadyNotified(uid, asgn.id, 'due_soon')) continue;

        await insertNotification(
          uid,
          asgn.id,
          'due_soon',
          '⏰ Task Due Tomorrow',
          `Your task "${asgn.title}" is due tomorrow (${formatDate(asgn.due_date)}). Please submit before the deadline.`,
          asgn.team_leader_id,
          asgn.team_leader_username
        );
        console.log(`🔔 [due_soon] user=${uid} assignment="${asgn.title}"`);
      }
    }

    // ── 2. OVERDUE — due_date (calendar day) is before today, not completed ───
    // DATE(due_date) < DATE(NOW())  → same logic as getAssignmentStatus() in the UI
    const overdueAssignments = await query(
      `SELECT id, title, due_date, assigned_to, team, team_leader_id, team_leader_username
       FROM assignments
       WHERE status NOT IN ('completed', 'checked')
         AND due_date IS NOT NULL
         AND DATE(due_date) < DATE(NOW())`
    );

    for (const asgn of (overdueAssignments || [])) {
      const userIds = await getAssignedUserIds(asgn);
      for (const uid of userIds) {
        if (await alreadyNotified(uid, asgn.id, 'overdue')) continue;

        await insertNotification(
          uid,
          asgn.id,
          'overdue',
          '⚠️ Task Overdue',
          `Your task "${asgn.title}" was due on ${formatDate(asgn.due_date)} and is now overdue. Please submit as soon as possible.`,
          asgn.team_leader_id,
          asgn.team_leader_username
        );
        console.log(`🔔 [overdue] user=${uid} assignment="${asgn.title}"`);
      }
    }

    console.log('⏰ [due-date notifier] Check complete.');
  } catch (err) {
    console.error('❌ Due-date notifier error:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function startDueDateNotifier() {
  console.log('⏰ Due-date notifier started — checks every hour');
  // Run immediately on startup so users are notified without waiting an hour
  checkDueDates();
  setInterval(checkDueDates, CHECK_INTERVAL_MS);
}

module.exports = { startDueDateNotifier };

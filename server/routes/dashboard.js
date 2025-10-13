const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// GET /api/dashboard/summary
// Returns aggregate counts and recent activity for admin dashboard
router.get('/summary', (req, res) => {
  const summary = {};

  // Total files
  db.get('SELECT COUNT(*) as total FROM files', [], (err, totalResult) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch total files' });
    summary.totalFiles = totalResult.total || 0;

    // Approved (final_approved)
    db.get("SELECT COUNT(*) as approved FROM files WHERE status = 'final_approved'", [], (err, approvedResult) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to fetch approved count' });
      summary.approved = approvedResult.approved || 0;

      // Pending (not final_approved and not rejected)
      db.get("SELECT COUNT(*) as pending FROM files WHERE status NOT IN ('final_approved','rejected_by_admin','rejected_by_team_leader')", [], (err, pendingResult) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to fetch pending count' });
        summary.pending = pendingResult.pending || 0;

        // Rejected (any rejection status)
        db.get("SELECT COUNT(*) as rejected FROM files WHERE status LIKE 'rejected%'", [], (err, rejectedResult) => {
          if (err) return res.status(500).json({ success: false, message: 'Failed to fetch rejected count' });
          summary.rejected = rejectedResult.rejected || 0;

          // File types breakdown (group by file_type)
          db.all("SELECT file_type, COUNT(*) as count FROM files GROUP BY file_type ORDER BY count DESC", [], (err, types) => {
            if (err) {
              // non-fatal - continue without types
              summary.fileTypes = [];
            } else {
              summary.fileTypes = types || [];
            }

            // Recent activity logs
            db.all('SELECT id, username, role, team, activity, timestamp FROM activity_logs ORDER BY timestamp DESC LIMIT 6', [], (err, logs) => {
              if (err) return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
              summary.recentActivity = logs || [];

              // Approval rate & simple stats (derived)
              const approvalRate = summary.totalFiles > 0 ? (summary.approved / summary.totalFiles) * 100 : 0;
              summary.approvalRate = Math.round(approvalRate * 10) / 10; // 1 decimal

              res.json({ success: true, summary });
            });
          });
        });
      });
    });
  });
});

module.exports = router;

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

              // Approval trends - Last 30 days of daily approval/rejection activity
              db.all(
                `SELECT 
                  DATE(uploaded_at) as date,
                  SUM(CASE WHEN status = 'final_approved' OR current_stage = 'published_to_public' THEN 1 ELSE 0 END) as approved,
                  SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
                FROM files
                WHERE uploaded_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(uploaded_at)
                ORDER BY date ASC`,
                [],
                (err, trends) => {
                  if (err) {
                    console.error('Error fetching approval trends:', err);
                    summary.approvalTrends = [];
                  } else {
                    // Format dates for display (e.g., "Oct 1", "Oct 2")
                    summary.approvalTrends = (trends || []).map(t => {
                      const d = new Date(t.date);
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return {
                        day: `${monthNames[d.getMonth()]} ${d.getDate()}`,
                        date: t.date,
                        approved: t.approved || 0,
                        rejected: t.rejected || 0
                      };
                    });
                  }

                  res.json({ success: true, summary });
                }
              );
            });
          });
        });
      });
    });
  });
});

// GET /api/dashboard/team/:teamName
// Returns team-specific analytics for team leader dashboard
router.get('/team/:teamName', (req, res) => {
  const { teamName } = req.params;
  console.log(`📊 Getting analytics for team: ${teamName}`);
  
  const analytics = {};

  // Total files for team
  db.get('SELECT COUNT(*) as total FROM files WHERE user_team = ?', [teamName], (err, totalResult) => {
    if (err) {
      console.error('❌ Error getting team total files:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
    analytics.totalFiles = totalResult.total || 0;

    // Approved files
    db.get("SELECT COUNT(*) as approved FROM files WHERE user_team = ? AND status = 'final_approved'", [teamName], (err, approvedResult) => {
      if (err) {
        console.error('❌ Error getting team approved files:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
      }
      analytics.approvedFiles = approvedResult.approved || 0;

      // Pending team leader review
      db.get("SELECT COUNT(*) as pending FROM files WHERE user_team = ? AND current_stage = 'pending_team_leader'", [teamName], (err, pendingTLResult) => {
        if (err) {
          console.error('❌ Error getting pending TL files:', err);
          return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
        }
        analytics.pendingTeamLeaderReview = pendingTLResult.pending || 0;

        // Pending admin review
        db.get("SELECT COUNT(*) as pending FROM files WHERE user_team = ? AND current_stage = 'pending_admin'", [teamName], (err, pendingAdminResult) => {
          if (err) {
            console.error('❌ Error getting pending admin files:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
          }
          analytics.pendingAdminReview = pendingAdminResult.pending || 0;

          // Rejected files
          db.get("SELECT COUNT(*) as rejected FROM files WHERE user_team = ? AND current_stage LIKE 'rejected%'", [teamName], (err, rejectedResult) => {
            if (err) {
              console.error('❌ Error getting rejected files:', err);
              return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
            }
            analytics.rejectedFiles = rejectedResult.rejected || 0;

            // Team members count
            db.get('SELECT COUNT(*) as total FROM users WHERE team = ? AND role != ?', [teamName, 'TEAM LEADER'], (err, membersResult) => {
              if (err) {
                console.error('❌ Error getting team members count:', err);
                return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
              }
              analytics.teamMembers = membersResult.total || 0;

              // File types breakdown for team
              db.all("SELECT file_type, COUNT(*) as count FROM files WHERE user_team = ? GROUP BY file_type ORDER BY count DESC", [teamName], (err, fileTypes) => {
                if (err) {
                  console.error('❌ Error getting file types:', err);
                  analytics.fileTypes = [];
                } else {
                  analytics.fileTypes = fileTypes || [];
                }

                // Top contributors (members with most files)
                db.all(
                  `SELECT u.id, u.fullName, u.username, COUNT(f.id) as fileCount
                   FROM users u
                   LEFT JOIN files f ON u.id = f.user_id
                   WHERE u.team = ? AND u.role != ?
                   GROUP BY u.id, u.fullName, u.username
                   ORDER BY fileCount DESC
                   LIMIT 5`,
                  [teamName, 'TEAM LEADER'],
                  (err, topContributors) => {
                    if (err) {
                      console.error('❌ Error getting top contributors:', err);
                      analytics.topContributors = [];
                    } else {
                      analytics.topContributors = topContributors || [];
                    }

                    // Approval rate
                    const approvalRate = analytics.totalFiles > 0 
                      ? (analytics.approvedFiles / analytics.totalFiles) * 100 
                      : 0;
                    analytics.approvalRate = Math.round(approvalRate * 10) / 10;

                    // Average review time (in days)
                    db.get(
                      `SELECT AVG(DATEDIFF(team_leader_reviewed_at, uploaded_at)) as avgDays
                       FROM files
                       WHERE user_team = ? AND team_leader_reviewed_at IS NOT NULL`,
                      [teamName],
                      (err, avgTimeResult) => {
                        if (err) {
                          console.error('❌ Error getting average review time:', err);
                          analytics.avgReviewTime = 0;
                        } else {
                          analytics.avgReviewTime = avgTimeResult.avgDays ? Math.round(avgTimeResult.avgDays * 10) / 10 : 0;
                        }

                        // Files by stage (for pie chart)
                        db.all(
                          `SELECT current_stage, COUNT(*) as count FROM files WHERE user_team = ? GROUP BY current_stage`,
                          [teamName],
                          (err, stageBreakdown) => {
                            if (err) {
                              console.error('❌ Error getting stage breakdown:', err);
                              analytics.stageBreakdown = [];
                            } else {
                              analytics.stageBreakdown = stageBreakdown || [];
                            }

                            // Recent activity for team
                            db.all(
                              `SELECT username, role, activity, timestamp FROM activity_logs
                               WHERE team = ? ORDER BY timestamp DESC LIMIT 10`,
                              [teamName],
                              (err, recentActivity) => {
                                if (err) {
                                  console.error('❌ Error getting recent activity:', err);
                                  analytics.recentActivity = [];
                                } else {
                                  analytics.recentActivity = recentActivity || [];
                                }

                                console.log(`✅ Retrieved analytics for team ${teamName}`);
                                res.json({ success: true, analytics });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;

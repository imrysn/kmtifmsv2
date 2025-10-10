const express = require('express');
const { db } = require('../config/database');
const { logActivity } = require('../utils/logger');

const router = express.Router();

// Activity Logs Endpoints with pagination
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  console.log(`📋 Getting activity logs - Page ${page}, Limit ${limit}`);

  // Get total count
  db.get('SELECT COUNT(*) as total FROM activity_logs', [], (err, countResult) => {
    if (err) {
      console.error('❌ Database error getting activity logs count:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }

    // Get paginated results
    db.all(
      'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, logs) => {
        if (err) {
          console.error('❌ Database error getting activity logs:', err);
          return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
        }

        console.log(`✅ Retrieved ${logs.length} activity logs`);
        res.json({
          success: true,
          logs,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      }
    );
  });
});

// Bulk delete activity logs (Admin only)
router.delete('/bulk-delete', (req, res) => {
  const { logIds } = req.body;
  console.log(`🗑️ Bulk deleting ${logIds?.length || 0} activity logs`);

  // Validation
  if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Log IDs array is required and must not be empty'
    });
  }

  // Create placeholders for the SQL IN clause
  const placeholders = logIds.map(() => '?').join(',');

  // Get log details for logging purposes before deletion
  db.all(
    `SELECT id, username, activity FROM activity_logs WHERE id IN (${placeholders})`,
    logIds,
    (err, logsToDelete) => {
      if (err) {
        console.error('❌ Error fetching logs for deletion:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch logs for deletion'
        });
      }
      if (logsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No logs found with the provided IDs'
        });
      }

      // Delete the logs
      db.run(
        `DELETE FROM activity_logs WHERE id IN (${placeholders})`,
        logIds,
        function(err) {
          if (err) {
            console.error('❌ Error deleting activity logs:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to delete activity logs'
            });
          }
          const deletedCount = this.changes;
          console.log(`✅ Successfully deleted ${deletedCount} activity logs`);

          // Log the bulk deletion activity
          logActivity(
            db,
            null,
            'System',
            'ADMIN',
            'System',
            `Bulk deletion: ${deletedCount} activity log(s) removed by administrator`
          );
          res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} activity log(s)`,
            deletedCount: deletedCount,
            requestedCount: logIds.length
          });
        }
      );
    }
  );
});

module.exports = router;

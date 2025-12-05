// Activity logging function
function logActivity(db, userId, username, role, team, activity) {
  db.run(
    'INSERT INTO activity_logs (user_id, username, role, team, activity) VALUES (?, ?, ?, ?, ?)',
    [userId, username, role, team, activity],
    function(err) {
      if (err) {
        console.error('❌ Error logging activity:', err);
      } else {
        console.log(`📋 Activity logged: ${activity} by ${username}`);
      }
    }
  );
}

// File status history logging
function logFileStatusChange(db, fileId, oldStatus, newStatus, oldStage, newStage, changedById, changedByUsername, changedByRole, reason = null) {
  db.run(
    'INSERT INTO file_status_history (file_id, old_status, new_status, old_stage, new_stage, changed_by_id, changed_by_username, changed_by_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [fileId, oldStatus, newStatus, oldStage, newStage, changedById, changedByUsername, changedByRole, reason],
    function(err) {
      if (err) {
        console.error('❌ Error logging file status change:', err);
      } else {
        console.log(`📋 File status change logged: File ${fileId} ${oldStatus} -> ${newStatus}`);
      }
    }
  );
}

module.exports = {
  logActivity,
  logFileStatusChange
};

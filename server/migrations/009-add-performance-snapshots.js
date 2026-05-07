/**
 * Migration 009: Add user_performance_snapshots table
 * This table stores weekly performance metrics for sparklines, streaks, and personal bests.
 */

async function up() {
  const { query } = require('../config/database');

  console.log('🔄 Running migration 009: Add user_performance_snapshots...');

  try {
    // Check if table exists
    const tables = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_performance_snapshots'
    `);

    if (tables.length === 0) {
      await query(`
        CREATE TABLE user_performance_snapshots (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          overall_score INT NOT NULL DEFAULT 0,
          quality_factor INT NOT NULL DEFAULT 0,
          efficiency_ratio DECIMAL(4,2) NOT NULL DEFAULT 0.00,
          on_time_rate INT NOT NULL DEFAULT 0,
          overdue_count INT NOT NULL DEFAULT 0,
          snapshot_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_week (user_id, snapshot_date),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_snapshots (user_id, snapshot_date DESC)
        )
      `);
      console.log('  ✅ user_performance_snapshots table created');
    } else {
      console.log('  ⏭️  user_performance_snapshots table already exists');
    }
    return true;
  } catch (err) {
    console.error('  ❌ Could not create user_performance_snapshots:', err.message);
    return false;
  }
}

module.exports = up;
module.exports.up = up;

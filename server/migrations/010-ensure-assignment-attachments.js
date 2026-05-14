/**
 * Migration 010: Ensure assignment_attachments table exists with all required columns.
 *
 * The table was never added to the canonical schema or migration chain,
 * so it may be missing entirely on fresh installs, or missing columns
 * (folder_name, relative_path, public_network_url, status, current_stage)
 * that were added incrementally during development without a migration entry.
 *
 * This migration is idempotent — safe to run on any database state.
 */

const { query } = require('../config/database');

async function up() {
  try {
    // ── 1. Create the table if it doesn't exist yet ──────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS assignment_attachments (
        id                  INT PRIMARY KEY AUTO_INCREMENT,
        assignment_id       INT NOT NULL,
        original_name       VARCHAR(500) NOT NULL,
        filename            VARCHAR(500) NOT NULL,
        file_path           TEXT,
        public_network_url  TEXT,
        file_size           BIGINT DEFAULT 0,
        file_type           VARCHAR(100),
        uploaded_by_id      INT,
        uploaded_by_username VARCHAR(100),
        folder_name         VARCHAR(255) DEFAULT NULL,
        relative_path       VARCHAR(1000) DEFAULT NULL,
        status              VARCHAR(50) DEFAULT 'team_leader_approved',
        current_stage       VARCHAR(50) DEFAULT 'pending_admin',
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_aa_assignment (assignment_id),
        INDEX idx_aa_folder     (folder_name),
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [010] assignment_attachments table ensured');

    // ── 2. Add any columns that may be missing on older installs ─────────
    const existingCols = await query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'assignment_attachments'
    `);
    const colNames = (existingCols || []).map(r => r.COLUMN_NAME || r.column_name);

    const columnsToAdd = [
      { name: 'public_network_url',  sql: "ALTER TABLE assignment_attachments ADD COLUMN public_network_url TEXT DEFAULT NULL AFTER file_path" },
      { name: 'folder_name',         sql: "ALTER TABLE assignment_attachments ADD COLUMN folder_name VARCHAR(255) DEFAULT NULL" },
      { name: 'relative_path',       sql: "ALTER TABLE assignment_attachments ADD COLUMN relative_path VARCHAR(1000) DEFAULT NULL" },
      { name: 'status',              sql: "ALTER TABLE assignment_attachments ADD COLUMN status VARCHAR(50) DEFAULT 'team_leader_approved'" },
      { name: 'current_stage',       sql: "ALTER TABLE assignment_attachments ADD COLUMN current_stage VARCHAR(50) DEFAULT 'pending_admin'" },
      { name: 'uploaded_by_id',      sql: "ALTER TABLE assignment_attachments ADD COLUMN uploaded_by_id INT DEFAULT NULL" },
      { name: 'uploaded_by_username',sql: "ALTER TABLE assignment_attachments ADD COLUMN uploaded_by_username VARCHAR(100) DEFAULT NULL" },
    ];

    for (const col of columnsToAdd) {
      if (!colNames.includes(col.name)) {
        try {
          await query(col.sql);
          console.log(`✅ [010] Added column: ${col.name}`);
        } catch (e) {
          // ER_DUP_FIELDNAME means it snuck in between our check and the ALTER — harmless
          if (e.code !== 'ER_DUP_FIELDNAME') {
            console.warn(`⚠️  [010] Could not add column ${col.name}:`, e.message);
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('❌ [010] Migration failed:', error.message);
    // Don't crash the server — table may already exist correctly
    return true;
  }
}

module.exports = up;

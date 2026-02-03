/**
 * Migration: Add indexes for query optimization
 *
 * This migration adds indexes to foreign keys to optimize JOIN queries
 * and eliminate N+1 query problems.
 */

const { db } = require('../config/database');

async function up() {
  console.log('Adding indexes for query optimization...');

  const indexes = [
    // Assignment-related indexes
    {
      name: 'idx_assignment_members_assignment_id',
      table: 'assignment_members',
      column: 'assignment_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignment_members_assignment_id ON assignment_members(assignment_id)'
    },
    {
      name: 'idx_assignment_members_user_id',
      table: 'assignment_members',
      column: 'user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignment_members_user_id ON assignment_members(user_id)'
    },
    {
      name: 'idx_assignment_attachments_assignment_id',
      table: 'assignment_attachments',
      column: 'assignment_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id ON assignment_attachments(assignment_id)'
    },
    {
      name: 'idx_assignment_comments_assignment_id',
      table: 'assignment_comments',
      column: 'assignment_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_id ON assignment_comments(assignment_id)'
    },
    {
      name: 'idx_assignments_team',
      table: 'assignments',
      column: 'team',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignments_team ON assignments(team)'
    },
    {
      name: 'idx_assignments_team_leader_id',
      table: 'assignments',
      column: 'team_leader_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignments_team_leader_id ON assignments(team_leader_id)'
    },
    // File-related indexes
    {
      name: 'idx_files_user_id',
      table: 'files',
      column: 'user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)'
    },
    {
      name: 'idx_files_user_team',
      table: 'files',
      column: 'user_team',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_user_team ON files(user_team)'
    },
    {
      name: 'idx_files_status',
      table: 'files',
      column: 'status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_status ON files(status)'
    },
    {
      name: 'idx_files_team_leader_id',
      table: 'files',
      column: 'team_leader_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_team_leader_id ON files(team_leader_id)'
    }
  ];

  for (const index of indexes) {
    try {
      await db.run(index.sql);
      console.log(`✅ Created index: ${index.name} on ${index.table}(${index.column})`);
    } catch (error) {
      console.error(`❌ Failed to create index ${index.name}:`, error.message);
      throw error;
    }
  }

  console.log('✅ All indexes created successfully');
}

async function down() {
  console.log('Removing indexes...');

  const indexes = [
    'idx_assignment_members_assignment_id',
    'idx_assignment_members_user_id',
    'idx_assignment_attachments_assignment_id',
    'idx_assignment_comments_assignment_id',
    'idx_assignments_team',
    'idx_assignments_team_leader_id',
    'idx_files_user_id',
    'idx_files_user_team',
    'idx_files_status',
    'idx_files_team_leader_id'
  ];

  for (const indexName of indexes) {
    try {
      await db.run(`DROP INDEX IF EXISTS ${indexName}`);
      console.log(`✅ Dropped index: ${indexName}`);
    } catch (error) {
      console.error(`❌ Failed to drop index ${indexName}:`, error.message);
    }
  }

  console.log('✅ All indexes removed');
}

module.exports = { up, down };

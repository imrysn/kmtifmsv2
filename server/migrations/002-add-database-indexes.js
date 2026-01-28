/**
 * Migration: Add Database Indexes for Performance
 * 
 * This migration adds indexes to frequently queried columns to improve
 * query performance, especially for large datasets.
 * 
 * Tables affected:
 * - users: email, username, role, team
 * - files: user_id, status, uploaded_at, team
 * - assignments: assigned_to, status, due_date
 * - notifications: user_id, is_read, created_at
 * - activity_logs: user_id, timestamp
 */

const { USE_MYSQL } = require('../config/database');

async function up() {
    if (USE_MYSQL) {
        // MySQL indexes
        const { query } = require('../../database/config');

        const indexes = [
            // Users table
            { name: 'idx_users_email', table: 'users', column: 'email' },
            { name: 'idx_users_username', table: 'users', column: 'username' },
            { name: 'idx_users_role', table: 'users', column: 'role' },
            { name: 'idx_users_team', table: 'users', column: 'team' },

            // Files table
            { name: 'idx_files_user_id', table: 'files', column: 'user_id' },
            { name: 'idx_files_status', table: 'files', column: 'status' },
            { name: 'idx_files_uploaded_at', table: 'files', column: 'uploaded_at' },
            { name: 'idx_files_user_team', table: 'files', column: 'user_team' },
            { name: 'idx_files_current_stage', table: 'files', column: 'current_stage' },

            // Assignments table
            { name: 'idx_assignments_team_leader_id', table: 'assignments', column: 'team_leader_id' },
            { name: 'idx_assignments_status', table: 'assignments', column: 'status' },
            { name: 'idx_assignments_due_date', table: 'assignments', column: 'due_date' },
            { name: 'idx_assignments_team', table: 'assignments', column: 'team' },

            // Assignment members table
            { name: 'idx_assignment_members_user_id', table: 'assignment_members', column: 'user_id' },
            { name: 'idx_assignment_members_assignment_id', table: 'assignment_members', column: 'assignment_id' },
            { name: 'idx_assignment_members_status', table: 'assignment_members', column: 'status' },

            // Notifications table (if exists)
            { name: 'idx_notifications_user_id', table: 'notifications', column: 'user_id' },
            { name: 'idx_notifications_is_read', table: 'notifications', column: 'is_read' },
            { name: 'idx_notifications_created_at', table: 'notifications', column: 'created_at' },

            // Activity logs table
            { name: 'idx_activity_logs_user_id', table: 'activity_logs', column: 'user_id' },
            { name: 'idx_activity_logs_timestamp', table: 'activity_logs', column: 'timestamp' },

            // File comments table
            { name: 'idx_file_comments_file_id', table: 'file_comments', column: 'file_id' },
            { name: 'idx_file_comments_user_id', table: 'file_comments', column: 'user_id' },

            // File status history table
            { name: 'idx_file_status_history_file_id', table: 'file_status_history', column: 'file_id' },
            { name: 'idx_file_status_history_changed_by_id', table: 'file_status_history', column: 'changed_by_id' }
        ];

        console.log('📊 Adding database indexes for MySQL...');

        for (const index of indexes) {
            try {
                // Check if index exists
                const checkSql = `
                    SELECT COUNT(*) as count 
                    FROM information_schema.statistics 
                    WHERE table_schema = DATABASE() 
                    AND table_name = '${index.table}' 
                    AND index_name = '${index.name}'
                `;
                const result = await query(checkSql);

                if (result[0].count === 0) {
                    // Index doesn't exist, create it
                    const createSql = `CREATE INDEX ${index.name} ON ${index.table}(${index.column})`;
                    await query(createSql);
                    console.log(`  ✅ Created index: ${index.name}`);
                } else {
                    console.log(`  ⏭️  Index already exists: ${index.name}`);
                }
            } catch (error) {
                console.error(`  ⚠️ Server: ❌ Query error: ${error.message}`);
                console.error(`  ❌ Error creating index: ${error.message}`);
            }
        }

        console.log('📡 ✅ MySQL indexes added successfully');

    } else {
        // SQLite indexes (already handled in initialize.js, but we can add more)
        const { db } = require('../config/database');

        const indexes = [
            // Additional indexes not in initialize.js
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_files_status ON files(status)',
            'CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status)',
            'CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date)',
            'CREATE INDEX IF NOT EXISTS idx_assignment_members_status ON assignment_members(status)'
        ];

        console.log('📊 Adding additional database indexes for SQLite...');

        return new Promise((resolve, reject) => {
            let completed = 0;
            const total = indexes.length;

            indexes.forEach(sql => {
                db.run(sql, (err) => {
                    if (err && !err.message.includes('already exists')) {
                        console.error(`  ❌ Error creating index: ${err.message}`);
                    } else {
                        const indexName = sql.match(/idx_\w+/)[0];
                        console.log(`  ✅ Created index: ${indexName}`);
                    }

                    completed++;
                    if (completed === total) {
                        console.log('✅ SQLite indexes added successfully');
                        resolve();
                    }
                });
            });
        });
    }
}

async function down() {
    // Rollback: Drop indexes
    if (USE_MYSQL) {
        const { query } = require('../../database/config');

        const indexes = [
            'DROP INDEX IF EXISTS idx_users_email ON users',
            'DROP INDEX IF EXISTS idx_users_username ON users',
            'DROP INDEX IF EXISTS idx_users_role ON users',
            'DROP INDEX IF EXISTS idx_users_team ON users',
            'DROP INDEX IF EXISTS idx_files_user_id ON files',
            'DROP INDEX IF EXISTS idx_files_status ON files',
            'DROP INDEX IF EXISTS idx_files_uploaded_at ON files',
            'DROP INDEX IF EXISTS idx_files_user_team ON files',
            'DROP INDEX IF EXISTS idx_files_current_stage ON files',
            'DROP INDEX IF EXISTS idx_assignments_team_leader_id ON assignments',
            'DROP INDEX IF EXISTS idx_assignments_status ON assignments',
            'DROP INDEX IF EXISTS idx_assignments_due_date ON assignments',
            'DROP INDEX IF EXISTS idx_assignments_team ON assignments',
            'DROP INDEX IF EXISTS idx_assignment_members_user_id ON assignment_members',
            'DROP INDEX IF EXISTS idx_assignment_members_assignment_id ON assignment_members',
            'DROP INDEX IF EXISTS idx_assignment_members_status ON assignment_members',
            'DROP INDEX IF EXISTS idx_notifications_user_id ON notifications',
            'DROP INDEX IF EXISTS idx_notifications_is_read ON notifications',
            'DROP INDEX IF EXISTS idx_notifications_created_at ON notifications',
            'DROP INDEX IF EXISTS idx_activity_logs_user_id ON activity_logs',
            'DROP INDEX IF EXISTS idx_activity_logs_timestamp ON activity_logs',
            'DROP INDEX IF EXISTS idx_file_comments_file_id ON file_comments',
            'DROP INDEX IF EXISTS idx_file_comments_user_id ON file_comments',
            'DROP INDEX IF EXISTS idx_file_status_history_file_id ON file_status_history',
            'DROP INDEX IF EXISTS idx_file_status_history_changed_by_id ON file_status_history'
        ];

        console.log('🗑️  Dropping database indexes...');

        for (const sql of indexes) {
            try {
                await query(sql);
            } catch (error) {
                // Ignore errors during rollback
            }
        }

        console.log('✅ Indexes dropped');
    } else {
        console.log('⚠️  SQLite does not support DROP INDEX IF EXISTS easily. Manual cleanup may be required.');
    }
}

module.exports = { up, down };

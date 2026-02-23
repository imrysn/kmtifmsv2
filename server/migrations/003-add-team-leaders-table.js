const { db } = require('../config/database');

/**
 * Migration: Add Team Leaders Junction Table
 * 
 * Purpose: Enable multiple team leaders per team by creating a many-to-many
 * relationship between teams and users.
 * 
 * Changes:
 * - Creates team_leaders junction table
 * - Migrates existing single leader assignments
 * - Maintains backward compatibility with teams.leader_id
 */

async function up() {
    console.log('🔄 Running migration: Add Team Leaders Table');

    try {
        // Check if table already exists
        const tableExists = await checkTableExists('team_leaders');
        if (tableExists) {
            console.log('⚠️  team_leaders table already exists, skipping creation');
            return true;
        }


        // Create team_leaders junction table
        console.log('📝 Creating team_leaders table...');
        const createTableSQL = `
          CREATE TABLE team_leaders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            team_id INT NOT NULL,
            user_id INT NOT NULL,
            username VARCHAR(100) NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_team_user (team_id, user_id),
            INDEX idx_team_leaders_team (team_id),
            INDEX idx_team_leaders_user (user_id)
          ) ENGINE=InnoDB
        `;

        await executeSQL(createTableSQL);
        console.log('✅ team_leaders table created');


        // Migrate existing team leader assignments
        console.log('📝 Migrating existing team leader assignments...');
        const migrateSQL = `
      INSERT INTO team_leaders (team_id, user_id, username)
      SELECT id, leader_id, leader_username 
      FROM teams 
      WHERE leader_id IS NOT NULL
    `;

        const result = await executeSQL(migrateSQL);
        const migratedCount = result?.affectedRows || result?.changes || 0;
        console.log(`✅ Migrated ${migratedCount} existing team leader assignments`);

        // Verify migration
        const verifyCount = await getCount('team_leaders');
        console.log(`✅ Verification: team_leaders table has ${verifyCount} entries`);

        console.log('✅ Migration completed successfully');
        return true;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('Stack trace:', error.stack);

        // Attempt cleanup on failure
        try {
            console.log('🔄 Attempting to rollback changes...');
            await down();
        } catch (rollbackError) {
            console.error('❌ Rollback also failed:', rollbackError);
        }

        return false;
    }
}

async function down() {
    console.log('🔄 Rolling back migration: Add Team Leaders Table');

    try {
        // Check if table exists
        const tableExists = await checkTableExists('team_leaders');
        if (!tableExists) {
            console.log('⚠️  team_leaders table does not exist, nothing to rollback');
            return true;
        }

        // Restore single leader to teams table from first entry in team_leaders
        console.log('📝 Restoring leader assignments to teams...');
        const restoreSQL = `
          UPDATE teams t
          INNER JOIN team_leaders tl ON t.id = tl.team_id
          SET t.leader_id = tl.user_id,
              t.leader_username = tl.username
        `;

        await executeSQL(restoreSQL);
        console.log('✅ Restored single leader assignments');

        // Drop team_leaders table
        console.log('📝 Dropping team_leaders table...');
        await executeSQL('DROP TABLE team_leaders');
        console.log('✅ team_leaders table dropped');

        console.log('✅ Rollback completed successfully');
        return true;

    } catch (error) {
        console.error('❌ Rollback failed:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Helper functions
function executeSQL(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, [], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

async function checkTableExists(tableName) {
    const result = await db.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
    );
    return result[0].count > 0;
}

async function getCount(tableName) {
    const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return result[0].count;
}

// Export both up and down for flexibility
module.exports = up;
module.exports.up = up;
module.exports.down = down;

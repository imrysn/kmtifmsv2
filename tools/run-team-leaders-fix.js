/**
 * Run Team Leaders Migration Fix
 * This script creates the team_leaders table and migrates existing data
 */

const mysqlConfig = require('./database/config');

async function runFix() {
    console.log('🔧 Starting Team Leaders Migration Fix...\n');

    try {
        // Step 1: Create team_leaders table
        console.log('📝 Step 1: Creating team_leaders table...');
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS team_leaders (
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

        await mysqlConfig.query(createTableSQL);
        console.log('✅ team_leaders table created/verified\n');

        // Step 2: Migrate existing data
        console.log('📝 Step 2: Migrating existing team leader data...');
        const migrateSQL = `
      INSERT IGNORE INTO team_leaders (team_id, user_id, username)
      SELECT t.id, t.leader_id, t.leader_username 
      FROM teams t
      WHERE t.leader_id IS NOT NULL 
        AND t.leader_username IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM team_leaders tl 
          WHERE tl.team_id = t.id AND tl.user_id = t.leader_id
        )
    `;

        const result = await mysqlConfig.query(migrateSQL);
        console.log(`✅ Migrated ${result.affectedRows || 0} team leader assignments\n`);

        // Step 3: Verify migration
        console.log('📝 Step 3: Verifying migration...');
        const countResult = await mysqlConfig.query('SELECT COUNT(*) as count FROM team_leaders');
        console.log(`✅ team_leaders table now has ${countResult[0].count} entries\n`);

        // Step 4: Show teams with leaders
        console.log('📝 Step 4: Teams with their leaders:');
        const teamsResult = await mysqlConfig.query(`
      SELECT 
        t.name AS team_name,
        GROUP_CONCAT(tl.username) AS leaders
      FROM teams t
      LEFT JOIN team_leaders tl ON t.id = tl.team_id
      GROUP BY t.id, t.name
      ORDER BY t.name
    `);

        console.table(teamsResult);

        console.log('\n✅ Migration completed successfully!');
        console.log('💡 Please restart your application to see the changes.\n');

        await mysqlConfig.closePool();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        await mysqlConfig.closePool();
        process.exit(1);
    }
}

runFix();

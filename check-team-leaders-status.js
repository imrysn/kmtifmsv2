/**
 * Check Team Leaders Table Status
 * This script verifies the team_leaders table and its data
 */

const mysqlConfig = require('./database/config');

async function checkStatus() {
    console.log('🔍 Checking Team Leaders Table Status...\n');

    try {
        // Step 1: Check if table exists
        console.log('📝 Step 1: Checking if team_leaders table exists...');
        const tableCheck = await mysqlConfig.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_name = 'team_leaders'
    `);

        if (tableCheck[0].count === 0) {
            console.log('❌ team_leaders table DOES NOT EXIST!\n');
            console.log('💡 Solution: Run the migration:');
            console.log('   node run-team-leaders-fix.js\n');
            await mysqlConfig.closePool();
            process.exit(1);
        }

        console.log('✅ team_leaders table exists\n');

        // Step 2: Check row count
        console.log('📝 Step 2: Checking team_leaders data...');
        const countResult = await mysqlConfig.query('SELECT COUNT(*) as count FROM team_leaders');
        console.log(`   Found ${countResult[0].count} entries\n`);

        // Step 3: Show all team leaders
        console.log('📝 Step 3: Current team leader assignments:');
        const leaders = await mysqlConfig.query(`
      SELECT tl.*, t.name as team_name
      FROM team_leaders tl
      JOIN teams t ON tl.team_id = t.id
      ORDER BY t.name, tl.username
    `);

        if (leaders.length === 0) {
            console.log('   ⚠️  No team leaders found!\n');
            console.log('💡 This means the table exists but has no data.');
            console.log('   The migration may have run but found no leaders to migrate.\n');
            console.log('📝 Checking teams table for leader data...');

            const teamsWithLeaders = await mysqlConfig.query(`
        SELECT id, name, leader_id, leader_username
        FROM teams
        WHERE leader_id IS NOT NULL
      `);

            if (teamsWithLeaders.length > 0) {
                console.log(`   ✅ Found ${teamsWithLeaders.length} teams with leaders in teams table:`);
                console.table(teamsWithLeaders);
                console.log('\n💡 Run migration again to populate team_leaders:');
                console.log('   node run-team-leaders-fix.js\n');
            } else {
                console.log('   ❌ No leaders found in teams table either!\n');
                console.log('💡 You need to assign leaders to teams via the Admin UI.\n');
            }
        } else {
            console.table(leaders);
            console.log();
        }

        // Step 4: Test the GET /api/teams endpoint logic
        console.log('📝 Step 4: Testing the teams API query...');
        const teams = await mysqlConfig.query('SELECT * FROM teams ORDER BY name');

        console.log(`   Found ${teams.length} teams. Checking their leaders...\n`);

        for (const team of teams) {
            const teamLeaders = await mysqlConfig.query(`
        SELECT tl.user_id, tl.username, u.fullName 
        FROM team_leaders tl 
        LEFT JOIN users u ON tl.user_id = u.id 
        WHERE tl.team_id = ?
      `, [team.id]);

            console.log(`   ${team.name}:`);
            if (teamLeaders.length === 0) {
                console.log('     ❌ No leaders assigned');
            } else {
                teamLeaders.forEach(l => {
                    console.log(`     ✅ ${l.username} (${l.fullName || 'N/A'})`);
                });
            }
        }

        console.log('\n✅ Status check complete!\n');
        await mysqlConfig.closePool();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
        await mysqlConfig.closePool();
        process.exit(1);
    }
}

checkStatus();

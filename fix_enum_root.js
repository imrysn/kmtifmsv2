const { query } = require('./server/config/database');

async function fixEnum() {
    try {
        console.log('Altering files.status enum...');
        await query(`ALTER TABLE files MODIFY COLUMN status ENUM(
            'uploaded',
            'pending_team_leader',
            'pending_admin',
            'approved',
            'rejected',
            'under_revision',
            'team_leader_approved',
            'final_approved',
            'rejected_by_team_leader',
            'rejected_by_admin',
            'revision'
        ) NOT NULL DEFAULT 'uploaded'`);
        
        console.log('Updating files with empty status to "revision" (if they were supposed to be revisions)...');
        // Any file with empty status right now is likely an invalid insert of 'revision'
        await query("UPDATE files SET status = 'revision' WHERE status = ''");
        
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixEnum();

# Database Migration: Add "under_revision" Status

## What This Does
This migration adds the `under_revision` status to the files table, which enables the **📝 REVISED** badge to appear when users resubmit files that were previously rejected.

## How to Run the Migration

### Option 1: Using Node.js (Recommended)

1. **Update database credentials** in `run_add_under_revision_status.js`:
   ```javascript
   const dbConfig = {
     host: 'localhost',
     user: 'root',           // Your MySQL username
     password: 'your_password',  // Your MySQL password
     database: 'kmtifms'
   };
   ```

2. **Run the migration**:
   ```bash
   cd C:\kmti-V2\kmtifmsv2\database\migrations
   node run_add_under_revision_status.js
   ```

3. **Expected output**:
   ```
   🚀 Starting migration...
   🔄 Connecting to database...
   ✅ Connected to database
   🔄 Running migration: Add under_revision status...
   ✅ Migration completed successfully!
   📝 The files table now supports "under_revision" status
   ```

### Option 2: Using MySQL Workbench or Command Line

1. Open MySQL Workbench or MySQL command line
2. Connect to your `kmtifms` database
3. Run the SQL from `add_under_revision_status.sql`:

   ```sql
   USE kmtifms;
   
   ALTER TABLE files 
   MODIFY COLUMN status ENUM(
     'uploaded', 
     'pending_team_leader', 
     'pending_admin', 
     'approved', 
     'rejected',
     'under_revision',
     'team_leader_approved',
     'final_approved',
     'rejected_by_team_leader',
     'rejected_by_admin'
   ) NOT NULL DEFAULT 'uploaded';
   ```

## After Running the Migration

Once the migration is complete:
- Restart your server (if it's running)
- Upload a new file with the same name as a rejected file
- You should now see the **📝 REVISED** badge appear!

## Troubleshooting

### Error: Access Denied
- Update the database credentials in `run_add_under_revision_status.js`

### Error: Database doesn't exist
- Make sure the `kmtifms` database exists
- Check the database name in your config

### Migration already ran?
- It's safe to run this migration multiple times
- MySQL will update the ENUM if it's different

## Verification

To verify the migration worked:

```sql
SHOW COLUMNS FROM files WHERE Field = 'status';
```

You should see `under_revision` in the list of ENUM values.

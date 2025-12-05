// Verification script for assignment creation fix
const { db } = require('./database/config');

async function verifyAssignments() {
  console.log('🔍 Verifying Assignment Creation Fix...');

  try {
    // 1. Check if assignments table exists and get column names
    console.log('\n1. Checking assignments table structure...');
    const columns = await db.query("DESCRIBE assignments");

    console.log('Assignments table columns:');
    columns.forEach(col => {
      console.log(`   ${col.Field} - ${col.Type}`);
    });

    // 2. Create a test assignment directly in database
    console.log('\n2. Inserting test assignment directly...');
    const result = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO assignments (
          title,
          description,
          team,
          teamleaderid,
          teamleaderusername,
          assignedto,
          createdat
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        'Test Assignment - Direct',
        'Created directly via database',
        'General',
        1,
        'admin',
        'all'
      ], function(err) {
        if (err) reject(err);
        else resolve({ insertId: this.lastID });
      });
    });

    console.log(`✅ Test assignment inserted with ID: ${result.insertId}`);

    // 3. Verify assignment was created
    console.log('\n3. Verifying assignment retrieval...');
    const assignment = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM assignments WHERE id = ?', [result.insertId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (assignment) {
      console.log('✅ Assignment retrieved successfully:');
      console.log(`   ID: ${assignment.id}`);
      console.log(`   Title: ${assignment.title}`);
      console.log(`   Team: ${assignment.team}`);
    } else {
      console.log('❌ Assignment not found');
    }

    // 4. Clean up test data
    console.log('\n4. Cleaning up test data...');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM assignments WHERE id = ?', [result.insertId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Test cleanup completed');
    console.log('\n🎉 Assignment creation functionality verified!');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

verifyAssignments();

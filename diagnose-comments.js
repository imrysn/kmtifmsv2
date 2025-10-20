// Diagnostic script to check comments system
const path = require('path');
require('dotenv').config();

// Load database configuration
const { db, USE_MYSQL } = require('./server/config/database');

console.log('\n🔍 COMMENTS DIAGNOSTIC TOOL\n');
console.log('Database Type:', USE_MYSQL ? 'MySQL' : 'SQLite');
console.log('=' .repeat(50));

async function runDiagnostics() {
  try {
    // Test 1: Check if file_comments table exists
    console.log('\n📋 Test 1: Checking if file_comments table exists...');
    
    const tableCheckQuery = USE_MYSQL 
      ? "SHOW TABLES LIKE 'file_comments'"
      : "SELECT name FROM sqlite_master WHERE type='table' AND name='file_comments'";
    
    if (USE_MYSQL) {
      const tables = await db.all(tableCheckQuery, []);
      if (tables.length > 0) {
        console.log('✅ file_comments table exists');
      } else {
        console.log('❌ file_comments table does NOT exist!');
        console.log('\n💡 Solution: Run the database migration script:');
        console.log('   node database/recreate-tables.js');
        return;
      }
    } else {
      db.get(tableCheckQuery, [], (err, result) => {
        if (err) {
          console.error('❌ Error checking table:', err);
          return;
        }
        if (result) {
          console.log('✅ file_comments table exists');
          runTest2();
        } else {
          console.log('❌ file_comments table does NOT exist!');
          console.log('\n💡 Solution: The table needs to be created.');
          console.log('   Check if your database initialization ran correctly.');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function runTest2() {
  // Test 2: Check table structure
  console.log('\n📋 Test 2: Checking table structure...');
  
  const query = USE_MYSQL
    ? "DESCRIBE file_comments"
    : "PRAGMA table_info(file_comments)";
  
  db.all(query, [], (err, columns) => {
    if (err) {
      console.error('❌ Error checking table structure:', err);
      return;
    }
    
    console.log('✅ Table structure:');
    columns.forEach(col => {
      const colName = col.Field || col.name;
      const colType = col.Type || col.type;
      console.log(`   - ${colName}: ${colType}`);
    });
    
    runTest3();
  });
}

function runTest3() {
  // Test 3: Count total comments
  console.log('\n📋 Test 3: Counting comments in database...');
  
  db.get('SELECT COUNT(*) as count FROM file_comments', [], (err, result) => {
    if (err) {
      console.error('❌ Error counting comments:', err);
      return;
    }
    
    const count = result.count || 0;
    console.log(`✅ Total comments in database: ${count}`);
    
    if (count === 0) {
      console.log('\n⚠️  No comments found in database!');
      console.log('   This could mean:');
      console.log('   1. Team leaders/admins haven\'t added any comments yet');
      console.log('   2. Comments are failing to save');
      console.log('   3. Comments are being saved to a different database');
    }
    
    runTest4();
  });
}

function runTest4() {
  // Test 4: Get a sample of recent comments
  console.log('\n📋 Test 4: Getting sample comments...');
  
  db.all('SELECT * FROM file_comments ORDER BY created_at DESC LIMIT 5', [], (err, comments) => {
    if (err) {
      console.error('❌ Error getting comments:', err);
      return;
    }
    
    if (comments.length > 0) {
      console.log(`✅ Found ${comments.length} recent comments:`);
      comments.forEach((comment, i) => {
        console.log(`\n   Comment #${i + 1}:`);
        console.log(`   - File ID: ${comment.file_id}`);
        console.log(`   - User: ${comment.username} (${comment.user_role})`);
        console.log(`   - Comment: ${comment.comment?.substring(0, 50)}${comment.comment?.length > 50 ? '...' : ''}`);
        console.log(`   - Type: ${comment.comment_type}`);
        console.log(`   - Date: ${comment.created_at}`);
      });
    } else {
      console.log('❌ No comments found');
    }
    
    runTest5();
  });
}

function runTest5() {
  // Test 5: Check files table
  console.log('\n📋 Test 5: Checking files with comments...');
  
  const query = `
    SELECT 
      f.id,
      f.original_name,
      f.username,
      f.status,
      COUNT(fc.id) as comment_count
    FROM files f
    LEFT JOIN file_comments fc ON f.id = fc.file_id
    GROUP BY f.id
    HAVING comment_count > 0
    ORDER BY comment_count DESC
    LIMIT 5
  `;
  
  db.all(query, [], (err, files) => {
    if (err) {
      console.error('❌ Error querying files with comments:', err);
      return;
    }
    
    if (files.length > 0) {
      console.log(`✅ Found ${files.length} files with comments:`);
      files.forEach((file, i) => {
        console.log(`\n   File #${i + 1}:`);
        console.log(`   - ID: ${file.id}`);
        console.log(`   - Name: ${file.original_name}`);
        console.log(`   - User: ${file.username}`);
        console.log(`   - Status: ${file.status}`);
        console.log(`   - Comments: ${file.comment_count}`);
      });
    } else {
      console.log('❌ No files have comments');
    }
    
    runTest6();
  });
}

function runTest6() {
  // Test 6: Check if team_leader_comments or admin_comments fields have data
  console.log('\n📋 Test 6: Checking for comments in file records...');
  
  const query = `
    SELECT 
      id,
      original_name,
      username,
      status,
      team_leader_comments,
      admin_comments
    FROM files
    WHERE team_leader_comments IS NOT NULL OR admin_comments IS NOT NULL
    LIMIT 5
  `;
  
  db.all(query, [], (err, files) => {
    if (err) {
      console.error('❌ Error checking file comments:', err);
      finishDiagnostics();
      return;
    }
    
    if (files.length > 0) {
      console.log(`✅ Found ${files.length} files with inline comments:`);
      files.forEach((file, i) => {
        console.log(`\n   File #${i + 1}:`);
        console.log(`   - ID: ${file.id}`);
        console.log(`   - Name: ${file.original_name}`);
        console.log(`   - Status: ${file.status}`);
        if (file.team_leader_comments) {
          console.log(`   - TL Comment: ${file.team_leader_comments.substring(0, 50)}...`);
        }
        if (file.admin_comments) {
          console.log(`   - Admin Comment: ${file.admin_comments.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('❌ No files have inline comments');
    }
    
    finishDiagnostics();
  });
}

function finishDiagnostics() {
  console.log('\n' + '='.repeat(50));
  console.log('\n📝 SUMMARY & RECOMMENDATIONS:\n');
  console.log('1. Check if comments are being saved to file_comments table');
  console.log('2. Check if team leader/admin review is working correctly');
  console.log('3. Verify the API endpoint /api/files/:fileId/comments is working');
  console.log('4. Check browser console for any errors when loading comments');
  console.log('\n💡 To test manually:');
  console.log('   1. Have a team leader review a file with comments');
  console.log('   2. Check database: SELECT * FROM file_comments;');
  console.log('   3. Try API: GET http://localhost:3001/api/files/1/comments');
  console.log('\n✨ Diagnostic complete!\n');
  
  // Close database connection
  if (USE_MYSQL) {
    const { closeDatabase } = require('./server/config/database');
    closeDatabase().then(() => process.exit(0));
  } else {
    setTimeout(() => {
      db.close(() => {
        process.exit(0);
      });
    }, 1000);
  }
}

// Run diagnostics
if (USE_MYSQL) {
  runDiagnostics();
} else {
  runDiagnostics();
}

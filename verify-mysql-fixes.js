// MySQL Implementation Verification Script
// Tests all critical fixes and validates system is ready for production

const { getPool, testConnection, closePool } = require('./database/config');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  log('='.repeat(70), 'cyan');
}

async function runVerification() {
  log('\n🔍 KMTIFMS2 MySQL Implementation Verification\n', 'cyan');
  separator();
  
  let passedTests = 0;
  let failedTests = 0;
  const issues = [];
  
  try {
    // TEST 1: Database Connection
    log('\n📡 TEST 1: Database Connection', 'blue');
    log('   Testing MySQL connectivity...', 'yellow');
    
    const connected = await testConnection();
    if (connected) {
      log('   ✅ PASS: Database connection successful', 'green');
      passedTests++;
    } else {
      log('   ❌ FAIL: Cannot connect to database', 'red');
      failedTests++;
      issues.push('Database connection failed - check credentials and MySQL server');
      throw new Error('Connection test failed');
    }
    
    const pool = getPool();
    
    // TEST 2: Schema Verification
    log('\n📋 TEST 2: Database Schema', 'blue');
    log('   Checking required tables...', 'yellow');
    
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const requiredTables = ['users', 'teams', 'files', 'file_comments', 
                           'file_status_history', 'activity_logs'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length === 0) {
      log(`   ✅ PASS: All ${requiredTables.length} required tables present`, 'green');
      passedTests++;
    } else {
      log(`   ❌ FAIL: Missing tables: ${missingTables.join(', ')}`, 'red');
      failedTests++;
      issues.push(`Missing tables: ${missingTables.join(', ')} - Run: npm run db:init`);
    }
    
    // TEST 3: Enum Definitions (Critical Fix #1)
    log('\n🔧 TEST 3: Status Enum Definitions (Critical Fix)', 'blue');
    log('   Verifying files table enum values...', 'yellow');
    
    const [columns] = await pool.query("SHOW COLUMNS FROM files WHERE Field IN ('status', 'current_stage')");
    
    let enumsCorrect = true;
    
    // Check status enum
    const statusColumn = columns.find(c => c.Field === 'status');
    if (statusColumn) {
      const statusEnums = statusColumn.Type.match(/enum\((.*)\)/i)[1].split(',').map(s => s.replace(/'/g, ''));
      const requiredStatusEnums = ['uploaded', 'team_leader_approved', 'admin_approved', 
                                   'rejected_by_team_leader', 'rejected_by_admin', 'final_approved'];
      
      const missingStatus = requiredStatusEnums.filter(e => !statusEnums.includes(e));
      if (missingStatus.length === 0) {
        log('   ✅ Status enum: All required values present', 'green');
      } else {
        log(`   ❌ Status enum: Missing values: ${missingStatus.join(', ')}`, 'red');
        enumsCorrect = false;
        issues.push(`Status enum missing values: ${missingStatus.join(', ')}`);
      }
    }
    
    // Check current_stage enum
    const stageColumn = columns.find(c => c.Field === 'current_stage');
    if (stageColumn) {
      const stageEnums = stageColumn.Type.match(/enum\((.*)\)/i)[1].split(',').map(s => s.replace(/'/g, ''));
      const requiredStageEnums = ['pending_team_leader', 'pending_admin', 'published_to_public',
                                  'rejected_by_team_leader', 'rejected_by_admin'];
      
      const missingStage = requiredStageEnums.filter(e => !stageEnums.includes(e));
      if (missingStage.length === 0) {
        log('   ✅ Stage enum: All required values present', 'green');
      } else {
        log(`   ❌ Stage enum: Missing values: ${missingStage.join(', ')}`, 'red');
        enumsCorrect = false;
        issues.push(`Stage enum missing values: ${missingStage.join(', ')}`);
      }
    }
    
    if (enumsCorrect) {
      log('   ✅ PASS: All enum definitions correct', 'green');
      passedTests++;
    } else {
      log('   ❌ FAIL: Enum definitions incomplete', 'red');
      failedTests++;
      issues.push('Run: npm run db:init to recreate tables with correct enums');
    }
    
    // TEST 4: Default Data
    log('\n👤 TEST 4: Default Data', 'blue');
    log('   Checking default admin user and team...', 'yellow');
    
    const [adminUsers] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    const [generalTeam] = await pool.query("SELECT * FROM teams WHERE name = 'General'");
    
    let defaultDataCorrect = true;
    
    if (adminUsers.length > 0) {
      log('   ✅ Default admin user exists', 'green');
    } else {
      log('   ❌ Default admin user missing', 'red');
      defaultDataCorrect = false;
      issues.push('Default admin user missing - Run: npm run db:init');
    }
    
    if (generalTeam.length > 0) {
      log('   ✅ Default General team exists', 'green');
    } else {
      log('   ❌ Default General team missing', 'red');
      defaultDataCorrect = false;
      issues.push('Default General team missing - Run: npm run db:init');
    }
    
    if (defaultDataCorrect) {
      log('   ✅ PASS: Default data present', 'green');
      passedTests++;
    } else {
      log('   ❌ FAIL: Default data incomplete', 'red');
      failedTests++;
    }
    
    // TEST 5: Connection Pool
    log('\n🏊 TEST 5: Connection Pool', 'blue');
    log('   Testing connection pool configuration...', 'yellow');
    
    const [poolStatus] = await pool.query("SHOW STATUS LIKE 'Threads_connected'");
    const activeConnections = parseInt(poolStatus[0].Value);
    
    if (activeConnections > 0 && activeConnections <= 10) {
      log(`   ✅ PASS: Connection pool healthy (${activeConnections} active connections)`, 'green');
      passedTests++;
    } else if (activeConnections > 10) {
      log(`   ⚠️  WARNING: High connection count (${activeConnections} connections)`, 'yellow');
      log('   ✅ PASS: Pool working but consider increasing limit', 'green');
      passedTests++;
      issues.push(`${activeConnections} connections active - Consider increasing pool limit if needed`);
    } else {
      log('   ❌ FAIL: Connection pool issue', 'red');
      failedTests++;
      issues.push('Connection pool not working correctly');
    }
    
    // TEST 6: Write Permissions
    log('\n🔐 TEST 6: Write Permissions', 'blue');
    log('   Testing database write permissions...', 'yellow');
    
    try {
      await pool.query('CREATE TEMPORARY TABLE test_permissions (id INT)');
      await pool.query('INSERT INTO test_permissions (id) VALUES (1)');
      await pool.query('SELECT * FROM test_permissions');
      await pool.query('DROP TEMPORARY TABLE test_permissions');
      log('   ✅ PASS: Write permissions OK', 'green');
      passedTests++;
    } catch (error) {
      log(`   ❌ FAIL: Write permissions denied: ${error.message}`, 'red');
      failedTests++;
      issues.push('Database write permissions denied - Check user privileges');
    }
    
    // TEST 7: Indexes
    log('\n📊 TEST 7: Database Indexes', 'blue');
    log('   Checking performance indexes...', 'yellow');
    
    const criticalIndexes = [
      { table: 'users', column: 'email' },
      { table: 'users', column: 'username' },
      { table: 'files', column: 'user_id' },
      { table: 'files', column: 'current_stage' },
      { table: 'activity_logs', column: 'timestamp' }
    ];
    
    let allIndexesPresent = true;
    for (const idx of criticalIndexes) {
      const [indexes] = await pool.query(`SHOW INDEX FROM ${idx.table} WHERE Column_name = ?`, [idx.column]);
      if (indexes.length === 0) {
        log(`   ⚠️  Index missing: ${idx.table}.${idx.column}`, 'yellow');
        allIndexesPresent = false;
      }
    }
    
    if (allIndexesPresent) {
      log('   ✅ PASS: All critical indexes present', 'green');
      passedTests++;
    } else {
      log('   ⚠️  WARNING: Some indexes missing (performance may be affected)', 'yellow');
      log('   ✅ PASS: Database functional but not optimized', 'green');
      passedTests++;
    }
    
    // SUMMARY
    separator();
    log('\n📈 VERIFICATION SUMMARY\n', 'cyan');
    
    log(`   Tests Passed: ${passedTests}`, 'green');
    if (failedTests > 0) {
      log(`   Tests Failed: ${failedTests}`, 'red');
    }
    log(`   Total Tests: ${passedTests + failedTests}`, 'blue');
    
    if (issues.length > 0) {
      log('\n⚠️  ISSUES FOUND:\n', 'yellow');
      issues.forEach((issue, i) => {
        log(`   ${i + 1}. ${issue}`, 'yellow');
      });
    }
    
    separator();
    
    if (failedTests === 0) {
      log('\n✅ ALL CRITICAL TESTS PASSED!\n', 'green');
      log('🎉 MySQL implementation is ready for testing', 'green');
      log('\n📝 Next Steps:', 'cyan');
      log('   1. Start server: npm run server:standalone', 'cyan');
      log('   2. Test API endpoints', 'cyan');
      log('   3. Test file upload workflow', 'cyan');
      log('   4. Test with multiple concurrent users', 'cyan');
      log('   5. Deploy to production\n', 'cyan');
      return true;
    } else {
      log('\n❌ VERIFICATION FAILED\n', 'red');
      log('⚠️  Please fix the issues above before deployment', 'yellow');
      log('\n💡 Common Fixes:', 'cyan');
      log('   - Run: npm run db:init (recreate tables)', 'cyan');
      log('   - Check MySQL server is running', 'cyan');
      log('   - Verify database credentials in .env\n', 'cyan');
      return false;
    }
    
  } catch (error) {
    log('\n❌ VERIFICATION ERROR\n', 'red');
    log(`Error: ${error.message}`, 'red');
    log('\n💡 Troubleshooting:', 'cyan');
    log('   1. Ensure MySQL server is running', 'cyan');
    log('   2. Check database credentials in .env', 'cyan');
    log('   3. Verify network connectivity to KMTI-NAS', 'cyan');
    log('   4. Run: npm run db:test\n', 'cyan');
    return false;
  } finally {
    await closePool();
  }
}

// Run verification
if (require.main === module) {
  runVerification()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runVerification };

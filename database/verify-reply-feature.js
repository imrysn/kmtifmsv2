#!/usr/bin/env node

/**
 * Verification Script for Reply Feature
 * Checks if all components are properly set up
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function check(passed, message) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  console.log(`${color}${icon} ${message}${colors.reset}`);
  return passed;
}

async function verify() {
  let connection;
  let allPassed = true;

  console.log(`\n${colors.bright}${colors.cyan}Verifying Reply Feature Setup...${colors.reset}\n`);

  try {
    // Check 1: Database connection
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kmtifms'
      });
      allPassed &= check(true, 'Database connection');
    } catch (error) {
      allPassed &= check(false, `Database connection: ${error.message}`);
      throw error;
    }

    // Check 2: comment_replies table exists
    const [tables] = await connection.query("SHOW TABLES LIKE 'comment_replies'");
    const tableExists = tables.length > 0;
    allPassed &= check(tableExists, 'comment_replies table exists');

    if (tableExists) {
      // Check 3: Table structure
      const [columns] = await connection.query('DESCRIBE comment_replies');
      const requiredColumns = ['id', 'comment_id', 'user_id', 'username', 'reply', 'created_at'];
      const existingColumns = columns.map(col => col.Field);
      
      const hasAllColumns = requiredColumns.every(col => existingColumns.includes(col));
      allPassed &= check(hasAllColumns, 'Table has all required columns');

      // Check 4: Foreign key constraints
      const [fkInfo] = await connection.query(`
        SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'comment_replies' AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [process.env.DB_NAME || 'kmtifms']);
      
      const hasForeignKeys = fkInfo.length >= 2;
      allPassed &= check(hasForeignKeys, 'Foreign key constraints are set');

      // Check 5: Sample data count
      const [countResult] = await connection.query('SELECT COUNT(*) as count FROM comment_replies');
      const replyCount = countResult[0].count;
      console.log(`${colors.cyan}ℹ️  Current replies in database: ${replyCount}${colors.reset}`);
    }

    // Check 6: Frontend files exist
    const frontendFiles = [
      path.join(__dirname, '..', 'client', 'src', 'components', 'user', 'TasksTab-Enhanced.jsx'),
      path.join(__dirname, '..', 'client', 'src', 'components', 'user', 'css', 'TasksTab-Enhanced.css')
    ];

    for (const file of frontendFiles) {
      const exists = fs.existsSync(file);
      const filename = path.basename(file);
      allPassed &= check(exists, `Frontend file: ${filename}`);
    }

    // Check 7: Backend routes file
    const routesFile = path.join(__dirname, '..', 'server', 'routes', 'assignments.js');
    const routesExists = fs.existsSync(routesFile);
    allPassed &= check(routesExists, 'Backend routes file exists');

    if (routesExists) {
      const routesContent = fs.readFileSync(routesFile, 'utf8');
      const hasReplyEndpoint = routesContent.includes('/:commentId/replies');
      allPassed &= check(hasReplyEndpoint, 'Reply endpoint exists in routes');
    }

    // Check 8: Migration files
    const migrationFile = path.join(__dirname, 'add-comment-replies-migration.js');
    const sqlFile = path.join(__dirname, 'sql', 'add-comment-replies.sql');
    
    allPassed &= check(fs.existsSync(migrationFile), 'Migration script exists');
    allPassed &= check(fs.existsSync(sqlFile), 'SQL migration file exists');

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log(`${colors.bright}${colors.green}✨ All checks passed! Reply feature is ready.${colors.reset}`);
      console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
      console.log('1. Restart your backend server');
      console.log('2. Refresh your browser');
      console.log('3. Try posting a reply to a comment');
    } else {
      console.log(`${colors.bright}${colors.red}⚠️  Some checks failed. See above for details.${colors.reset}`);
      console.log(`\n${colors.yellow}Run the setup script:${colors.reset}`);
      console.log('cd database && node setup-reply-feature.js');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error(`\n${colors.red}Error during verification:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verify();

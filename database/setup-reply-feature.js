#!/usr/bin/env node

/**
 * Quick Setup Script for Facebook-Style Reply Feature
 * This script will:
 * 1. Create the comment_replies table
 * 2. Verify the setup
 * 3. Show next steps
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(70));
  log(message, colors.bright + colors.cyan);
  console.log('='.repeat(70) + '\n');
}

async function setupReplyFeature() {
  let connection;

  try {
    header('🚀 REPLY FEATURE SETUP');

    // Show configuration
    log('📋 Using configuration:', colors.cyan);
    log(`   Host: ${process.env.DB_HOST || 'localhost'}`, colors.blue);
    log(`   Database: ${process.env.DB_NAME || 'kmtifms'}`, colors.blue);
    log(`   User: ${process.env.DB_USER || 'root'}`, colors.blue);

    log('\n📋 Step 1: Connecting to database...', colors.yellow);
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kmtifms',
      multipleStatements: true
    });

    log('✅ Connected successfully!', colors.green);

    log('\n📋 Step 2: Creating comment_replies table...', colors.yellow);
    
    const sqlFile = path.join(__dirname, 'sql', 'add-comment-replies.sql');
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found at: ${sqlFile}`);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    await connection.query(sql);

    log('✅ Table created successfully!', colors.green);

    log('\n📋 Step 3: Verifying setup...', colors.yellow);
    
    // Check if table exists
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'comment_replies'"
    );

    if (tables.length === 0) {
      throw new Error('comment_replies table was not created');
    }

    log('✅ Table verified!', colors.green);

    // Show table structure
    const [columns] = await connection.query('DESCRIBE comment_replies');
    
    log('\n📊 Table Structure:', colors.cyan);
    console.table(columns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default
    })));

    // Check for existing data
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as count FROM comment_replies'
    );
    
    const count = countResult[0].count;
    log(`\n📈 Current replies in database: ${count}`, colors.blue);

    header('✨ SETUP COMPLETE!');

    log('Next steps:', colors.bright);
    log('1. ✅ Database setup is complete', colors.green);
    log('2. 🔄 Restart your backend server:', colors.yellow);
    log('   npm start', colors.cyan);
    log('3. 🌐 Refresh your browser (Ctrl+Shift+R)', colors.yellow);
    log('4. 💬 Try posting a comment and clicking "Reply"!', colors.yellow);

    log('\n📚 For more information, see:', colors.blue);
    log('   REPLY_FEATURE_SETUP_GUIDE.md', colors.cyan);

    log('\n🎉 You\'re all set!', colors.bright + colors.green);

  } catch (error) {
    log('\n❌ ERROR:', colors.bright + colors.red);
    log(error.message, colors.red);
    
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      log('\n💡 The table already exists! You\'re good to go.', colors.yellow);
      log('Just restart your server and refresh your browser.', colors.yellow);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      log('\n💡 Database access denied. Check your credentials in .env file', colors.yellow);
      log('   Current config:', colors.cyan);
      log(`   Host: ${process.env.DB_HOST}`, colors.blue);
      log(`   User: ${process.env.DB_USER}`, colors.blue);
      log(`   Database: ${process.env.DB_NAME}`, colors.blue);
    } else if (error.code === 'ENOTFOUND') {
      log('\n💡 Cannot find database server. Check your network connection.', colors.yellow);
      log(`   Trying to connect to: ${process.env.DB_HOST}`, colors.blue);
      log('   Make sure KMTI-NAS server is accessible.', colors.yellow);
    } else if (error.code === 'ECONNREFUSED') {
      log('\n💡 Connection refused. Is MySQL running on the server?', colors.yellow);
      log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`, colors.blue);
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      log('\n💡 Database doesn\'t exist. Checking available databases...', colors.yellow);
      
      // Try to connect without database and list databases
      try {
        const conn = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 3306,
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || ''
        });
        
        const [databases] = await conn.query('SHOW DATABASES');
        log('\n📋 Available databases:', colors.cyan);
        databases.forEach(db => {
          log(`   • ${db.Database}`, colors.blue);
        });
        
        log('\n💡 Update your .env file with the correct DB_NAME', colors.yellow);
        await conn.end();
      } catch (listError) {
        log('\n   Could not list databases. Check your connection.', colors.red);
      }
    } else {
      log('\nFull error details:', colors.red);
      console.error(error);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log('\n🔌 Database connection closed', colors.blue);
    }
  }
}

// ASCII Art Banner
console.log(colors.bright + colors.cyan);
console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   📝  Facebook-Style Reply Feature Setup                     ║
  ║   💬  Adding nested comments to your Tasks system            ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
` + colors.reset);

// Run setup
setupReplyFeature().catch(error => {
  log('\n💥 Unexpected error:', colors.red);
  console.error(error);
  process.exit(1);
});

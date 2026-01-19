/**
 * Fix missing fullnames in comments and replies
 * This script backfills user_fullname for old comments that don't have it
 */

require('dotenv').config();
const { query } = require('./config');

async function fixCommentsFullname() {
  console.log('🔧 Starting fullname backfill for comments...\n');

  try {
    // Check current state
    console.log('📊 Checking current state...');
    
    const commentStats = await query(`
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
      FROM assignment_comments
    `);
    
    const replyStats = await query(`
      SELECT 
        COUNT(*) as total_replies,
        SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
      FROM comment_replies
    `);
    
    console.log(`📝 Comments: ${commentStats[0].total_comments} total, ${commentStats[0].missing_fullname} missing fullname`);
    console.log(`💬 Replies: ${replyStats[0].total_replies} total, ${replyStats[0].missing_fullname} missing fullname\n`);
    
    if (commentStats[0].missing_fullname === 0 && replyStats[0].missing_fullname === 0) {
      console.log('✅ All comments and replies already have fullnames! No fix needed.\n');
      process.exit(0);
    }
    
    // Fix assignment_comments
    if (commentStats[0].missing_fullname > 0) {
      console.log(`🔧 Fixing ${commentStats[0].missing_fullname} comments...`);
      
      const result = await query(`
        UPDATE assignment_comments ac
        JOIN users u ON ac.user_id = u.id
        SET ac.user_fullname = u.fullName
        WHERE ac.user_fullname IS NULL OR ac.user_fullname = ''
      `);
      
      console.log(`✅ Updated ${result.affectedRows} comments`);
    }
    
    // Fix comment_replies
    if (replyStats[0].missing_fullname > 0) {
      console.log(`🔧 Fixing ${replyStats[0].missing_fullname} replies...`);
      
      const result = await query(`
        UPDATE comment_replies cr
        JOIN users u ON cr.user_id = u.id
        SET cr.user_fullname = u.fullName
        WHERE cr.user_fullname IS NULL OR cr.user_fullname = ''
      `);
      
      console.log(`✅ Updated ${result.affectedRows} replies`);
    }
    
    // Verify the fix
    console.log('\n📊 Verifying fix...');
    
    const finalCommentStats = await query(`
      SELECT 
        COUNT(*) as total_comments,
        SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
      FROM assignment_comments
    `);
    
    const finalReplyStats = await query(`
      SELECT 
        COUNT(*) as total_replies,
        SUM(CASE WHEN user_fullname IS NULL OR user_fullname = '' THEN 1 ELSE 0 END) as missing_fullname
      FROM comment_replies
    `);
    
    console.log(`📝 Comments: ${finalCommentStats[0].total_comments} total, ${finalCommentStats[0].missing_fullname} missing fullname`);
    console.log(`💬 Replies: ${finalReplyStats[0].total_replies} total, ${finalReplyStats[0].missing_fullname} missing fullname`);
    
    if (finalCommentStats[0].missing_fullname === 0 && finalReplyStats[0].missing_fullname === 0) {
      console.log('\n✅ SUCCESS! All comments and replies now have fullnames.\n');
    } else {
      console.log('\n⚠️ WARNING: Some comments/replies still missing fullnames. Check database manually.\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error fixing comments:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixCommentsFullname();

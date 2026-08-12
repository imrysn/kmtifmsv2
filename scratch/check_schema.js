const { db } = require('../server/config/database');

async function checkSchema() {
  try {
    console.log('🔍 Checking file_views schema...');
    const columns = await db.all('SHOW COLUMNS FROM file_views');
    console.log('✅ file_views columns:', columns);

    console.log('🔍 Checking file_comments schema...');
    const columns2 = await db.all('SHOW COLUMNS FROM file_comments');
    console.log('✅ file_comments columns:', columns2);

    console.log('🔍 Checking files schema...');
    const columns3 = await db.all('SHOW COLUMNS FROM files');
    console.log('✅ files columns:', columns3);

    console.log('🔍 Checking assignment_members schema...');
    const columns4 = await db.all('SHOW COLUMNS FROM assignment_members');
    console.log('✅ assignment_members columns:', columns4);

    console.log('🔍 Checking notifications schema...');
    const columns5 = await db.all('SHOW COLUMNS FROM notifications');
    console.log('✅ notifications columns:', columns5);

    console.log('🔍 Checking file_status_history schema...');
    const columns6 = await db.all('SHOW COLUMNS FROM file_status_history');
    console.log('✅ file_status_history columns:', columns6);

    console.log('🔍 Checking assignment_submissions schema...');
    const columns7 = await db.all('SHOW COLUMNS FROM assignment_submissions');
    console.log('✅ assignment_submissions columns:', columns7);

    console.log('🔍 Checking assignment_attachments schema...');
    const columns8 = await db.all('SHOW COLUMNS FROM assignment_attachments');
    console.log('✅ assignment_attachments columns:', columns8);
  } catch (err) {
    console.error('❌ Error checking schema:', err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();

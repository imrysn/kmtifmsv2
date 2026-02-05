const path = require('path');
const addFolderColumns = require(path.join(__dirname, './003-add-folder-support'));

console.log('🚀 Starting folder support migration...\n');

addFolderColumns()
  .then(() => {
    console.log('\n✅ Folder support migration completed successfully!');
    console.log('📁 Files table now supports folder uploads\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });

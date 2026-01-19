const { query } = require('../../database/config');

async function addTagColumn() {
  try {
    console.log('🔄 Adding tag column to files table...');

    // Check if column already exists
    const checkColumn = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'files' 
      AND COLUMN_NAME = 'tag'
    `);

    if (checkColumn && checkColumn.length > 0) {
      console.log('✅ Tag column already exists');
      return;
    }

    // Add the tag column
    await query('ALTER TABLE files ADD COLUMN tag VARCHAR(100)');
    console.log('✅ Successfully added tag column to files table');

    // Add index for better performance
    await query('CREATE INDEX idx_files_tag ON files(tag)');
    console.log('✅ Successfully added index on tag column');

  } catch (error) {
    console.error('❌ Error adding tag column:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addTagColumn()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addTagColumn;

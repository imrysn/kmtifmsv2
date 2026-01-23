const mysqlConfig = require('./config');

console.log('🔧 Creating custom_tags table for MySQL...');

async function createCustomTagsTable() {
  try {
    // Test connection
    const connected = await mysqlConfig.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to MySQL database');
    }

    // Create custom_tags table
    await mysqlConfig.query(`
      CREATE TABLE IF NOT EXISTS custom_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_name VARCHAR(255) NOT NULL UNIQUE,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ custom_tags table created successfully');

    // Create indexes (MySQL doesn't support IF NOT EXISTS for indexes)
    try {
      await mysqlConfig.query(`
        CREATE INDEX idx_custom_tags_name ON custom_tags(tag_name)
      `);
      console.log('✅ tag_name index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  tag_name index already exists');
      } else {
        throw err;
      }
    }

    try {
      await mysqlConfig.query(`
        CREATE INDEX idx_custom_tags_created_by ON custom_tags(created_by)
      `);
      console.log('✅ created_by index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  created_by index already exists');
      } else {
        throw err;
      }
    }

    // Verify table
    const tables = await mysqlConfig.query(`
      SHOW TABLES LIKE 'custom_tags'
    `);

    if (tables.length > 0) {
      console.log('✅ custom_tags table verified');
      
      // Show table structure
      const columns = await mysqlConfig.query(`DESCRIBE custom_tags`);
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('❌ Table verification failed');
    }

    console.log('\n✅ Migration completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

createCustomTagsTable();

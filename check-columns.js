const { db } = require('./database/config');

console.log('🔍 Checking assignments table columns...');

db.all("DESCRIBE assignments", [], (err, columns) => {
  if (err) {
    console.error('❌ Error describing table:', err.message);
    return;
  }

  console.log('📋 Assignments table columns:');
  columns.forEach(col => {
    console.log(`   ${col.Field} - ${col.Type}`);
  });

  process.exit(0);
});

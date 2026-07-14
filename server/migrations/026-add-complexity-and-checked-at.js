const { query } = require('../config/database');

async function up() {
  console.log('Running migration 026-add-complexity-and-checked-at...');
  
  // Add complexity to assignments
  try {
    await query("ALTER TABLE assignments ADD COLUMN complexity ENUM('Low', 'Medium', 'High') DEFAULT 'Medium'");
    console.log('Added complexity column to assignments table');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    console.log('Column complexity already exists on assignments table');
  }

  // Add checked_at to files
  try {
    await query("ALTER TABLE files ADD COLUMN checked_at DATETIME NULL");
    console.log('Added checked_at column to files table');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    console.log('Column checked_at already exists on files table');
  }
}

async function down() {
  await query('ALTER TABLE assignments DROP COLUMN complexity');
  await query('ALTER TABLE files DROP COLUMN checked_at');
}

module.exports = { up, down };

/**
 * Migration 023: Add mistakes_count column to files table.
 */

const { query } = require('../config/database');

async function up() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'files'
        AND COLUMN_NAME = 'mistakes_count'
    `);

    if (cols && cols.length > 0) {
      console.log('✅ [023] files.mistakes_count already exists — skipping.');
      return true;
    }

    await query(`
      ALTER TABLE files
      ADD COLUMN mistakes_count INT DEFAULT 0
    `);
    console.log('✅ [023] files.mistakes_count column added.');

    // Backfill
    const filesWithNotes = await query(`
      SELECT id, checker_note FROM files WHERE checker_note IS NOT NULL AND checker_note != ''
    `);

    let backfilled = 0;
    if (filesWithNotes && filesWithNotes.length > 0) {
      for (const file of filesWithNotes) {
        // Parse mistakes
        const note = file.checker_note;
        let mistakesCount = 0;
        const match = note.match(/Wrong items?:\s*(.+?)(?:\||$)/i);
        if (match) {
          mistakesCount = match[1].split(',').filter(s => s.trim().length > 0).length;
        }

        if (mistakesCount > 0) {
          await query('UPDATE files SET mistakes_count = ? WHERE id = ?', [mistakesCount, file.id]);
          backfilled++;
        }
      }
    }
    console.log(`✅ [023] Backfilled ${backfilled} files with mistakes_count.`);

    return true;
  } catch (error) {
    console.error('❌ [023] Migration failed:', error.message);
    return true;
  }
}

module.exports = up;

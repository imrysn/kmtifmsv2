/**
 * fix-japanese-filenames.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Repairs garbled (mojibake) filenames for Japanese, Chinese, Korean and other
 * multibyte characters that were stored with incorrect latin1 encoding.
 *
 * Root cause: multer/busboy decoded multipart Content-Disposition filename
 * headers as latin1 (ISO-8859-1) instead of UTF-8. This script re-decodes the
 * stored garbled strings back to their correct form.
 *
 * Run: node fix-japanese-filenames.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// ── Config ───────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host:     process.env.DB_HOST     || '192.168.200.110',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'kmtifms_user',
  password: process.env.DB_PASSWORD || 'Ph15IcadRs',
  database: process.env.DB_NAME     || 'kmtifms',
};

// ── Helper: re-decode a latin1-garbled string as UTF-8 ───────────────────────
function fixName(name) {
  if (!name || typeof name !== 'string') return name;
  try {
    const reDecoded = Buffer.from(name, 'latin1').toString('utf8');
    // Only use the re-decoded version when:
    //   1. It differs from the original (something actually changed)
    //   2. It contains no U+FFFD replacement characters (valid UTF-8 conversion)
    if (reDecoded !== name && !reDecoded.includes('\uFFFD')) {
      return reDecoded;
    }
  } catch (_) {}
  return name;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Connecting to MySQL…');
  const conn = await mysql.createConnection(DB_CONFIG);

  // Make absolutely sure the connection uses utf8mb4 (fall back to utf8 for older servers)
  try {
    await conn.execute("SET NAMES 'utf8mb4'");
    await conn.execute("SET CHARACTER SET utf8mb4");
    console.log('   Using utf8mb4 charset');
  } catch (_) {
    try {
      await conn.execute("SET NAMES 'utf8'");
      await conn.execute("SET CHARACTER SET utf8");
      console.log('   Using utf8 charset (server does not support utf8mb4)');
    } catch (_2) {
      console.warn('   Could not set charset — proceeding anyway');
    }
  }

  let totalFixed = 0;

  // ── 1. Fix `files` table ──────────────────────────────────────────────────
  console.log('\n📋 Scanning `files` table…');
  const [files] = await conn.execute(
    'SELECT id, original_name, filename FROM files'
  );
  console.log(`   Found ${files.length} rows`);

  let filesFixed = 0;
  for (const row of files) {
    const fixedOriginal  = fixName(row.original_name);
    const fixedFilename  = fixName(row.filename);

    const originalChanged = fixedOriginal !== row.original_name;
    const filenameChanged = fixedFilename  !== row.filename;

    if (originalChanged || filenameChanged) {
      if (originalChanged) {
        console.log(`  [files #${row.id}] original_name: "${row.original_name}" → "${fixedOriginal}"`);
      }
      if (filenameChanged) {
        console.log(`  [files #${row.id}] filename:      "${row.filename}" → "${fixedFilename}"`);
      }

      await conn.execute(
        'UPDATE files SET original_name = ?, filename = ? WHERE id = ?',
        [fixedOriginal, fixedFilename, row.id]
      );
      filesFixed++;
    }
  }
  console.log(`   ✅ Fixed ${filesFixed} row(s) in \`files\``);
  totalFixed += filesFixed;

  // ── 2. Fix `assignment_attachments` table ─────────────────────────────────
  console.log('\n📋 Scanning `assignment_attachments` table…');
  const [attachments] = await conn.execute(
    'SELECT id, original_name, filename FROM assignment_attachments'
  );
  console.log(`   Found ${attachments.length} rows`);

  let attachFixed = 0;
  for (const row of attachments) {
    const fixedOriginal = fixName(row.original_name);
    const fixedFilename = fixName(row.filename);

    const originalChanged = fixedOriginal !== row.original_name;
    const filenameChanged = fixedFilename  !== row.filename;

    if (originalChanged || filenameChanged) {
      if (originalChanged) {
        console.log(`  [assignment_attachments #${row.id}] original_name: "${row.original_name}" → "${fixedOriginal}"`);
      }
      if (filenameChanged) {
        console.log(`  [assignment_attachments #${row.id}] filename:      "${row.filename}" → "${fixedFilename}"`);
      }

      await conn.execute(
        'UPDATE assignment_attachments SET original_name = ?, filename = ? WHERE id = ?',
        [fixedOriginal, fixedFilename, row.id]
      );
      attachFixed++;
    }
  }
  console.log(`   ✅ Fixed ${attachFixed} row(s) in \`assignment_attachments\``);
  totalFixed += attachFixed;

  // ── Done ──────────────────────────────────────────────────────────────────
  await conn.end();
  console.log(`\n🎉 Done! Total rows repaired: ${totalFixed}`);
  if (totalFixed === 0) {
    console.log('   (No garbled filenames were found — everything looks clean)');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

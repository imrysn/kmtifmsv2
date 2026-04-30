/**
 * cleanup-ghost-attachments.js
 * 
 * One-time script to remove ghost assignment_attachments records
 * that were accidentally created by Electron multipart cache replay.
 * 
 * Run with: node cleanup-ghost-attachments.js
 */

require('dotenv').config()
const mysql = require('mysql2/promise')
const fs = require('fs')

async function cleanup() {
  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'KMTI-NAS',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'kmtifms_user',
      password: process.env.DB_PASSWORD || 'Ph15IcadRs',
      database: process.env.DB_NAME || 'kmtifms'
    })

    console.log('✅ Connected to MySQL database')

    // Show all current assignment_attachments so we can see what exists
    const [allAttachments] = await conn.execute(`
      SELECT 
        aa.id,
        aa.assignment_id,
        aa.original_name,
        aa.file_path,
        aa.uploaded_by_username,
        aa.created_at,
        a.title as assignment_title
      FROM assignment_attachments aa
      JOIN assignments a ON aa.assignment_id = a.id
      ORDER BY aa.created_at DESC
    `)

    console.log(`\n📋 Found ${allAttachments.length} total attachment record(s) in database:\n`)
    
    if (allAttachments.length === 0) {
      console.log('   (none — database is already clean)')
      return
    }

    allAttachments.forEach((att, i) => {
      const fileExists = att.file_path ? fs.existsSync(att.file_path) : false
      console.log(`  [${i + 1}] ID: ${att.id}`)
      console.log(`       Assignment: "${att.assignment_title}" (ID: ${att.assignment_id})`)
      console.log(`       File: ${att.original_name}`)
      console.log(`       Path: ${att.file_path}`)
      console.log(`       File exists on disk: ${fileExists ? '✅ YES' : '❌ NO (orphaned)'}`)
      console.log(`       Uploaded by: ${att.uploaded_by_username}`)
      console.log(`       Created: ${att.created_at}`)
      console.log()
    })

    // Find orphaned attachments: file path doesn't exist on disk
    // These are definitely ghost records from the Electron cache replay bug
    const orphaned = allAttachments.filter(att => {
      if (!att.file_path) return true
      return !fs.existsSync(att.file_path)
    })

    console.log(`\n🗑️  Orphaned (file missing from disk): ${orphaned.length}`)

    if (orphaned.length > 0) {
      console.log('\nDeleting orphaned attachment records...')
      for (const att of orphaned) {
        await conn.execute('DELETE FROM assignment_attachments WHERE id = ?', [att.id])
        console.log(`   ✅ Deleted attachment ID ${att.id} ("${att.original_name}") from assignment "${att.assignment_title}"`)
      }
    }

    // Also find duplicates: same assignment has same filename uploaded more than once
    const [duplicates] = await conn.execute(`
      SELECT assignment_id, original_name, COUNT(*) as cnt, MIN(id) as keep_id
      FROM assignment_attachments
      GROUP BY assignment_id, original_name
      HAVING cnt > 1
    `)

    if (duplicates.length > 0) {
      console.log(`\n🔁 Found ${duplicates.length} duplicate attachment group(s), removing extras...`)
      for (const dup of duplicates) {
        // Delete all but the oldest (lowest id) record for this assignment+filename
        const [toDelete] = await conn.execute(`
          SELECT id FROM assignment_attachments
          WHERE assignment_id = ? AND original_name = ? AND id != ?
        `, [dup.assignment_id, dup.original_name, dup.keep_id])

        for (const row of toDelete) {
          await conn.execute('DELETE FROM assignment_attachments WHERE id = ?', [row.id])
          console.log(`   ✅ Removed duplicate attachment ID ${row.id} ("${dup.original_name}")`)
        }
      }
    }

    // Final count
    const [finalCount] = await conn.execute('SELECT COUNT(*) as cnt FROM assignment_attachments')
    console.log(`\n✅ Cleanup complete. Remaining attachment records: ${finalCount[0].cnt}`)

  } catch (err) {
    console.error('❌ Error during cleanup:', err.message)
    process.exit(1)
  } finally {
    if (conn) await conn.end()
  }
}

cleanup()

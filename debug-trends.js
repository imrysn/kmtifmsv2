const { db, closeDatabase } = require('./server/config/database');

async function debugTrends() {
    console.log('🔍 Starting Trend Debugger...');

    try {
        // 1. Check a few files' uploaded_at format
        console.log('\n1️⃣  Checking raw uploaded_at values (limit 5):');
        const files = await new Promise((resolve, reject) => {
            db.all('SELECT id, uploaded_at, status FROM files ORDER BY uploaded_at DESC LIMIT 5', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.table(files);

        // 2. Test the specific query used in dashboard
        console.log('\n2️⃣  Testing Trends Query:');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        console.log('   Filter Date:', thirtyDaysAgo.toISOString());

        const query = `
      SELECT 
        DATE(uploaded_at) as date,
        SUM(CASE WHEN status = 'final_approved' OR current_stage = 'published_to_public' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status LIKE 'rejected%' OR current_stage LIKE 'rejected%' THEN 1 ELSE 0 END) as rejected
      FROM files
      WHERE uploaded_at >= ?
      GROUP BY DATE(uploaded_at)
      ORDER BY date ASC
    `;

        const trends = await new Promise((resolve, reject) => {
            db.all(query, [thirtyDaysAgo.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`   Found ${trends.length} trend entries.`);
        if (trends.length > 0) {
            console.log('   First entry:', trends[0]);
        } else {
            console.log('   ⚠️  No trends found! This is why the chart is empty.');

            // 3. Diagnosis: Check count without Group By
            console.log('\n3️⃣  Diagnosis - Count files in range (No Group By):');
            const count = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM files WHERE uploaded_at >= ?', [thirtyDaysAgo.toISOString()], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            console.log('   Files in last 30 days:', count.count);

            if (count.count > 0) {
                console.log('   💡 Conclusion: Files exist but GROUP BY DATE(uploaded_at) fails.');
                console.log('   This usually means uploaded_at is not a valid ISO string.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        closeDatabase();
        console.log('\nDone.');
    }
}

debugTrends();

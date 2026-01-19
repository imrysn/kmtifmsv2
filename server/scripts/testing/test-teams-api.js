const fetch = require('node-fetch');

console.log('🔍 Testing Teams API endpoint...\n');

async function testTeamsAPI() {
  try {
    console.log('Making request to: http://localhost:3001/api/teams');
    const response = await fetch('http://localhost:3001/api/teams');

    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers.raw());

    const data = await response.json();
    console.log('\nResponse Data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ API is working! Found ${data.teams?.length || 0} teams`);
    } else {
      console.log('\n❌ API returned success: false');
    }
  } catch (error) {
    console.error('\n❌ Error testing API:', error.message);
    console.error('This usually means:');
    console.error('  1. Server is not running');
    console.error('  2. Server is running on different port');
    console.error('  3. CORS or network issue');
  }
}

testTeamsAPI();

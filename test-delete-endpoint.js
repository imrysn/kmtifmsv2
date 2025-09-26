// Quick test to verify the bulk delete endpoint exists
const fetch = require('node-fetch');

async function testEndpoint() {
  try {
    console.log('🔍 Testing bulk delete endpoint...');
    
    const response = await fetch('http://localhost:3001/api/activity-logs/bulk-delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logIds: [] }) // Empty array to test endpoint existence
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.status === 400) {
      console.log('✅ Endpoint exists! (400 = validation error for empty array)');
    } else if (response.status === 404) {
      console.log('❌ Endpoint not found - server needs restart');
    } else {
      console.log('🤔 Unexpected response:', response.status);
    }
    
    const text = await response.text();
    console.log('Response:', text);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('💡 Make sure the server is running on http://localhost:3001');
  }
}

testEndpoint();

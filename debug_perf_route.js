const fetch = require('node-fetch');
async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/dashboard/user-performance/2');
    console.log('STATUS:', res.status);
    const data = await res.json();
    console.log('DATA:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();

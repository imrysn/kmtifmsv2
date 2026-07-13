const fs = require('fs');
const path = require('path');
const db = require('./server/config/database');

async function testWrite() {
  try {
    const p = path.join(db.networkDataPath, 'profile_pictures', 'test.txt');
    await fs.promises.writeFile(p, 'test');
    console.log('Success writing to:', p);
    await fs.promises.unlink(p);
  } catch (e) {
    console.error('Error:', e);
  }
}

testWrite();

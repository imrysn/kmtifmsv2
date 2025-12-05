const fs = require('fs');
const path = require('path');

// Delete the database file to force recreation with new schema

const dbPath = path.join(__dirname, 'database.sqlite');
if (fs.existsSync(dbPath)) { 
    fs.unlinkSync(dbPath);
    console.log('\u2705 Deleted existing database file');  
    console.log('\ud83d\udccb Database will be recreated with new schema when server starts');
} else {
    console.log('\u26a0\ufe0f  Database file does not exist');
}

console.log('\\n\ud83d\ude80 Now run: npm run dev');
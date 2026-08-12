const { db } = require('../server/config/database');
console.log('db has query:', typeof db.query);
console.log('db wrapper:', Object.keys(db));
process.exit(0);

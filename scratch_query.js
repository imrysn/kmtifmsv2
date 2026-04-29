const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/kmti-V2/kmtifmsv2/database/database.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  }
});

const query = `
  SELECT id, filename, original_name, file_path, public_network_url 
  FROM files 
  WHERE original_name LIKE '%MD5P107N01_WABC.icd%' OR file_path LIKE '%9321WABCOF%'
  ORDER BY id DESC LIMIT 5
`;

db.all(query, [], (err, rows) => {
  if (err) {
    throw err;
  }
  rows.forEach((row) => {
    console.log(JSON.stringify(row));
  });
});

db.close();

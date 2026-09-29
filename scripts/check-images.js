const { db } = require('../src/db');
for (const code of ['TU', 'SU', 'RW', 'SET', 'UMO']) {
  const row = db.prepare('SELECT name, type_code, image_url FROM items WHERE type_code = ? AND image_url IS NOT NULL LIMIT 1').get(code);
  console.log(JSON.stringify(row));
}

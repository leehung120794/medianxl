const { db } = require('../src/db');

const total = db.prepare('SELECT COUNT(*) AS n FROM items').get().n;
const byType = db.prepare('SELECT type_code, COUNT(*) AS n FROM items GROUP BY type_code ORDER BY type_code').all();
const suspicious = db.prepare(`
  SELECT id, type_code, name, base_type, source_slug, raw_text, search_text
  FROM items
  WHERE length(trim(name)) < 3
     OR lower(trim(name)) IN ('item','relic','ring','amulet','weapon','armor','set','cycle','trophy')
     OR search_text NOT LIKE '%' || lower(trim(name)) || '%'
  ORDER BY type_code, id
  LIMIT 100
`).all();
const emptyIndex = db.prepare("SELECT COUNT(*) AS n FROM items WHERE trim(search_text) = ''").get().n;
const duplicateNames = db.prepare(`
  SELECT lower(trim(name)) AS normalized_name, COUNT(*) AS n,
         group_concat(type_code || ':' || id, ', ') AS refs
  FROM items
  GROUP BY lower(trim(name))
  HAVING COUNT(*) > 1
  ORDER BY n DESC
  LIMIT 30
`).all();

console.log(JSON.stringify({ total, byType, emptyIndex, suspiciousCount: suspicious.length, suspicious, duplicateNames }, null, 2));
db.close();

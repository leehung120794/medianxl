const { db } = require('../src/db');
const { searchItems } = require('../src/services/searchService');

const rows = db.prepare("SELECT id, name, type_code, source_slug, search_text FROM items WHERE lower(name) LIKE '%raven%' ORDER BY name").all();
console.log('NAME_MATCH_COUNT=', rows.length);
for (const row of rows.slice(0, 100)) {
  console.log(`${row.id}\t[${row.type_code}]\t${row.name}\t${row.source_slug}`);
}

const results = searchItems({ query: 'raven', type: 'ALL', limit: 100 });
console.log('SEARCH_COUNT=', results.length);
for (const row of results) console.log(`SEARCH\t${row.id}\t[${row.type_code}]\t${row.name}`);

db.close();

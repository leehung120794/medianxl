const { searchItems } = require('../src/services/searchService');
for (const [query, type] of [['auriel', 'UMO'], ['sigil', 'ALL'], ['crescent moon', 'RW']]) {
  const rows = searchItems({ query, type, limit: 5 });
  console.log(JSON.stringify({ query, type, count: rows.length, results: rows.map(x => ({ id: x.id, name: x.name, code: x.type_code, group: x.group_name })) }, null, 2));
}

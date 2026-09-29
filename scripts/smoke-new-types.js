const { searchItems } = require('../src/services/searchService');
for (const [query, type] of [['cycle', 'CYCLE'], ['maelstrom', 'RELIC'], ['triune', 'TROPHY']]) {
  const rows = searchItems({ query, type, limit: 3 });
  console.log(JSON.stringify({ query, type, count: rows.length, results: rows.map(x => ({ name: x.name, code: x.type_code, group: x.group_name, image: x.image_url, stats: x.stats.slice(0, 3) })) }, null, 2));
}

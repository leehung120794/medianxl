const { searchItems } = require('../src/services/searchService');
const rows = searchItems({ query: 'sleep', type: 'SLEEP', limit: 5 });
console.log(JSON.stringify(rows.map(x => ({ name: x.name, code: x.type_code, group: x.group_name, base: x.base_type, image: x.image_url, stats: x.stats })), null, 2));

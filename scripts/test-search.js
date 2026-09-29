const { db } = require('../src/db');
const { searchItems } = require('../src/services/searchService');

const queries = ['raven', 'moon', 'angel', 'fire', 'sword', 'lies', 'yshari'];
for (const query of queries) {
  const results = searchItems({ query, type: 'ALL', limit: 50 });
  const nameMatches = results.filter(x => x.name.toLowerCase().includes(query.toLowerCase()));
  console.log(`QUERY=${query} TOTAL=${results.length} NAME_MATCHES=${nameMatches.length}`);
  console.log(nameMatches.slice(0, 12).map(x => `[${x.type_code}] ${x.name}`).join(' | '));
}

db.close();

const { searchItems } = require('../src/services/searchService');
const { normalizeSearch } = require('../src/utils/text');
const item = searchItems({ query: 'the sleep', type: 'SLEEP', limit: 1 })[0];
const lines = (item?.stats || []).filter(line => /^Awakening\s+—/i.test(line));
for (const query of ['lord of lies', 'lies', 'yshari', '']) {
  const matches = query ? lines.filter(line => normalizeSearch(line).includes(normalizeSearch(query))) : [];
  console.log(JSON.stringify({ query: query || '(empty)', count: matches.length, results: matches.map(x => x.replace(/^Awakening\s+—\s*/i, '')) }));
}

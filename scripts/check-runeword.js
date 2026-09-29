const { searchItems } = require('../src/services/searchService');
const { detailEmbeds } = require('../src/utils/embeds');
const item = searchItems({ query: 'crescent moon', type: 'RW', limit: 1 })[0];
if (!item) throw new Error('Runeword not found');
console.log(JSON.stringify({ item: { name: item.name, type: item.type_code, base: item.base_type, sequence: item.tier_or_variant, stats: item.stats }, embeds: detailEmbeds(item).map(x => x.toJSON()) }, null, 2));

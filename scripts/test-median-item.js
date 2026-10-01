const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testDb = path.resolve(__dirname, '../data/test-median-item.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
process.env.DB_PATH = testDb;
const { db, replaceSource, countSource } = require('../src/db');
const { searchItems, autocompleteItems } = require('../src/services/searchService');
const { detailEmbeds } = require('../src/utils/embeds');
const command = require('../src/commands/item');

replaceSource('sacreduniques', [{
  source_slug: 'sacreduniques', source_type: 'sacred_unique', type_code: 'SU',
  name: 'Test Blade', base_type: 'Long Sword', group_name: 'Sword', tier_or_variant: null,
  requirements: { requiredLevel: 100 }, stats: ['+100% Enhanced Damage'], socket_count: 4,
  limit_per_item: null, apply_text: null, image_url: null, source_url: 'https://example.com/item',
  raw_text: 'Test Blade Long Sword', search_text: 'test blade long sword enhanced damage',
  content_hash: 'test-item-hash', updated_at: new Date(0).toISOString(),
}]);
assert.equal(countSource('sacreduniques'), 1);
const found = searchItems({ query: 'long sword', type: 'SU' });
assert.equal(found[0].name, 'Test Blade');
assert.equal(autocompleteItems({ query: 'test' })[0].type_code, 'SU');
assert.equal(detailEmbeds(found[0])[0].toJSON().title, 'Test Blade');
assert.equal(command.data.toJSON().name, 'item');
const runItem = require('../src/services/hardcoreService').medianItemForRarity('legendary');
assert.match(runItem.name, /Test Blade/);
assert.match(runItem.text, /\[SU\]/);
assert.equal(runItem.typeCode, 'SU');
assert(runItem.attack > 0);
db.close();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
console.log(JSON.stringify({ ok: true, itemSearch: found[0].name }));

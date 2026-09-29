const assert = require('node:assert');
const { autocompleteItems } = require('../src/services/searchService');
const { detailEmbeds } = require('../src/utils/embeds');
const monitoring = require('../src/services/monitoringService');

const raven = autocompleteItems({ query: 'raven', type: 'TU', limit: 25 });
assert(raven.length > 0, 'raven autocomplete should return TU results');
assert(raven.every(item => !item.tier_or_variant || /tier\s*4/i.test(item.tier_or_variant) || !/tier\s*\d+/i.test(item.tier_or_variant)), 'TU autocomplete must keep highest tier');
const rw = autocompleteItems({ query: 'moon', type: 'RW', limit: 1 })[0];
if (rw) assert(detailEmbeds(rw)[0].data.fields.some(field => field.name === 'Rune sequence'), 'RW embed should have rune sequence');
monitoring.writeEvent('feature_test_passed', { ravenSuggestions: raven.length });
console.log(JSON.stringify({ ok: true, ravenSuggestions: raven.length, rwChecked: Boolean(rw) }));

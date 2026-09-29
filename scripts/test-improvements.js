const assert = require('node:assert/strict');
const { parseHtml, relicSkillName } = require('../src/parsers/parseSource');
const { validateSourceItems } = require('../src/services/syncValidationService');
const compareCommand = require('../src/commands/compare');

assert.equal(relicSkillName(['Relic', 'Required Level: 75', '+(21 to 25)% Bonus to Poison Skill Duration', 'Angel of Death Cooldown Reduced by 1 seconds', '+(21 to 28) to Angel of Death']), 'Angel of Death');
assert.equal(relicSkillName(['Relic', 'Required Level: 75', 'Arcane Torrent: +20% Extra Projectiles', '+(17 to 25) to Arcane Torrent', '+100 to Mana']), 'Arcane Torrent');
assert.equal(relicSkillName(['Relic', 'Required Level: 75', '+50% Damage to Demons', "+1 to Heaven's Fury", '+(6 to 10) to Light Radius']), "Heaven's Fury");
assert.equal(relicSkillName(['Relic', 'Required Level: 75', '+(4 to 12) to Sacrifices', '+(6 to 14) Life after each Kill', '4% Reanimate as: Random Monster']), 'Sacrifices');

const html = `<table><tr><td>Relic<br>Required Level: 75<br>-(3 to 6)% to Enemy Fire Resistance<br>+(8 to 14) to Apocalypse<br>+(101 to 150) to Mana</td></tr></table>`;
const parsed = parseHtml(html, 'relics', 'https://docs.median-xl.com/doc/wiki/relics');
assert.equal(parsed.length, 1);
assert.equal(parsed[0].name, 'Apocalypse');

const sacredHtml = `<p class="genbig">Throwing Axes</p><table><tr><th colspan="4">Balanced Axe</th></tr><tr><td></td><td><span class="item-unique">Ophiophagus</span><br>Throw Damage:<br>(234 - 289) to (277 - 338)<br>Required Level: 120</td></tr></table>`;
const sacred = parseHtml(sacredHtml, 'sacreduniques', 'https://docs.median-xl.com/doc/items/sacreduniques');
assert.equal(sacred.length, 1);
assert.equal(sacred[0].base_type, 'Balanced Axe', 'Sacred Unique base must come from the table header, not a damage label');
assert.equal(validateSourceItems('sacreduniques', sacred, 0).warnings.length, 0);
const jewelryHtml = `<p class="genbig">Amulets</p><table><tr><td><img src="amulet.png"></td><td><span class="item-unique">Klaatu Barada Nikto</span><br>Required Level: 110<br>Item Level: 105</td></tr></table>`;
const jewelry = parseHtml(jewelryHtml, 'sacreduniques', 'https://docs.median-xl.com/doc/items/sacreduniques');
assert.equal(jewelry[0].base_type, 'Amulet', 'headerless jewelry tables must use their item group as the base');

const validBatch = Array.from({ length: 50 }, (_, index) => ({ ...parsed[0], name: `Skill ${index}`, content_hash: `hash-${index}`, search_text: `skill ${index}` }));
assert.equal(validateSourceItems('relics', validBatch, 60).ok, true);
assert.equal(validateSourceItems('relics', validBatch.slice(0, 10), 203).ok, false);

assert.equal(compareCommand.data.toJSON().name, 'compare');
const comparison = compareCommand.comparisonEmbed(
  { name: 'Item A', type_code: 'TU', base_type: 'Spear', tier_or_variant: 'Tier 4', requirements: { requiredLevel: 50 }, stats: ['Required Level: 50', '20% Attack Speed'], source_url: 'https://example.com/a' },
  { name: 'Item B', type_code: 'SU', base_type: 'Sword', requirements: { requiredLevel: 100 }, stats: ['Required Level: 100', '30% Attack Speed'], source_url: 'https://example.com/b' },
).toJSON();
assert.equal(comparison.fields.length, 2);
assert(comparison.fields.every(field => field.inline), 'compare fields should render side by side');
assert(!comparison.fields.some(field => /chỉ có|giống hệt|khác giá trị/i.test(field.name)), 'compare should only show two item columns');
assert(!/Loại|Phiên bản|Cấp yêu cầu|Sức mạnh|Khéo léo|Sát thương|Chỉ số|Trang nguồn|Hai item|So sánh/.test(JSON.stringify(comparison)), 'compare output should use English labels only');

console.log(JSON.stringify({ ok: true, parsedRelic: parsed[0].name, sacredBase: sacred[0].base_type, compareColumns: comparison.fields.length }));

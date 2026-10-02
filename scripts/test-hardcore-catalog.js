'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const testDb = path.resolve(__dirname, '../data/test-hardcore-catalog.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
process.env.DB_PATH = testDb;

const hardcore = require('../src/services/hardcoreService');
const { ITEMS, validateItems } = require('../src/hardcore/item');
const { effectText } = require('../src/services/hardcoreEquipment');

assert.equal(validateItems(), true);
assert.deepEqual(Object.fromEntries(Object.entries(ITEMS).map(([rarity, items]) => [rarity, items.length])), {
  common: 32, rare: 28, legendary: 24, cursed: 16,
});
assert.equal(Object.values(ITEMS).flat().length, 100);
assert.equal(ITEMS.cursed.filter(item => item.curse?.effects?.bonusPenalty).length, 2,
  'Chỉ hai UR được phép giảm payout');

function state() {
  const template = hardcore.CLASSES.barbarian;
  return {
    classKey: 'barbarian', stake: 100, floor: 10, cleared: 9, hp: template.hp, maxHp: template.hp,
    damageMin: template.damageMin, damageMax: template.damageMax, defense: template.defense,
    accuracy: template.accuracy, evasion: template.evasion, critChance: template.critChance,
    resistance: template.resistance, energy: template.energy, maxEnergy: template.energy, potions: 3,
    luck: 0, escapeTokens: 0, items: [], bonus: 0, payoutFactor: 1, payoutSpent: 0,
  };
}

let run = state();
const lens = ITEMS.common.find(item => item.id === 'scout_lens');
hardcore.applyItem(run, lens, 'common');
assert.equal(run.accuracy, hardcore.CLASSES.barbarian.accuracy + 2);
assert.equal(run.mimicDetection, 0.02);
assert.match(effectText(run.items[0], 1), /Accuracy/);

run = state();
const chains = ITEMS.cursed.find(item => item.id === 'berserker_chains');
hardcore.applyItem(run, chains, 'cursed');
assert.equal(run.damageMin, hardcore.CLASSES.barbarian.damageMin + 22);
assert.equal(run.damageTaken, 0.18);
assert.match(effectText(run.items[0], 1), /Nguyền:/);
hardcore.purifyItem(run, chains.name, 1);
assert.equal(run.damageTaken, 0);
assert.equal(run.damageMin, hardcore.CLASSES.barbarian.damageMin + 22, 'Giải nguyền không được xóa hiệu ứng có lợi');
assert.equal(run.items[0].purified, true);
assert.doesNotMatch(effectText(run.items[0], 1), /Nguyền:/);

run = state();
const debt = ITEMS.cursed.find(item => item.id === 'goblins_debt');
hardcore.applyItem(run, debt, 'cursed');
assert.equal(run.payoutFactor, 0.85);
hardcore.purifyItem(run, debt.name, 1);
assert(Math.abs(run.payoutFactor - 1) < 1e-9);

run = state();
const idol = ITEMS.cursed.find(item => item.id === 'null_idol');
hardcore.applyItem(run, idol, 'cursed');
assert.equal(run.luck, 0, 'Luck không được âm khi nhận lời nguyền');
hardcore.purifyItem(run, idol.name, 1);
assert.equal(run.luck, 0, 'Giải nguyền chỉ hoàn tác phần phạt thực sự đã áp dụng');

run = state();
const cannon = ITEMS.cursed.find(item => item.id === 'glass_cannon');
hardcore.applyItem(run, cannon, 'cursed');
assert.equal(run.defense, 0);
hardcore.purifyItem(run, cannon.name, 1);
assert.equal(run.defense, hardcore.CLASSES.barbarian.defense, 'Purifier phải khôi phục đúng Defense đã mất');

require('../src/db').db.close();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
console.log(JSON.stringify({ ok: true, items: 100, payoutCurses: 2 }));

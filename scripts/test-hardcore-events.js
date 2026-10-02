'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const testDb = path.resolve(__dirname, '../data/test-hardcore-events.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
process.env.DB_PATH = testDb;
process.env.ECONOMY_STARTING_COINS = '1000';

const hardcore = require('../src/services/hardcoreService');
const repository = require('../src/services/hardcoreRepository');
const { ITEMS } = require('../src/hardcore/item');
let sequence = 0;

function start(event, overrides = {}) {
  sequence += 1;
  const userId = `event-user-${sequence}`;
  const started = hardcore.startHardcore({ guildId: 'event-guild', userId, channelId: 'event-channel', stake: 100, classKey: overrides.classKey || 'barbarian', forcedEncounter: event });
  Object.assign(started.state, { floor: 11, cleared: 10, bonus: 0, payoutFactor: 1, payoutSpent: 0 }, overrides);
  started.state.encounter = event;
  repository.saveState(started.session, started.state);
  return { ...started, userId };
}
function play(run, action) { return hardcore.playHardcore({ sessionId: run.session.id, userId: run.userId, expectedTurn: run.state.turn, action }); }
function cleanup(run, state) {
  if (hardcore.getHardcoreByUser('event-guild', run.userId)) hardcore.playHardcore({ sessionId: run.session.id, userId: run.userId, expectedTurn: state.turn, action: 'retreat' });
}
function assertRows(state) {
  const rows = hardcore.hardcoreRows('event-panel', state);
  assert(rows.length >= 2 && rows.length <= 3);
  assert(rows.every(row => row.components.length <= 5));
  rows.forEach(row => row.toJSON());
}

const altar = start({ type: 'surprise', kind: 'altar_of_sacrifice', hpCost: 20, payoutCost: 19 });
assertRows(altar.state);
let result = play(altar, 'altar_hp');
assert.equal(result.state.damageMin, hardcore.CLASSES.barbarian.damageMin + 3);
cleanup(altar, result.state);

const gambler = start({ type: 'surprise', kind: 'cursed_gambler', win: true, cost10: 19, cost25: 47 });
assertRows(gambler.state);
result = play(gambler, 'gamble_10');
assert.equal(result.state.payoutSpent, 19);
assert.equal(result.state.bonus, 38);
cleanup(gambler, result.state);

const adventurer = start({ type: 'surprise', kind: 'lost_adventurer', rescueRarity: 'rare', rescueItem: ITEMS.rare[0], robbedRarity: 'common', robbedItem: ITEMS.common[0] });
assertRows(adventurer.state);
result = play(adventurer, 'adventurer_rescue');
assert.equal(result.state.potions, 2);
assert(result.state.items.some(item => item.name === ITEMS.rare[0].name));
cleanup(adventurer, result.state);

const fountain = start({ type: 'surprise', kind: 'blood_fountain', outcome: 'max_hp' });
assertRows(fountain.state);
const oldMaxHp = fountain.state.maxHp;
result = play(fountain, 'blood_drink');
assert.equal(result.state.maxHp, oldMaxHp + 15);
cleanup(fountain, result.state);

const forge = start({ type: 'surprise', kind: 'horadric_forge', itemName: 'Rusted Edge', itemLevel: 1, itemRarity: 'common' },
  { items: [{ ...ITEMS.common[0], rarity: 'common', level: 1 }] });
assertRows(forge.state);
result = play(forge, 'salvage_attack');
assert(!result.state.items.some(item => item.name === 'Rusted Edge'));
cleanup(forge, result.state);

const merchant = start({ type: 'surprise', kind: 'rift_merchant', offers: [
  { type: 'luck', name: '+1 Luck', cost: 10 }, { type: 'potion', name: 'Bình máu', cost: 5 }, { type: 'escape_token', name: 'Vé Thoát Hiểm', cost: 25 },
] });
assertRows(merchant.state);
result = play(merchant, 'merchant_0');
assert.equal(result.state.luck, 1);
assert.equal(result.state.payoutSpent, 10);
cleanup(merchant, result.state);

const mirror = start({ type: 'surprise', kind: 'mirror_of_fate', smashSuccess: false });
assertRows(mirror.state);
result = play(mirror, 'mirror_smash');
assert.equal(result.state.encounter.name, 'Mirror Clone');
cleanup(mirror, result.state);

const room = start({ type: 'surprise', kind: 'treasure_room', mimicColor: 'red', inspectColor: 'red', inspected: false, revealedColor: null });
assertRows(room.state);
result = play(room, 'treasure_inspect');
assert.equal(result.state.encounter.revealedColor, 'red');
room.state = result.state;
result = play(room, 'treasure_blue');
assert(result.state.defense >= hardcore.CLASSES.barbarian.defense + 6);
cleanup(room, result.state);

const contract = start({ type: 'surprise', kind: 'rift_contract', contractKind: 'no_skill' });
assertRows(contract.state);
result = play(contract, 'contract_accept');
for (let index = 0; index < 3; index += 1) {
  result.state.encounter = { type: 'empty' };
  repository.saveState(contract.session, result.state);
  contract.state = result.state;
  result = play(contract, 'continue');
}
assert.equal(result.state.contract, null);
assert(result.state.bonus >= 50);
cleanup(contract, result.state);

const shrine = start({ type: 'surprise', kind: 'class_shrine' }, { classKey: 'amazon' });
assertRows(shrine.state);
result = play(shrine, 'class_blessing');
assert.equal(result.state.classBlessing.classKey, 'amazon');
assert.equal(result.state.classBlessing.targetCleared - result.state.cleared, 3);
cleanup(shrine, result.state);

const sorceressShrine = start({ type: 'surprise', kind: 'class_shrine' }, { classKey: 'sorceress' });
result = play(sorceressShrine, 'class_blessing');
result.state.energy = 0;
result.state.encounter = hardcore.makeEnemy(result.state.floor, 'normal', 'Shrine Dummy', result.state);
result.state.encounter.hp = result.state.encounter.maxHp = 999;
result.state.encounter.damageMin = result.state.encounter.damageMax = 1;
repository.saveState(sorceressShrine.session, result.state); sorceressShrine.state = result.state;
const shrineRows = hardcore.hardcoreRows(sorceressShrine.session.id, result.state);
assert.equal(shrineRows[0].components.find(component => component.data.custom_id.endsWith(':skill')).data.disabled, false);
result = play(sorceressShrine, 'skill');
assert.equal(result.state.energy, 0, 'Class Shrine phải cho Sorceress dùng kỹ năng kế tiếp miễn phí');
assert.equal(result.state.classBlessing, null);
cleanup(sorceressShrine, result.state);

const doors = start({ type: 'surprise', kind: 'strange_doors', lightGood: true, goldGood: true, darkGood: true, goldReward: 50, darkItem: ITEMS.legendary[0] });
assertRows(doors.state);
doors.state.hp = 20; repository.saveState(doors.session, doors.state);
result = play(doors, 'door_light');
assert.equal(result.state.hp, result.state.maxHp);
cleanup(doors, result.state);

require('../src/db').db.close();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
console.log(JSON.stringify({ ok: true, hardcoreEvents: 11 }));

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const testDb = path.resolve(__dirname, '../data/test-hardcore-v2.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
process.env.DB_PATH = testDb;
process.env.ECONOMY_STARTING_COINS = '100000';

const stats = require('../src/services/hardcoreStats');
const hardcore = require('../src/services/hardcoreService');
const repository = require('../src/services/hardcoreRepository');
const { addDiamonds, getPlayerProgression } = require('../src/services/playerLevelService');
const { ITEMS } = require('../src/hardcore/item');
const { basicAttackManaRestore, skillDamagePreview } = require('../src/services/hardcoreClassInfo');
const { effectiveModifierStacks } = require('../src/services/hardcoreWorld');

function save(run) { repository.saveState(run.session, run.state); }
function play(run, action) {
  const result = hardcore.playHardcore({ sessionId: run.session.id, userId: run.session.user_id, expectedTurn: run.state.turn, action });
  run.state = result.state;
  return result;
}
function start(user, encounter = { type: 'empty' }, classKey = 'sorceress') {
  return hardcore.startHardcore({ guildId: 'v2-guild', userId: user, channelId: 'v2-channel', stake: 100, classKey, forcedEncounter: encounter });
}
function close(run) {
  if (repository.getSession(run.session.id)) hardcore.playHardcore({ sessionId: run.session.id, userId: run.session.user_id, expectedTurn: run.state.turn, action: 'retreat' });
}

// Công thức và việc đồng bộ phải ổn định, không cộng lại base class sau mỗi lần gọi.
const unit = { statVersion: 2, classKey: 'sorceress', attributes: { strength: 0, dexterity: 0, vitality: 0, energy: 0 },
  statBonuses: stats.emptyBonuses(), items: [], baseLuck: 0, hp: 0, energy: 0 };
stats.syncDerived(unit, { healToFull: true, fillMana: true });
const first = { hp: unit.maxHp, damage: unit.damageMax, attrs: stats.totalAttributes(unit) };
stats.syncDerived(unit);
assert.equal(unit.maxHp, first.hp);
assert.equal(unit.damageMax, first.damage);
assert.deepEqual(stats.totalAttributes(unit), first.attrs);
assert.equal(first.attrs.energy, 34);
assert.equal(stats.v2HitChance(1, 99999), 0.55, 'né bị cap 45%');
assert.equal(stats.v2HitChance(99999, 1), 0.95, 'né tối thiểu 5%');
assert(stats.v2DefenseReduction(1e9, 999) <= 0.7, 'giảm vật lý cap 70%');
const soulEnemy = hardcore.makeEnemy(100, 'normal', 'Soul Test', { statVersion: 2, modifiers: Array(8).fill('soul_drain') });
assert.equal(soulEnemy.soulDrainCharges, 2, '8 stack chỉ cho 2 lần Soul Drain trong combat');
for (const item of Object.values(ITEMS).flat()) {
  const converted = stats.v2ItemBonuses(item);
  assert(Object.values(converted).filter(value => value !== null).every(Number.isFinite), `item ${item.id} phải quy đổi hữu hạn`);
}
assert.deepEqual(ITEMS.rare.find(item => item.id === 'rift_compass').attributes, { strength: 0, dexterity: 3, vitality: 0, energy: 0 });
assert.deepEqual(ITEMS.cursed.find(item => item.id === 'oathbreaker').curse.attributes, { strength: -10, dexterity: -10, vitality: 0, energy: 0 });
const itemState = { statVersion: 2, itemCatalogVersion: 2, classKey: 'barbarian', attributes: { strength: 0, dexterity: 0, vitality: 0, energy: 0 },
  eventAttributes: { strength: 0, dexterity: 0, vitality: 0, energy: 0 }, statBonuses: stats.emptyBonuses(), items: [], baseLuck: 0,
  hp: 1, energy: 0, payoutFactor: 1, potions: 0, escapeTokens: 0 };
stats.syncDerived(itemState, { healToFull: true, fillMana: true });
hardcore.applyItem(itemState, ITEMS.rare.find(item => item.id === 'rift_compass'), 'rare');
assert.equal(stats.totalAttributes(itemState).dexterity, stats.CLASS_V2.barbarian.attributes.dexterity + 3);
assert.equal(itemState.luck, 2); assert.equal(itemState.mimicDetection, 0.08);
hardcore.applyItem(itemState, ITEMS.cursed.find(item => item.id === 'glass_cannon'), 'cursed');
assert.equal(itemState.defense, 0, 'Glass Cannon chưa giải nguyền phải override Defense về 0');
hardcore.applyItem(itemState, ITEMS.cursed.find(item => item.id === 'goblins_debt'), 'cursed');
assert.equal(itemState.payoutFactor, 0.85, 'payout curse áp dụng đúng một lần khi nhặt');

const initial = start('initial');
assert.equal(initial.state.statVersion, 2);
assert.equal(initial.state.itemCatalogVersion, 2);
assert.equal(initial.state.energy, initial.state.maxEnergy);
assert.equal(initial.state.maxEnergy, 3, 'Sorceress 34 ENE phải bắt đầu với 3 Max Mana');
assert.equal(basicAttackManaRestore(initial.state), 2, 'caster Max Mana 3 hồi floor(70%) = 2');
assert.equal(basicAttackManaRestore({ ...initial.state, maxEnergy: 10 }), 7, 'caster hồi 70% Max Mana');
assert.deepEqual(stats.totalAttributes(initial.state), stats.CLASS_V2.sorceress.attributes);
close(initial);
const initialEmbed = hardcore.hardcoreEmbed({ ...initial.state, encounter: { type: 'empty' }, phase: 'encounter' }, initial.session.user_id, null, initial.session.id).toJSON();
assert(!initialEmbed.fields.some(field => field.name.includes('thay đổi trong lượt vừa rồi')), 'UI thường phải bỏ field thay đổi chỉ số');
const chaosField = initialEmbed.fields.find(field => field.name.includes('Tiến trình & Chaos'));
assert.match(chaosField.value, /không phải debuff/);
const initialRows = hardcore.hardcoreRows(initial.session.id, { ...initial.state, encounter: { type: 'empty' }, phase: 'encounter' });
assert(initialRows.flatMap(row => row.components.map(component => component.data.label)).includes('Chỉ số'), 'nút Chỉ số phải có ở mọi encounter');
const shrineEmbed = hardcore.hardcoreEmbed({ ...initial.state, encounter: { type: 'shrine', kind: 'healing' }, phase: 'encounter' }, initial.session.user_id, null, initial.session.id).toJSON();
assert(!shrineEmbed.fields.some(field => field.name.includes('thay đổi trong lượt vừa rồi')), 'Shrine không được hiện lại chỉ số lượt trước');
const shrineCatalog = shrineEmbed.fields.find(field => field.name.includes('Các Shrine có thể gặp'));
assert(shrineCatalog, 'Shrine phải hiện catalog kết quả có thể gặp');
assert.match(shrineCatalog.value, /Healing.*Armor.*Blood.*Experience.*Corrupted.*Fake/s);
assert.match(shrineCatalog.value, /16,7%/);
const barbarianMana = start('barbarian-mana', { type: 'empty' }, 'barbarian');
assert.equal(barbarianMana.state.maxEnergy, 2, 'Barbarian ít ENE vẫn bắt đầu với 2 Max Mana');
assert.equal(basicAttackManaRestore({ ...barbarianMana.state, maxEnergy: 10 }), 4, 'class vật lý hồi 40% Max Mana');
close(barbarianMana);

assert.equal(effectiveModifierStacks(3), 3);
assert.equal(effectiveModifierStacks(8), 5.5);
assert.equal(effectiveModifierStacks(12), 6.5);
assert.equal(effectiveModifierStacks(100), 8, 'Rift stack hiệu dụng phải có cap');
const stackedRift = hardcore.riftModifierEffects({ statVersion: 2, modifiers: [
  ...Array(12).fill('stone_skin'), ...Array(12).fill('elemental_dominion'), ...Array(12).fill('bloodlust'),
  ...Array(12).fill('fortified'), ...Array(12).fill('swift_horror'), ...Array(12).fill('cursed_ground'),
] }, { hp: 50, maxHp: 100 });
assert.equal(stackedRift.stoneSkinMultiplier, 1.52);
assert.equal(stackedRift.elementalDamageMultiplier, 1.195);
assert.equal(stackedRift.bloodlustDamageMultiplier, 1.3900000000000001);
assert.equal(stackedRift.fortifiedMultiplier, 1.52);
assert.equal(stackedRift.swiftAccuracyBonus, 20);
assert.equal(stackedRift.swiftEvasionBonus, 10);
assert.equal(stackedRift.cursedResistancePenalty, 20);

// Checkpoint v2 chỉ cộng thuộc tính; cùng một nút cũ không được cộng lần hai.
const checkpoint = start('checkpoint');
Object.assign(checkpoint.state, { floor: 5, cleared: 4, encounter: { type: 'empty' } }); save(checkpoint);
play(checkpoint, 'continue');
assert.equal(checkpoint.state.phase, 'upgrade');
const checkpointJson = hardcore.hardcoreEmbed(checkpoint.state, checkpoint.session.user_id, null, checkpoint.session.id).toJSON();
const checkpointField = checkpointJson.fields.find(field => field.name.includes('Chọn thuộc tính'));
assert(checkpointField, 'checkpoint phải thay field thay đổi lượt bằng dự báo thuộc tính');
assert.match(checkpointField.value, /Tổng hiện tại.*HP.*DEF.*ACC.*EVA.*Crit.*RES.*Mana.*Bình/s);
assert.match(checkpointField.value, /\+5 STR.*HP.*DEF.*ACC.*EVA.*Crit.*RES.*Mana.*Bình/s);
assert.match(checkpointField.value, /\+5 DEX.*HP.*DEF.*ACC.*EVA.*Crit.*RES.*Mana.*Bình/s);
assert.match(checkpointField.value, /\+5 VIT.*HP.*DEF.*ACC.*EVA.*Crit.*RES.*Mana.*Bình/s);
assert.match(checkpointField.value, /\+5 ENE.*HP.*DEF.*ACC.*EVA.*Crit.*RES.*Mana.*Bình/s);
assert.doesNotMatch(checkpointField.value, /Dự báo quái/);
assert(checkpointField.value.length <= 1024, 'dự báo checkpoint phải nằm trong giới hạn field Discord');
const beforeStrength = checkpoint.state.attributes.strength;
const expectedTurn = checkpoint.state.turn;
play(checkpoint, 'upgrade_attack');
assert.equal(checkpoint.state.attributes.strength, beforeStrength + 5);
assert.throws(() => hardcore.playHardcore({ sessionId: checkpoint.session.id, userId: checkpoint.session.user_id, expectedTurn, action: 'upgrade_attack' }), /STALE_ACTION/);
close(checkpoint);

// Battle UI phải giải thích ngắn gọn skill và damage lên đúng quái hiện tại.
const battleUi = start('battle-ui');
battleUi.state.encounter = hardcore.makeEnemy(1, 'normal', 'UI Target', battleUi.state); save(battleUi);
const skillPreview = skillDamagePreview(battleUi.state);
assert(skillPreview.min > 0 && skillPreview.max >= skillPreview.min);
const battleJson = hardcore.hardcoreEmbed(battleUi.state, battleUi.session.user_id, null, battleUi.session.id).toJSON();
assert.match(battleJson.description, /Arcane Burst.*Mana.*damage/s);
assert.match(battleJson.description, /Phép luôn trúng, không Crit/);
assert.match(battleJson.description, /Dự báo nhận:.*HP.*% trúng.*chưa tính Crit và chưa Phòng thủ/s);
const incomingPreview = require('../src/services/hardcoreView').combatIncomingPreview(battleUi.state);
assert.equal(incomingPreview.type, battleUi.state.encounter.nextAttackType);
assert(incomingPreview.range[0] >= 1 && incomingPreview.range[1] >= incomingPreview.range[0]);
const previewBeforeCritChange = incomingPreview.range;
battleUi.state.encounter.critChance = 0.75;
assert.deepEqual(require('../src/services/hardcoreView').combatIncomingPreview(battleUi.state).range, previewBeforeCritChange,
  'damage dự báo combat phải luôn là damage chưa tính Critical');
const battleRows = hardcore.hardcoreRows(battleUi.session.id, battleUi.state);
const battleLabels = battleRows.flatMap(row => row.components.map(component => component.data.label));
assert(battleLabels.includes('Tấn công (+2 Mana)'));
assert(battleLabels.some(label => label.startsWith('Arcane Burst (-2)')));
battleUi.state.energy = 0; save(battleUi); play(battleUi, 'attack');
assert.equal(battleUi.state.energy, 2, 'basic attack caster Max Mana 3 phải hồi floor(70%) = 2');
close(battleUi);

// Rift Paradox bắt buộc ở mốc 25 và kết quả chọn không reroll.
const paradox = start('paradox');
Object.assign(paradox.state, { floor: 25, cleared: 24, encounter: { type: 'empty' } }); save(paradox);
play(paradox, 'continue'); play(paradox, 'upgrade_hp');
assert.equal(paradox.state.phase, 'paradox');
play(paradox, 'paradox_blood');
assert.equal(paradox.state.activeParadox.kind, 'blood_money');
assert.deepEqual(paradox.state.paradoxMilestonesClaimed, [25]);
close(paradox);

// Payout ảo của Blood Paradox không được dùng để mua đồ.
const payoutShop = start('payout-abuse', { type: 'surprise', kind: 'payout_item_shop', currency: 'payout',
  offers: [{ rarity: 'common', item: ITEMS.common[0], cost: 500 }], maxHpAtCreation: 100 });
Object.assign(payoutShop.state, { floor: 2, cleared: 1, bonus: 0, activeParadox: { kind: 'blood_money', untilFloor: 6 }, paradoxBloodBonus: 0.5 }); save(payoutShop);
const shopTurn = payoutShop.state.turn;
assert.throws(() => play(payoutShop, 'shop_buy_0'), /NOT_ENOUGH_PAYOUT/);
assert.equal(repository.parseState(repository.getSession(payoutShop.session.id)).turn, shopTurn, 'giao dịch lỗi phải rollback cả turn');
close(payoutShop);

// Blood Shop không cho HP bằng hoặc thấp hơn giá và không trừ nửa chừng.
const hpShop = start('hp-abuse', { type: 'surprise', kind: 'hp_item_shop', currency: 'hp',
  offers: [{ rarity: 'rare', item: ITEMS.rare[0], cost: 30 }], maxHpAtCreation: 100 });
hpShop.state.hp = 30; save(hpShop);
assert.throws(() => play(hpShop, 'shop_buy_0'), /NOT_ENOUGH_HP/);
assert.equal(repository.parseState(repository.getSession(hpShop.session.id)).hp, 30);
close(hpShop);

// Diamond Shop thiếu tiền phải rollback và không cấp item.
const diamondShop = start('diamond-abuse', { type: 'surprise', kind: 'diamond_item_shop', currency: 'diamond',
  offers: [{ rarity: 'cursed', item: ITEMS.cursed[0], cost: 1600 }], maxHpAtCreation: 100 });
assert.throws(() => play(diamondShop, 'shop_buy_0'), /INSUFFICIENT_DIAMONDS/);
assert.equal(repository.parseState(repository.getSession(diamondShop.session.id)).items.length, 0);
close(diamondShop);

const diamondSuccess = start('diamond-once', { type: 'surprise', kind: 'diamond_item_shop', currency: 'diamond',
  offers: [{ rarity: 'rare', item: ITEMS.rare[0], cost: 200 }], maxHpAtCreation: 100 });
addDiamonds('v2-guild', 'diamond-once', 500, { reason: 'test', operationId: 'fund-diamond-once' });
const diamondTurn = diamondSuccess.state.turn;
play(diamondSuccess, 'shop_buy_0');
assert.equal(getPlayerProgression('v2-guild', 'diamond-once').diamonds, 300);
assert.throws(() => hardcore.playHardcore({ sessionId: diamondSuccess.session.id, userId: 'diamond-once', expectedTurn: diamondTurn, action: 'shop_buy_0' }), /STALE_ACTION/);
assert.equal(getPlayerProgression('v2-guild', 'diamond-once').diamonds, 300, 'bấm lặp không được trừ kim cương lần hai');
close(diamondSuccess);

// Duelist dùng chuỗi tay đã khóa; thua stat chỉ xử lý một lần.
const duelistEvent = { type: 'surprise', kind: 'rift_duelist', stage: 'choose', hands: ['scissors', 'rock', 'paper', 'rock', 'paper'],
  round: 0, wins: 0, penalty: ['strength', 'strength', 'dexterity', 'vitality', 'energy', 'energy'],
  rewardRarity: 'legendary', rewardItem: ITEMS.legendary[0], penaltyItemName: null };
const duelist = start('duelist', duelistEvent, 'barbarian');
const duelBonusBefore = duelist.state.bonus;
play(duelist, 'duelist_stat'); const duelTurn = duelist.state.turn;
play(duelist, 'rps_rock');
assert.equal(duelist.state.eventAttributes.strength, 6, 'rock thắng phải +6 STR event');
assert.equal(duelist.state.bonus, duelBonusBefore, 'Duelist chỉ trả phần thưởng đã chọn, không cộng thêm thưởng tầng');
assert.throws(() => hardcore.playHardcore({ sessionId: duelist.session.id, userId: duelist.session.user_id, expectedTurn: duelTurn, action: 'rps_rock' }), /STALE_ACTION/);
close(duelist);

// Severance xóa mọi stack của đúng modifier và không được xóa Unstable Rift.
const severance = start('severance');
Object.assign(severance.state, { floor: 200, cleared: 199, modifiers: ['stone_skin', 'stone_skin', 'unstable_rift'], phase: 'severance',
  encounter: { type: 'severance', milestone: 199, choices: ['stone_skin'] } }); save(severance);
play(severance, 'sever_0');
assert.deepEqual(severance.state.modifiers, ['unstable_rift']);
close(severance);

// Grave Echo: một mộ thường/người, tối đa 10/server và lease chống claim đồng thời.
const now = Date.now();
repository.createEcho({ id: 'echo-old', guildId: 'echo-guild', ownerUserId: 'dead', name: 'Dead', classKey: 'amazon', deathFloor: 120,
  snapshot: { items: [] }, expiresAt: now + 10000 }, now);
repository.createEcho({ id: 'echo-new', guildId: 'echo-guild', ownerUserId: 'dead', name: 'Dead', classKey: 'amazon', deathFloor: 130,
  snapshot: { items: [] }, expiresAt: now + 10000 }, now + 1);
assert.equal(repository.listEchoes('echo-guild').length, 1);
const claim = repository.claimEcho('echo-guild', 'session-a', 'alive-a', 150, now + 2);
assert.equal(claim.id, 'echo-new');
assert.equal(repository.claimEcho('echo-guild', 'session-b', 'alive-b', 150, now + 3), null);
repository.releaseEcho('echo-new', 'session-a');
assert.equal(repository.claimEcho('echo-guild', 'session-b', 'alive-b', 150, now + 4).id, 'echo-new');
repository.releaseEcho('echo-new', 'session-b');
for (let index = 0; index < 12; index += 1) repository.createEcho({ id: `cap-${index}`, guildId: 'echo-guild', ownerUserId: `dead-${index}`,
  name: `Dead ${index}`, classKey: 'amazon', deathFloor: 110 + index, snapshot: { items: [] }, expiresAt: now + 10000 }, now + 10 + index);
assert.equal(repository.listEchoes('echo-guild').length, 10, 'mỗi server chỉ giữ tối đa 10 bóng ma');

// Mọi UI mới phải hợp lệ với giới hạn 5 hàng/5 component của Discord.
const uiBase = { ...paradox.state, turn: 0, items: [], modifiers: [], potions: 1, escapeTokens: 0, cleared: 25, stake: 100 };
const uiStates = [
  { ...uiBase, phase: 'paradox', encounter: { type: 'paradox', milestone: 25 } },
  { ...uiBase, phase: 'severance', encounter: { type: 'severance', milestone: 199, choices: ['stone_skin', 'soul_drain'] } },
  { ...uiBase, phase: 'encounter', encounter: duelistEvent },
  { ...uiBase, phase: 'encounter', encounter: { type: 'grave_echo', name: 'Tester', classKey: 'amazon', deathFloor: 120, level: 1, kills: 0, snapshot: { items: [] } } },
  { ...uiBase, phase: 'encounter', encounter: { type: 'karma', action: 'adventurer_rob', source: 'lost_adventurer' } },
];
for (const state of uiStates) {
  const rows = hardcore.hardcoreRows('ui-session', state);
  assert(rows.length <= 5 && rows.every(row => row.components.length <= 5));
  rows.forEach(row => row.toJSON());
  hardcore.hardcoreEmbed(state, 'ui-user', null, 'ui-session').toJSON();
}

// Session không có statVersion vẫn được xem là v1 và resume nguyên dữ liệu.
const legacy = { classKey: 'barbarian', hp: 50, maxHp: 120, damageMin: 15, damageMax: 21, defense: 8,
  accuracy: 80, evasion: 8, critChance: 0.1, resistance: 5, energy: 3, maxEnergy: 3, items: [] };
stats.syncDerived(legacy);
assert.equal(legacy.damageMin, 15);
assert.equal(legacy.maxHp, 120);

require('../src/db').db.close();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
console.log(JSON.stringify({ ok: true, statVersion: 2, abuseCases: 12, itemDefinitions: Object.values(ITEMS).flat().length }));

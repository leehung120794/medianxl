const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { MessageFlags } = require('discord.js');
const { db } = require('../db');
const { spendCoins, settleReservedGame, creditCoins } = require('./economyService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { createFairness, fairInt } = require('./fairnessService');
const hardcoreRepository = require('./hardcoreRepository');
const hardcoreView = require('./hardcoreView');
const { EFFECT_KEYS, rarityLabel, normalizeEquipment } = require('./hardcoreEquipment');
const { MODIFIERS, regionForFloor, bossForFloor, modifierStacks } = require('./hardcoreWorld');
const { chaosLabel } = hardcoreView;
const { clamp, hitChance, defenseReduction, physicalAfterDefense, magicAfterResistance, enemyScale, baseMultiplier, potentialPayout } = require('./hardcoreEngine');

const MIN_BET = 10;
const MAX_BET = 100_000;
const MAX_PAYOUT = 10_000_000;
const MAX_FLOOR = 999;
const COMPLETION_FLOOR = 100;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const CLASSES = Object.freeze({
  barbarian: { name: 'Barbarian', emoji: '🪓', hp: 120, damageMin: 15, damageMax: 21, defense: 8, accuracy: 80, evasion: 8, critChance: 0.1, resistance: 5, energy: 3, skill: 'Iron Will' },
  assassin: { name: 'Assassin', emoji: '🗡️', hp: 95, damageMin: 14, damageMax: 20, defense: 5, accuracy: 90, evasion: 18, critChance: 0.18, resistance: 5, energy: 3, skill: 'Shadow Step' },
  amazon: { name: 'Amazon', emoji: '🏹', hp: 100, damageMin: 16, damageMax: 23, defense: 5, accuracy: 92, evasion: 14, critChance: 0.14, resistance: 5, energy: 3, skill: 'Barrage' },
  druid: { name: 'Druid', emoji: '🐺', hp: 110, damageMin: 15, damageMax: 22, defense: 7, accuracy: 82, evasion: 10, critChance: 0.1, resistance: 10, energy: 3, skill: 'Wild Regeneration' },
  necromancer: { name: 'Necromancer', emoji: '💀', hp: 100, damageMin: 15, damageMax: 21, defense: 6, accuracy: 84, evasion: 10, critChance: 0.1, resistance: 12, energy: 4, skill: 'Totem Ward' },
  paladin: { name: 'Paladin', emoji: '⚜️', hp: 115, damageMin: 15, damageMax: 22, defense: 9, accuracy: 84, evasion: 7, critChance: 0.09, resistance: 15, energy: 3, skill: 'Divine Shield' },
  sorceress: { name: 'Sorceress', emoji: '🔮', hp: 100, damageMin: 18, damageMax: 25, defense: 5, accuracy: 85, evasion: 12, critChance: 0.12, resistance: 15, energy: 4, skill: 'Arcane Burst' },
});

const ITEMS = Object.freeze({
  common: [
    { name: 'Rusted Edge', attack: 2, text: '+2 sát thương' },
    { name: 'Dented Plate', defense: 2, text: '+2 Defense' },
    { name: 'Red Potion Belt', potions: 1, text: '+1 bình máu' },
    { name: 'Rabbit Foot', luck: 1, text: '+1 Luck' },
  ],
  rare: [
    { name: 'Hunter’s Fang', attack: 4, critChance: 0.04, text: '+4 sát thương, +4% Crit' },
    { name: 'Runed Carapace', defense: 5, resistance: 5, text: '+5 Defense, +5 Resistance' },
    { name: 'Heart of the Wild', maxHp: 22, heal: 22, text: '+22 HP tối đa và hiện tại' },
    { name: 'Lucky Coin', luck: 3, text: '+3 Luck' },
  ],
  legendary: [
    { name: 'One More Hit', escapeTokens: 1, maxHp: 15, heal: 15, text: '+15 HP, nhận 1 Vé Thoát Hiểm' },
    { name: 'The Last Bad Decision', attack: 9, critChance: 0.08, maxHp: -15, text: '+9 sát thương, +8% Crit, −15 HP tối đa' },
    { name: 'Warden’s Bulwark', defense: 10, resistance: 12, text: '+10 Defense, +12 Resistance' },
    { name: 'Eye of RNGesus', luck: 7, attack: 3, text: '+7 Luck, +3 sát thương' },
  ],
  cursed: [
    { name: 'Glass Cannon', attack: 14, defenseSet: 0, text: '+14 sát thương, Defense về 0' },
    { name: 'Schrödinger’s Armor', defense: 12, maxHp: -20, text: '+12 Defense, −20 HP tối đa' },
    { name: 'Goblin’s Debt', luck: 10, bonusPenalty: 0.15, text: '+10 Luck, mất 15% payout hiện tại' },
  ],
});

const fairStateContext = new AsyncLocalStorage();
function nextFair(maximum, context) {
  const state = fairStateContext.getStore();
  if (!state?.fair?.serverSeed) return null;
  const value = fairInt(state.fair.serverSeed, `hardcore:${context}`, state.fairCounter || 0, maximum);
  state.fairCounter = (state.fairCounter || 0) + 1;
  return value;
}
function randomFloat() { const value = nextFair(1_000_000, 'float'); return (value ?? crypto.randomInt(1_000_000)) / 1_000_000; }
function randomInt(min, max) { const value = nextFair(max - min + 1, 'int'); return min + (value ?? crypto.randomInt(max - min + 1)); }
function pick(items) { const value = nextFair(items.length, 'pick'); return items[value ?? crypto.randomInt(items.length)]; }


function resolvePhysicalAttack(attacker, defender, level, options = {}) {
  const hitRoll = options.hitRoll ?? randomFloat();
  if (hitRoll >= hitChance(attacker.accuracy, defender.evasion)) return { hit: false, crit: false, raw: 0, damage: 0 };
  const base = options.baseDamage ?? randomInt(attacker.damageMin, attacker.damageMax);
  const multiplier = options.multiplier ?? 1;
  const critRoll = options.critRoll ?? randomFloat();
  const crit = critRoll < clamp((attacker.critChance || 0) - (defender.critResistance || 0), 0, 0.75);
  const raw = Math.floor(base * multiplier * (crit ? attacker.critDamage || 1.75 : 1));
  return { hit: true, crit, raw, damage: physicalAfterDefense(raw, defender.defense, level) };
}


function makeEnemy(floor, rank = 'normal', forcedName = null, state = null) {
  const rankStats = {
    normal: [1, 1, 1], champion: [1.4, 1.15, 1.4], elite: [2, 1.35, 2],
    boss: [floor <= 100 ? 2.6 : floor <= 500 ? 2.9 : 2.5, floor <= 100 ? 1.2 : floor <= 500 ? 1.25 : 1.1, 4],
    final_boss: [7.2, 1.05, 10],
    mimic: [1.7, 1.25, 1.8], ancient_mimic: [2.8, 1.5, 3],
  }[rank];
  const scale = enemyScale(floor);
  const fortified = modifierStacks(state, 'fortified');
  const elemental = modifierStacks(state, 'elemental_dominion');
  const swift = modifierStacks(state, 'swift_horror');
  const stoneSkin = modifierStacks(state, 'stone_skin');
  const isBoss = rank === 'boss' || rank === 'final_boss';
  const boss = isBoss ? bossForFloor(floor) : null;
  const maxHp = Math.min(1_000_000_000_000, Math.max(10, Math.floor(28 * scale.hp * rankStats[0] * (1 + fortified * 0.1))));
  const damageMin = Math.min(1_000_000_000_000, Math.max(2, Math.floor(5 * scale.damage * rankStats[1] * (1 + elemental * 0.04))));
  const damageMax = Math.min(1_000_000_000_000, Math.max(damageMin + 1, Math.floor(9 * scale.damage * rankStats[1] * (1 + elemental * 0.04))));
  const region = regionForFloor(floor);
  const name = forcedName || (boss?.name || (rank.includes('mimic') ? (rank === 'ancient_mimic' ? 'Ancient Mimic' : 'Mimic') : pick(region.enemies)));
  const enemy = {
    type: 'combat', rank, name, hp: maxHp, maxHp, damageMin, damageMax,
    defense: Math.floor((4 + floor * 1.8 * (isBoss ? 1.25 : 1)) * (1 + stoneSkin * 0.1)),
    accuracy: 70 + floor * 3 + swift * 3, evasion: 4 + Math.floor(floor / 12) + swift, critChance: isBoss ? 0.1 : 0.05,
    critDamage: 1.5, critResistance: isBoss ? 0.08 : 0, resistance: Math.min(60, Math.floor(floor * 0.8)),
    magicChance: Math.min(0.8, (isBoss ? 0.35 : rank === 'elite' || rank === 'ancient_mimic' ? 0.2 : 0.05) + elemental * 0.04),
    damageType: boss?.damageType || 'mixed',
    rewardMultiplier: rankStats[2],
  };
  if (boss) {
    enemy.mechanic = boss.mechanic;
    enemy.mechanicDescription = boss.description;
    if (boss.mechanic === 'assur_evasion') { enemy.evasion += 18; enemy.critChance += 0.12; }
    if (boss.mechanic === 'abyssal_spires') enemy.damageReduction = 0.25;
    if (boss.mechanic === 'frenzy') enemy.frenzyStacks = 0;
  }
  return enemy;
}

function chooseRarity(state) {
  if (state.pityRare >= 5) return 'rare';
  const legendaryChance = Math.min(0.35, 0.1 + Math.max(0, state.pityLegendary - 9) * 0.02 + state.luck * 0.002);
  const roll = randomFloat();
  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + 0.03) return 'cursed';
  if (roll < legendaryChance + 0.25) return 'rare';
  if (roll < legendaryChance + 0.65) return 'common';
  if (roll < 0.95) return 'empty';
  return 'fake_legendary';
}

const medianLootCache = new Map();
function medianItemsByType(typeCode) {
  if (!medianLootCache.has(typeCode)) {
    medianLootCache.set(typeCode, db.prepare('SELECT id, type_code, name, base_type, stats_json FROM items WHERE type_code=? ORDER BY id').all(typeCode));
  }
  return medianLootCache.get(typeCode);
}
function medianItemForRarity(rarity) {
  const typeByRarity = { common: ['TU'], rare: ['RW'], legendary: ['SU', 'SET'], cursed: ['SU'] };
  const types = typeByRarity[rarity];
  if (!types) return null;
  const pool = types.flatMap(medianItemsByType);
  if (!pool.length) return null;
  const row = pool[randomInt(0, pool.length - 1)];
  if (!row) return null;
  const stats = (() => { try { return JSON.parse(row.stats_json || '[]'); } catch { return []; } })();
  const text = stats.join(' ');
  const tier = { common: 1, rare: 2, legendary: 3, cursed: 4 }[rarity] || 1;
  const item = { name: `${row.name}${row.base_type ? ` · ${row.base_type}` : ''}`, typeCode: row.type_code, text: `[${row.type_code}]` };
  const effects = [];
  if (/enhanced damage|weapon physical|adds? .{0,30}damage/i.test(text)) { item.attack = 2 + tier * 2; effects.push(`+${item.attack} sát thương`); }
  if (/defense|damage reduced|physical resist/i.test(text)) { item.defense = 1 + tier * 2; effects.push(`+${item.defense} Defense`); }
  if (/resist|absorb/i.test(text)) { item.resistance = 2 + tier * 2; effects.push(`+${item.resistance} Resistance`); }
  if (/life|vitality/i.test(text)) { item.maxHp = 6 + tier * 6; item.heal = item.maxHp; effects.push(`+${item.maxHp} HP`); }
  if (/critical|deadly strike/i.test(text)) { item.critChance = 0.01 + tier * 0.01; effects.push(`+${Math.round(item.critChance * 100)}% Crit`); }
  if (!effects.length) { item.attack = 1 + tier * 2; effects.push(`+${item.attack} sát thương`); }
  if (rarity === 'cursed') { item.bonusPenalty = 0.1; effects.push('−10% payout hiện tại'); }
  item.text = `[${row.type_code}] ${effects.join(', ')}`;
  return item;
}

function makeChest(state, treasure = false) {
  const mimicRoll = randomFloat();
  const instability = modifierStacks(state, 'unstable_rift');
  const ancientChance = Math.min(0.08, 0.03 + instability * 0.01);
  const mimicChance = Math.min(0.3, 0.15 + instability * 0.03);
  const kind = mimicRoll < ancientChance ? 'ancient_mimic' : mimicRoll < mimicChance ? 'mimic' : treasure ? (randomFloat() < Math.min(0.7, 0.35 + instability * 0.05) ? 'legendary' : 'rare') : chooseRarity(state);
  const rarity = ITEMS[kind] ? kind : null;
  return {
    type: 'chest', kind, rarity, item: rarity ? (medianItemForRarity(rarity) || pick(ITEMS[rarity])) : null,
    inspected: false, revealed: false,
    detectionSuccess: randomFloat() < Math.min(0.85, 0.25 + state.luck * 0.03),
  };
}

function rngesusChance(floor) {
  if (floor < 5) return 0;
  if (floor < 10) return 0.003;
  if (floor < 20) return 0.006;
  return 0.01;
}

function rollRngesus(state, rolls = {}) {
  const base = rngesusChance(state.floor);
  if (!base) { state.lastChaosChance = 0; state.lastChaosSpike = false; return false; }
  const volatilityRoll = rolls.volatilityRoll ?? randomFloat();
  const spikeRoll = rolls.spikeRoll ?? randomFloat();
  const severityRoll = rolls.severityRoll ?? randomFloat();
  const encounterRoll = rolls.encounterRoll ?? randomFloat();
  const volatility = 0.25 + volatilityRoll * 2.75;
  const heat = Math.min(0.025, (state.rngesusDry || 0) * 0.0005);
  const spike = spikeRoll < 0.025 ? 0.04 + severityRoll * 0.06 : 0;
  const chance = clamp(base * volatility + heat + spike, 0, 0.12);
  const hit = encounterRoll < chance;
  state.lastChaosChance = chance;
  state.lastChaosSpike = spike > 0;
  state.rngesusDry = hit ? 0 : (state.rngesusDry || 0) + 1;
  return hit;
}

function addRiftModifier(state) {
  if (!Array.isArray(state.modifiers)) state.modifiers = [];
  const keys = Object.keys(MODIFIERS);
  const unused = keys.filter(key => !state.modifiers.includes(key));
  const key = pick(unused.length ? unused : keys);
  state.modifiers.push(key);
  return { key, ...MODIFIERS[key], stacks: modifierStacks(state, key) };
}

function forgeableItems(state) {
  return normalizeEquipment(state.items).filter(item => EFFECT_KEYS.some(key => item[key] !== undefined && key !== 'curseDefenseLost'));
}

function cursedItems(state) {
  return normalizeEquipment(state.items).filter(item => item.rarity === 'cursed' && !item.purified);
}

function eventCost(state, rate) {
  const payout = potentialPayout(state);
  if (payout <= 0) return 0;
  return Math.max(1, Math.min(payout, Math.floor(payout * rate)));
}

function makeSurpriseEvent(state) {
  const kinds = ['wandering_healer', 'treasure_goblin'];
  const forgeable = forgeableItems(state);
  const cursed = cursedItems(state);
  if (forgeable.length && eventCost(state, 0.12) > 0) kinds.push('blacksmith');
  if (cursed.length && eventCost(state, 0.2) > 0) kinds.push('purifier');
  const kind = pick(kinds);
  if (kind === 'blacksmith') {
    const item = pick(forgeable);
    return { type: 'surprise', kind, itemName: item.name, itemLevel: item.level, cost: eventCost(state, 0.12) };
  }
  if (kind === 'purifier') {
    const item = pick(cursed);
    return { type: 'surprise', kind, itemName: item.name, itemLevel: item.level, cost: eventCost(state, 0.2) };
  }
  if (kind === 'wandering_healer') return { type: 'surprise', kind, heal: Math.max(20, Math.floor(state.maxHp * 0.3)) };
  return { type: 'surprise', kind, success: randomFloat() < 0.6, reward: Math.max(1, Math.floor(state.stake * 0.25)), penaltyRate: 0.1 };
}

function generateEncounter(state) {
  if (state.floor === MAX_FLOOR) return makeEnemy(state.floor, 'final_boss', null, state);
  if (state.floor % 50 === 0) return makeEnemy(state.floor, 'boss', null, state);
  if (rollRngesus(state)) return { type: 'rngesus', name: 'RNGesus', fleeSuccess: randomFloat() < 0.75, prayerSuccess: randomFloat() < 0.1, prayerRarity: randomFloat() < 0.85 ? 'legendary' : 'cursed', chaosChance: state.lastChaosChance, chaosSpike: state.lastChaosSpike };
  const roll = randomFloat();
  const instability = modifierStacks(state, 'unstable_rift');
  const chestBoost = Math.min(0.16, instability * 0.02);
  if (roll < 0.53 - chestBoost) return makeEnemy(state.floor, 'normal', null, state);
  if (roll < 0.65 - chestBoost) return makeEnemy(state.floor, 'elite', null, state);
  if (roll < 0.75 - chestBoost / 2) return makeChest(state);
  if (roll < 0.83 - chestBoost / 2) return { type: 'shrine', kind: pick(['healing', 'armor', 'blood', 'experience', 'corrupted', 'fake']) };
  if (roll < 0.88) return makeChest(state, true);
  if (roll < 0.94) return { type: 'trap', kind: pick(['tax_collector', 'potion_thief', 'wrong_portal']) };
  if (roll < 0.98) return makeSurpriseEvent(state);
  return { type: 'empty' };
}

function applyItem(state, item, rarity = 'common') {
  if (!item) return null;
  state.items = normalizeEquipment(state.items);
  let equipment = state.items.find(entry => entry.name === item.name);
  if (!equipment) {
    equipment = { name: item.name, rarity, typeCode: item.typeCode || null, text: item.text, level: 0 };
    state.items.push(equipment);
  }
  const suppressCurse = equipment.purified && rarity === 'cursed';
  if (item.attack) { state.damageMin += item.attack; state.damageMax += item.attack; }
  if (item.defense) state.defense += item.defense;
  if (item.defenseSet !== undefined && !suppressCurse) {
    equipment.curseDefenseLost = (equipment.curseDefenseLost || 0) + Math.max(0, state.defense - item.defenseSet);
    state.defense = item.defenseSet;
  }
  if (item.resistance) state.resistance = clamp(state.resistance + item.resistance, -50, 75);
  if (item.critChance) state.critChance = Math.min(0.75, state.critChance + item.critChance);
  if (item.luck) state.luck += item.luck;
  if (item.potions) state.potions += item.potions;
  if (item.escapeTokens) state.escapeTokens += item.escapeTokens;
  if (item.maxHp && !(suppressCurse && item.maxHp < 0)) {
    state.maxHp = Math.max(20, state.maxHp + item.maxHp);
    state.hp = Math.min(state.maxHp, Math.max(1, state.hp + (item.heal || Math.max(0, item.maxHp))));
  }
  if (item.bonusPenalty && !suppressCurse) state.payoutFactor *= 1 - item.bonusPenalty;
  equipment.level += 1;
  equipment.text = item.text;
  equipment.typeCode = item.typeCode || equipment.typeCode;
  equipment.rarity = equipment.purified ? 'legendary' : rarity;
  for (const key of EFFECT_KEYS) if (item[key] !== undefined && key !== 'curseDefenseLost') equipment[key] = item[key];
  return equipment;
}

function spendPayout(state, cost) {
  const amount = Math.max(0, Math.floor(Number(cost) || 0));
  if (!amount || potentialPayout(state) < amount) throw new Error('NOT_ENOUGH_PAYOUT');
  state.payoutSpent = (Number(state.payoutSpent) || 0) + amount;
  return amount;
}

function forgeItem(state, itemName, cost) {
  state.items = normalizeEquipment(state.items);
  const item = state.items.find(entry => entry.name === itemName);
  if (!item || !EFFECT_KEYS.some(key => item[key] !== undefined && key !== 'curseDefenseLost')) throw new Error('ITEM_NOT_FOUND');
  spendPayout(state, cost);
  return applyItem(state, { ...item }, item.rarity);
}

function purifyItem(state, itemName, cost) {
  state.items = normalizeEquipment(state.items);
  const item = state.items.find(entry => entry.name === itemName && entry.rarity === 'cursed' && !entry.purified);
  if (!item) throw new Error('ITEM_NOT_FOUND');
  spendPayout(state, cost);
  const levels = Math.max(1, item.level || 1);
  const penalty = item.bonusPenalty !== undefined ? Number(item.bonusPenalty) : item.typeCode ? 0.1 : 0;
  if (penalty > 0 && penalty < 1) state.payoutFactor /= (1 - penalty) ** levels;
  if (item.maxHp < 0) {
    const restored = Math.abs(item.maxHp) * levels;
    state.maxHp += restored;
    state.hp = Math.min(state.maxHp, state.hp + restored);
  }
  if (item.curseDefenseLost > 0) state.defense += item.curseDefenseLost;
  delete item.bonusPenalty;
  delete item.defenseSet;
  delete item.curseDefenseLost;
  if (item.maxHp < 0) delete item.maxHp;
  item.rarity = 'legendary';
  item.purified = true;
  item.text = `${item.text || ''} · Đã giải nguyền`.replace(/^ · /, '');
  return item;
}

function updatePity(state, rarity) {
  if (rarity === 'legendary') state.pityLegendary = 0; else state.pityLegendary += 1;
  if (['rare', 'legendary', 'cursed'].includes(rarity)) state.pityRare = 0; else state.pityRare += 1;
}

function setNextEncounter(state, log) {
  if (state.floor >= MAX_FLOOR && state.cleared >= MAX_FLOOR) {
    state.phase = 'summit'; state.encounter = { type: 'summit' }; state.lastLog = log; return;
  }
  state.phase = 'encounter'; state.encounter = generateEncounter(state); state.lastLog = log;
}

function completeFloor(state, log, rewardMultiplier = 1) {
  const clearedFloor = state.floor;
  state.cleared = Math.max(state.cleared, clearedFloor);
  state.bonus += Math.floor(state.stake * 0.01 * rewardMultiplier);
  state.energy = Math.min(state.maxEnergy, state.energy + 1);
  if (clearedFloor % 5 === 0) {
    const checkpoint = clearedFloor < 100 ? { hp: 6, damage: 1 }
      : clearedFloor < 400 ? { hp: 10, damage: 2 }
        : clearedFloor < 700 ? { hp: 14, damage: 3 }
          : { hp: 30, damage: 6 };
    state.maxHp += checkpoint.hp;
    state.damageMin += checkpoint.damage;
    state.damageMax += checkpoint.damage;
    state.hp = state.maxHp;
    state.potions = Math.min(5, state.potions + 2);
    log += `\n🏕️ Checkpoint: +${checkpoint.hp} HP tối đa, +${checkpoint.damage} sát thương, hồi đầy máu và nhận 2 bình máu.`;
  }
  if (clearedFloor % 50 === 0) {
    state.bosses += 1;
    log += '\n🏆 Đã đánh bại boss Median XL của khu vực.';
  }
  if (clearedFloor % 10 === 0 && clearedFloor < MAX_FLOOR) {
    const modifier = addRiftModifier(state);
    log += `\n🌀 Rift Modifier mới: **${modifier.name}${modifier.stacks > 1 ? ` x${modifier.stacks}` : ''}** — ${modifier.description}`;
  }
  if (clearedFloor >= COMPLETION_FLOOR) state.completed = true;
  if (clearedFloor >= MAX_FLOOR) { state.floor = MAX_FLOOR; state.phase = 'summit'; state.encounter = { type: 'summit' }; state.lastLog = log; return; }
  state.floor = clearedFloor + 1;
  if (clearedFloor % 5 === 0 || clearedFloor === COMPLETION_FLOOR) {
    state.phase = 'upgrade'; state.encounter = { type: 'upgrade', milestone: clearedFloor };
    state.lastLog = `${log}\n🎁 Chọn một nâng cấp trước tầng ${state.floor}.`;
    return;
  }
  setNextEncounter(state, log);
}

function recordRun(guildId, userId, state, reason) {
  const death = ['death', 'rngesus'].includes(reason) ? 1 : 0;
  const escape = reason === 'cashout' ? 1 : 0;
  const completion = state.completed ? 1 : 0;
  hardcoreRepository.upsertRecord(guildId, userId, { bestFloor: state.cleared, runs: 1, deaths: death, escapes: escape, completions: completion });
}

function getHardcoreRecord(guildId, userId) {
  return hardcoreRepository.getRecord(guildId, userId) || { guild_id: String(guildId), user_id: String(userId), best_floor: 0, runs: 0, deaths: 0, escapes: 0, completions: 0 };
}
function getHardcoreTop(guildId, limit = 10) { return hardcoreRepository.getTop(guildId, limit); }

const getSession = hardcoreRepository.getSession;
const getHardcoreByUser = hardcoreRepository.getByUser;
const parseState = hardcoreRepository.parseState;
const saveState = hardcoreRepository.saveState;
const setMessageId = hardcoreRepository.setMessageId;

const startTx = db.transaction(({ guildId, userId, channelId, stake, classKey, forcedEncounter = null }) => {
  const template = CLASSES[classKey];
  if (!template) throw new Error('INVALID_CLASS');
  if (!Number.isSafeInteger(stake) || stake < MIN_BET || stake > MAX_BET) throw new Error('INVALID_BET');
  const maxBet = getGameBetLimit(guildId, 'hardcore');
  if (stake > maxBet) { const error = new Error('BET_LIMIT'); error.maxBet = maxBet; throw error; }
  if (getHardcoreByUser(guildId, userId)) throw new Error('ACTIVE_SESSION');
  const account = spendCoins({ guildId, userId, amount: stake, reason: 'hardcore:reserve' });
  const state = {
    classKey, className: template.name, stake, floor: 1, cleared: 0, hp: template.hp, maxHp: template.hp,
    damageMin: template.damageMin, damageMax: template.damageMax, defense: template.defense,
    accuracy: template.accuracy, evasion: template.evasion, critChance: template.critChance, critDamage: 1.75,
    resistance: template.resistance, energy: template.energy, maxEnergy: template.energy, potions: 3,
    luck: 0, pityRare: 0, pityLegendary: 0, bosses: 0, bonus: 0, payoutFactor: 1, payoutSpent: 0,
    escapeTokens: 0, items: [], modifiers: [], completed: false, turn: 0, phase: 'encounter', lastLog: 'Run bắt đầu.',
    rngesusDry: 0, lastChaosChance: 0, lastChaosSpike: false, fair: createFairness(), fairCounter: 0,
  };
  state.encounter = forcedEncounter || fairStateContext.run(state, () => generateEncounter(state));
  const now = Date.now();
  const session = { id: crypto.randomBytes(6).toString('hex'), guild_id: String(guildId), user_id: String(userId), channel_id: String(channelId), message_id: null, created_at: now, updated_at: now };
  hardcoreRepository.insertSession({ ...session, created_at: now, updated_at: now }, state);
  return { session, state, account };
});

function startHardcore(args) { return startTx(args); }

function finishRun(session, state, reason) {
  let payout = reason === 'cashout' || reason === 'summit' ? potentialPayout(state) : 0;
  const outcome = payout > state.stake ? 'win' : payout === state.stake ? 'draw' : 'loss';
  const account = settleReservedGame({ guildId: session.guild_id, userId: session.user_id, payout, stake: state.stake, game: 'hardcore', outcome,
    operationId: `settle:hardcore:${session.id}`, countGame: reason !== 'forfeit' });
  recordRun(session.guild_id, session.user_id, state, reason);
  hardcoreRepository.deleteSession(session.id);
  return { reason, payout, outcome, balance: account.balance, achievements: account.unlockedAchievements, experienceGained: account.experienceGained, levelUps: account.levelUps, bonusDrops: account.bonusDrops };
}
function forceEndHardcoreSession(id, guildId, adminId, { label = 'admin-refund', forfeit = false } = {}) {
  return db.transaction(() => {
    const session = hardcoreRepository.getActiveSession(id, guildId); if (!session) return null;
    const state = parseState(session);
    if (!forfeit) creditCoins({ guildId: session.guild_id, userId: session.user_id, amount: state.stake,
      reason: `hardcore:${label}:${adminId}:${session.id}`, operationId: `refund:hardcore-admin:${session.id}:${session.user_id}` });
    if (forfeit) recordRun(session.guild_id, session.user_id, state, 'forfeit');
    hardcoreRepository.deleteSession(session.id);
    return { session, state, participants: [session.user_id], forfeited: forfeit ? state.stake : 0 };
  })();
}

function enemyTurn(state, defend = false, dodge = false) {
  const enemy = state.encounter;
  if (dodge) return '💨 Bạn né hoàn toàn đòn phản công.';
  const bloodlust = enemy.hp <= enemy.maxHp / 2 ? modifierStacks(state, 'bloodlust') : 0;
  const frenzy = enemy.mechanic === 'frenzy' ? Math.min(5, enemy.frenzyStacks || 0) : 0;
  const damageMultiplier = 1 + bloodlust * 0.08 + frenzy * 0.08;
  const attacker = { ...enemy, damageMin: Math.max(1, Math.floor(enemy.damageMin * damageMultiplier)), damageMax: Math.max(2, Math.floor(enemy.damageMax * damageMultiplier)) };
  const defender = { defense: defend ? Math.floor(state.defense * 2) : state.defense, evasion: state.evasion, critResistance: defend ? 1 : 0 };
  const afterHit = damage => {
    const effects = [];
    const drainStacks = modifierStacks(state, 'soul_drain');
    if (drainStacks && state.energy > 0) {
      const drained = Math.min(state.energy, drainStacks >= 5 ? 2 : 1);
      state.energy -= drained;
      effects.push(`Soul Drain −${drained} Energy`);
    }
    if (enemy.mechanic === 'life_drain' && damage > 0) {
      const healed = Math.min(enemy.maxHp - enemy.hp, Math.max(1, Math.floor(damage * 0.35)));
      enemy.hp += healed;
      effects.push(`Lucion hồi ${healed} HP`);
    }
    return effects.length ? ` ${effects.join(' · ')}.` : '';
  };
  const addFrenzy = () => { if (enemy.mechanic === 'frenzy') enemy.frenzyStacks = frenzy + 1; };
  const useMagic = attacker.damageType === 'magic' || (attacker.damageType !== 'physical' && randomFloat() < attacker.magicChance);
  if (useMagic) {
    if (randomFloat() >= hitChance(attacker.accuracy, state.evasion)) { addFrenzy(); return '💨 Phép của quái đánh trượt.'; }
    const raw = randomInt(attacker.damageMin, attacker.damageMax);
    const effectiveResistance = state.resistance - modifierStacks(state, 'cursed_ground') * 4;
    let damage = magicAfterResistance(raw, effectiveResistance);
    if (defend) damage = Math.max(1, Math.floor(damage * 0.6));
    state.hp = Math.max(0, state.hp - damage);
    const effects = afterHit(damage); addFrenzy();
    return `🔮 Bạn nhận **${damage} sát thương phép**${defend ? ' sau khi đỡ 40%' : ''}.${effects}`;
  }
  const hit = resolvePhysicalAttack(attacker, defender, state.floor);
  if (!hit.hit) { addFrenzy(); return '💨 Quái đánh trượt.'; }
  let damage = hit.damage;
  if (defend) damage = Math.max(1, Math.floor(damage * 0.6));
  state.hp = Math.max(0, state.hp - damage);
  const effects = afterHit(damage); addFrenzy();
  return `${hit.crit ? '💢 Critical! ' : ''}Bạn nhận **${damage} sát thương vật lý**${defend ? ' sau khi đỡ 40%' : ''}.${effects}`;
}

function playerAttack(state, action) {
  const enemy = state.encounter;
  if (action === 'defend') { state.energy = Math.min(state.maxEnergy, state.energy + 1); return { log: '🛡️ Bạn thủ thế: Defense x2, chặn 40% sát thương còn lại, miễn chí mạng và hồi 1 năng lượng.', defend: true }; }
  if (action === 'potion') {
    if (state.potions <= 0) throw new Error('NO_POTION');
    if (state.hp >= state.maxHp) throw new Error('FULL_HP');
    const healed = Math.min(state.maxHp - state.hp, Math.max(20, Math.floor(state.maxHp * 0.35)));
    state.potions -= 1; state.hp += healed;
    return { log: `🧪 Hồi **${healed} HP**.`, defend: false };
  }
  let attack;
  let dodge = false;
  if (action === 'skill') {
    if (state.energy < 2) throw new Error('NO_ENERGY');
    state.energy -= 2;
    if (state.classKey === 'sorceress') {
      const raw = Math.floor(randomInt(state.damageMin, state.damageMax) * 2.1);
      attack = { hit: true, crit: false, damage: magicAfterResistance(raw, enemy.resistance) };
    } else if (state.classKey === 'amazon') {
      const shots = [
        resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 0.85 }),
        resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 0.85 }),
      ];
      const hits = shots.filter(shot => shot.hit);
      attack = { hit: hits.length > 0, crit: hits.some(shot => shot.crit), damage: hits.reduce((sum, shot) => sum + shot.damage, 0) };
    } else if (state.classKey === 'assassin') {
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.3 }); dodge = true;
    } else if (state.classKey === 'druid') {
      const healed = Math.min(state.maxHp - state.hp, Math.max(1, Math.floor(state.maxHp * 0.12)));
      state.hp += healed;
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.35 });
      attack.extraLog = ` Hồi **${healed} HP**.`;
    } else if (state.classKey === 'necromancer') {
      const raw = Math.floor(randomInt(state.damageMin, state.damageMax) * 1.55);
      attack = { hit: true, crit: false, damage: magicAfterResistance(raw, enemy.resistance) };
      dodge = true;
      attack.extraLog = ' Totem đỡ đòn phản công.';
    } else if (state.classKey === 'paladin') {
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.4 });
      attack.defend = true;
    } else attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.65 });
  } else {
    attack = resolvePhysicalAttack(state, enemy, state.floor);
    state.energy = Math.min(state.maxEnergy, state.energy + 1);
  }
  enemy.attackAttempts = (enemy.attackAttempts || 0) + 1;
  if (enemy.mechanic === 'rift_shield' && (enemy.attackAttempts - 1) % 3 === 0) {
    attack.hit = true;
    attack.crit = false;
    attack.damage = 0;
    attack.extraLog = `${attack.extraLog || ''} Rift Shield vô hiệu hóa đòn đánh.`;
  } else if (enemy.damageReduction && attack.damage > 0) {
    attack.damage = Math.max(1, Math.floor(attack.damage * (1 - enemy.damageReduction)));
    attack.extraLog = `${attack.extraLog || ''} Abyssal Spires giảm ${Math.round(enemy.damageReduction * 100)}% sát thương.`;
  }
  if (!attack.hit) return { log: `💨 Đòn đánh của bạn trượt.${attack.extraLog || ''}`, dodge, defend: Boolean(attack.defend) };
  enemy.hp = Math.max(0, enemy.hp - attack.damage);
  const skill = action === 'skill' ? `✨ ${CLASSES[state.classKey].skill}: ` : '⚔️ ';
  return { log: `${skill}${attack.crit ? 'Critical! ' : ''}Gây **${attack.damage} damage**.${attack.extraLog || ''}`, dodge, defend: Boolean(attack.defend) };
}

function applyShrine(state, kind) {
  if (kind === 'healing') { const heal = state.maxHp - state.hp; state.hp = state.maxHp; return `💚 Healing Shrine hồi ${heal} HP.`; }
  if (kind === 'armor') { state.defense += 3; return '🛡️ Armor Shrine: +3 Defense.'; }
  if (kind === 'blood') { state.hp = Math.max(1, state.hp - 15); state.damageMin += 4; state.damageMax += 4; return '🩸 Mất 15 HP, +4 sát thương.'; }
  if (kind === 'experience') { state.bonus += Math.floor(state.stake * 0.25); return '✨ Payout tạm thời tăng thêm 25% tiền cược.'; }
  if (kind === 'corrupted') { state.damageMin += 7; state.damageMax += 7; state.defense = Math.max(0, state.defense - 4); return '☣️ +7 sát thương, −4 Defense.'; }
  const damage = Math.max(10, Math.floor(state.maxHp * 0.3)); state.hp = Math.max(0, state.hp - damage); return `🤡 Shrine giả gây ${damage} damage.`;
}

const DISPLAY_STATS = ['hp', 'maxHp', 'damageMin', 'damageMax', 'defense', 'energy', 'potions', 'luck', 'critChance', 'evasion', 'resistance', 'escapeTokens'];
function statSnapshot(state) { return Object.fromEntries(DISPLAY_STATS.map(key => [key, Number(state[key]) || 0])); }
function statChanges(state, before) {
  return Object.fromEntries(DISPLAY_STATS.map(key => [key, +(Number((Number(state[key]) || 0) - before[key]).toFixed(4))]).filter(([, change]) => change));
}

const actionTx = db.transaction(({ sessionId, userId, expectedTurn, action }) => {
  const session = getSession(sessionId);
  if (!session || session.user_id !== String(userId)) throw new Error('INVALID_SESSION');
  const state = parseState(session);
  return fairStateContext.run(state, () => {
  if (state.turn !== expectedTurn) throw new Error('STALE_ACTION');
  const before = statSnapshot(state);
  state.lastStatChanges = null;
  state.turn += 1;
  if (action === 'retreat') return { settled: true, state, result: finishRun(session, state, state.cleared > 0 ? 'cashout' : 'forfeit') };
  if (state.phase === 'summit') return { settled: true, state, result: finishRun(session, state, 'summit') };

  if (state.phase === 'upgrade') {
    if (action === 'upgrade_attack') { state.damageMin += 5; state.damageMax += 5; state.lastLog = '⚔️ +5 sát thương.'; }
    else if (action === 'upgrade_hp') { state.maxHp += 30; state.hp = Math.min(state.maxHp, state.hp + 30); state.lastLog = '❤️ +30 HP tối đa và hiện tại.'; }
    else if (action === 'upgrade_defense') { state.defense += 6; state.lastLog = '🛡️ +6 Defense.'; }
    else if (action === 'upgrade_luck') { state.luck += 2; state.lastLog = '🍀 +2 Luck.'; }
    else throw new Error('INVALID_ACTION');
    setNextEncounter(state, `${state.lastLog}\nBạn tiến vào tầng ${state.floor}.`);
  } else if (state.encounter.type === 'combat') {
    if (!['attack', 'defend', 'skill', 'potion'].includes(action)) throw new Error('INVALID_ACTION');
    const acted = playerAttack(state, action);
    let log = acted.log;
    if (state.encounter.hp <= 0) {
      const enemy = state.encounter;
      completeFloor(state, `${log}\n🏆 Đã hạ **${enemy.name}**.`, enemy.rewardMultiplier);
    } else {
      log += `\n${enemyTurn(state, acted.defend, acted.dodge)}`;
      state.lastLog = log;
      if (state.hp <= 0) return { settled: true, state, result: finishRun(session, state, 'death') };
    }
  } else if (state.encounter.type === 'chest') {
    const chest = state.encounter;
    if (action === 'inspect') {
      if (chest.inspected) throw new Error('ALREADY_INSPECTED');
      chest.inspected = true;
      if (['mimic', 'ancient_mimic'].includes(chest.kind) && chest.detectionSuccess) { chest.revealed = true; state.lastLog = '👁️ Bạn phát hiện chiếc hòm đang thở. Đây là Mimic!'; }
      else state.lastLog = '🔍 Không phát hiện điều gì bất thường.';
    } else if (action === 'leave') {
      if (!chest.revealed) throw new Error('INVALID_ACTION');
      completeFloor(state, '🚪 Bạn tránh được Mimic và đi tiếp.', 0);
    } else if (action === 'sell') {
      state.bonus += Math.floor(state.stake * 0.15);
      completeFloor(state, '💰 Bán hòm, cộng 15% tiền cược vào payout.', 0.5);
    } else if (action === 'open') {
      if (['mimic', 'ancient_mimic'].includes(chest.kind)) {
        state.encounter = makeEnemy(state.floor, chest.kind, null, state);
        state.lastLog = `😈 Chiếc hòm hóa thành **${state.encounter.name}**!`;
      } else if (chest.kind === 'empty') {
        updatePity(state, 'empty'); completeFloor(state, '📦 Hòm hoàn toàn trống.', 0);
      } else if (chest.kind === 'fake_legendary') {
        updatePity(state, 'empty'); completeFloor(state, '🟠 Ánh sáng SSR bùng lên rồi tắt; đây là đồ giả không có chỉ số.', 0);
      } else {
        const equipment = applyItem(state, chest.item, chest.rarity); updatePity(state, chest.rarity);
        const itemType = chest.item.typeCode || rarityLabel(chest.rarity);
        completeFloor(state, `🎁 ${equipment.level > 1 ? 'Nâng cấp' : 'Nhận'} **${chest.item.name} Lv.${equipment.level}** (${itemType}): ${chest.item.text}.`, chest.rarity === 'legendary' ? 2 : 1);
      }
    } else throw new Error('INVALID_ACTION');
  } else if (state.encounter.type === 'shrine') {
    if (action === 'ignore') completeFloor(state, '🚶 Bạn bỏ qua Shrine.', 0);
    else if (action === 'touch') {
      const log = applyShrine(state, state.encounter.kind);
      if (state.hp <= 0) return { settled: true, state, result: finishRun(session, state, 'death') };
      completeFloor(state, log, 0.5);
    } else throw new Error('INVALID_ACTION');
  } else if (state.encounter.type === 'empty') {
    if (action !== 'continue') throw new Error('INVALID_ACTION');
    completeFloor(state, '🕳️ Căn phòng không có gì. Đúng nghĩa không có gì.', 0);
  } else if (state.encounter.type === 'trap') {
    if (action !== 'continue') throw new Error('INVALID_ACTION');
    const kind = state.encounter.kind;
    if (kind === 'tax_collector') {
      state.payoutFactor *= 0.85;
      completeFloor(state, '🧾 Tax Collector thu 15% payout vì lý do: “quy định là quy định”.', 0);
    } else if (kind === 'potion_thief') {
      const stolen = state.potions > 0 ? 1 : 0;
      state.potions = Math.max(0, state.potions - stolen);
      completeFloor(state, stolen ? '🦹 Kẻ trộm lấy mất 1 bình máu rồi biến mất.' : '🦹 Kẻ trộm kiểm tra túi đồ rỗng và tỏ vẻ thất vọng.', 0);
    } else {
      setNextEncounter(state, `🌀 Wrong Portal đưa bạn quay lại chính tầng ${state.floor}. Quái mới đã được roll lại.`);
    }
  } else if (state.encounter.type === 'surprise') {
    const event = state.encounter;
    if (action === 'event_skip') {
      completeFloor(state, '🚶 Bạn bỏ qua sự kiện bất ngờ và tiếp tục.', 0);
    } else if (event.kind === 'blacksmith' && action === 'forge') {
      const item = forgeItem(state, event.itemName, event.cost);
      completeFloor(state, `🔨 Thợ rèn lấy **${event.cost} xu payout** và nâng **${item.name}** lên **Lv.${item.level}**.`, 0);
    } else if (event.kind === 'purifier' && action === 'purify') {
      const item = purifyItem(state, event.itemName, event.cost);
      completeFloor(state, `✨ Tu sĩ lấy **${event.cost} xu payout** và giải lời nguyền cho **${item.name}**. Hiệu ứng phạt đã được gỡ.`, 0);
    } else if (event.kind === 'wandering_healer' && action === 'event_accept') {
      const healed = Math.min(state.maxHp - state.hp, event.heal);
      state.hp += healed;
      state.potions = Math.min(5, state.potions + 1);
      completeFloor(state, `🧙 Người chữa trị hồi **${healed} HP** và tặng 1 bình máu.`, 0);
    } else if (event.kind === 'treasure_goblin' && action === 'event_accept') {
      if (event.success) {
        state.bonus += event.reward;
        completeFloor(state, `🪙 Bạn bắt được Treasure Goblin và cộng **${event.reward} xu** vào payout.`, 0);
      } else {
        state.payoutFactor *= 1 - event.penaltyRate;
        completeFloor(state, `💨 Treasure Goblin trốn mất, còn cuỗm theo **${Math.round(event.penaltyRate * 100)}% payout**.`, 0);
      }
    } else throw new Error('INVALID_ACTION');
  } else if (state.encounter.type === 'rngesus') {
    const event = state.encounter;
    if (action === 'fight') return { settled: true, state, result: finishRun(session, state, 'rngesus') };
    if (action === 'flee') {
      if (!event.fleeSuccess) {
        if (state.escapeTokens > 0) {
          state.escapeTokens -= 1;
          completeFloor(state, '🪞 Bỏ chạy thất bại, nhưng Vé Thoát Hiểm tự kích hoạt làm bảo hiểm và cứu bạn.', 0);
        } else return { settled: true, state, result: finishRun(session, state, 'rngesus') };
      } else completeFloor(state, '🏃 Bạn thoát khỏi RNGesus với đôi chân run rẩy.', 0);
    } else if (action === 'bribe') {
      state.payoutFactor *= 0.6; completeFloor(state, '💸 RNGesus nhận 40% payout và cho bạn đi.', 0);
    } else if (action === 'pray') {
      if (!event.prayerSuccess) return { settled: true, state, result: finishRun(session, state, 'rngesus') };
      const rarity = event.prayerRarity === 'cursed' ? 'cursed' : 'legendary';
      const item = medianItemForRarity(rarity) || pick(ITEMS[rarity]);
      const equipment = applyItem(state, item, rarity); updatePity(state, rarity);
      completeFloor(state, `🙏 RNGesus cười và trao **${item.name} Lv.${equipment.level}** (${rarityLabel(rarity)}).`, 2);
    } else if (action === 'escape_token') {
      if (state.escapeTokens <= 0) throw new Error('NO_TOKEN');
      state.escapeTokens -= 1; completeFloor(state, '🪞 Vé Thoát Hiểm vỡ vụn và đưa bạn tới tầng tiếp theo.', 0);
    } else throw new Error('INVALID_ACTION');
  } else throw new Error('INVALID_ACTION');

  state.lastStatChanges = statChanges(state, before);
  saveState(session, state);
  return { settled: false, state, result: null };
  });
});

function playHardcore(args) { return actionTx(args); }

function hardcoreEmbed(state, userId, result = null, sessionId = null) { return hardcoreView.hardcoreEmbed(state, userId, result, CLASSES, sessionId, ITEMS); }
function hardcoreRows(sessionId, state, disabled = false) { return hardcoreView.hardcoreRows(sessionId, state, disabled, CLASSES); }

async function showHardcoreTurn(interaction, sessionId, state, result = null, settled = false, logger = null) {
  try {
    return await interaction.editReply({ embeds: [hardcoreEmbed(state, interaction.user.id, result, sessionId)],
      components: hardcoreRows(sessionId, state, settled), allowedMentions: { parse: [] } });
  } catch (error) {
    logger?.warn({ err: error, sessionId }, 'could not update hardcore panel');
    const fallback = {
      content: `⚠️ Bảng chi tiết chưa hiển thị được. **Sinh tồn · tầng ${state.floor} · lượt ${state.turn}**\n` +
        `❤️ ${state.hp}/${state.maxHp} HP\n${String(state.lastLog || '').slice(0, 700)}` +
        (result ? `\nKết quả: **${result.outcome === 'win' ? 'Thắng' : result.outcome === 'draw' ? 'Hòa' : 'Thua'}** · Nhận ${formatCoins(result.payout)} xu.` : ''),
      embeds: [], components: hardcoreRows(sessionId, state, settled), allowedMentions: { parse: [] },
    };
    try {
      return await interaction.editReply(fallback);
    } catch (fallbackError) {
      logger?.warn({ err: fallbackError, sessionId }, 'could not restore hardcore panel');
      const replacement = await interaction.followUp({ ...fallback, withResponse: true });
      const messageId = replacement?.resource?.message?.id || replacement?.id;
      if (messageId && !settled) setMessageId(sessionId, messageId);
      return replacement;
    }
  }
}

async function handleHardcoreButton(interaction, logger) {
  const [, sessionId, rawTurn, action] = interaction.customId.split(':');
  await interaction.deferUpdate();
  try {
    const session = getSession(sessionId);
    if (!session || session.guild_id !== interaction.guildId || session.channel_id !== interaction.channelId) {
      return interaction.followUp({ content: 'Lượt Sinh tồn đã kết thúc hoặc nút không còn hợp lệ.', flags: MessageFlags.Ephemeral });
    }
    if (session.user_id !== interaction.user.id) {
      return interaction.followUp({ content: 'Đây là lượt Sinh tồn của người chơi khác.', flags: MessageFlags.Ephemeral });
    }
    const played = playHardcore({ sessionId, userId: interaction.user.id, expectedTurn: Number(rawTurn), action });
    return showHardcoreTurn(interaction, sessionId, played.state, played.result, played.settled, logger);
  } catch (error) {
    if (error.message === 'STALE_ACTION') {
      const currentSession = getSession(sessionId);
      if (currentSession && (!currentSession.message_id || currentSession.message_id === interaction.message?.id)) {
        const currentState = parseState(currentSession);
        return showHardcoreTurn(interaction, sessionId, currentState, null, false, logger);
      }
      return interaction.followUp({ content: 'Nút này thuộc bảng Sinh tồn cũ. Hãy mở bảng đang chơi để tiếp tục.', flags: MessageFlags.Ephemeral });
    }
    const content = error.message === 'NO_ENERGY' ? 'Không đủ năng lượng dùng kỹ năng.'
        : error.message === 'NO_POTION' ? 'Bạn đã hết bình máu.'
          : error.message === 'FULL_HP' ? 'HP đang đầy.'
            : error.message === 'ALREADY_INSPECTED' ? 'Bạn đã kiểm tra hòm này.'
              : error.message === 'NO_TOKEN' ? 'Bạn không có Vé Thoát Hiểm.'
                : error.message === 'NOT_ENOUGH_PAYOUT' ? 'Payout hiện tại không đủ trả chi phí này.'
                  : error.message === 'ITEM_NOT_FOUND' ? 'Item của sự kiện không còn hợp lệ.' : 'Không thể thực hiện lựa chọn này.';
    return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  }
}

function cleanupStaleHardcoreSessions(now = Date.now()) {
  const rows = hardcoreRepository.listStale(now - STALE_MS);
  const cleanup = db.transaction(() => {
    for (const session of rows) {
      const state = parseState(session);
      settleReservedGame({ guildId: session.guild_id, userId: session.user_id, payout: 0, stake: state.stake, game: 'hardcore', outcome: 'loss',
        operationId: `settle:hardcore:${session.id}`, countGame: false });
      recordRun(session.guild_id, session.user_id, state, 'forfeit');
      hardcoreRepository.deleteSession(session.id);
    }
  });
  cleanup();
  return rows.length;
}

module.exports = {
  MIN_BET, MAX_BET, MAX_PAYOUT, MAX_FLOOR, COMPLETION_FLOOR, CLASSES, ITEMS,
  hitChance, defenseReduction, physicalAfterDefense, magicAfterResistance, resolvePhysicalAttack,
  enemyScale, makeEnemy, medianItemForRarity, addRiftModifier, rngesusChance, rollRngesus, chaosLabel, baseMultiplier, potentialPayout, generateEncounter,
  applyItem, forgeItem, purifyItem, makeSurpriseEvent,
  startHardcore, playHardcore, getHardcoreByUser, setMessageId, hardcoreEmbed, hardcoreRows, forceEndHardcoreSession,
  handleHardcoreButton, getHardcoreRecord, getHardcoreTop, cleanupStaleHardcoreSessions,
};



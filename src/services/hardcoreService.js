const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { MessageFlags } = require('discord.js');
const { db } = require('../db');
const { spendCoins, settleReservedGame, creditCoins } = require('./economyService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { createFairness, fairInt } = require('./fairnessService');
const hardcoreRepository = require('./hardcoreRepository');
const hardcoreView = require('./hardcoreView');
const { EFFECT_KEYS, rarityLabel, itemEffects, normalizeEquipment } = require('./hardcoreEquipment');
const { MODIFIERS, regionForFloor, bossForFloor, modifierStacks, effectiveModifierStacks } = require('./hardcoreWorld');
const { ITEMS } = require('../hardcore/item');
const { spendDiamonds } = require('./playerLevelService');
const { STAT_VERSION, CLASS_V2, initializeV2State, syncDerived, v2ItemBonuses, equipmentBonuses, v2HitChance, v2DefenseReduction } = require('./hardcoreStats');
const { SKILL_MANA_COST, basicAttackManaRestore } = require('./hardcoreClassInfo');
const { formatCoins } = require('../utils/economy');
const { chaosLabel } = hardcoreView;
const { clamp, hitChance: legacyHitChance, defenseReduction: legacyDefenseReduction,
  magicAfterResistance, enemyScale, baseMultiplier, potentialPayout: enginePotentialPayout } = require('./hardcoreEngine');

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

for (const [key, value] of Object.entries(CLASS_V2)) {
  Object.assign(CLASSES[key], { attributes: value.attributes, baseMana: value.baseMana });
}

function isV2(state) { return state?.statVersion === STAT_VERSION; }
function hitChance(accuracy, evasion, version = 1) { return version === STAT_VERSION ? v2HitChance(accuracy, evasion) : legacyHitChance(accuracy, evasion); }
function defenseReduction(defense, floor, version = 1) { return version === STAT_VERSION ? v2DefenseReduction(defense, floor) : legacyDefenseReduction(defense, floor); }
function physicalAfterDefense(raw, defense, floor, version = 1) { return Math.max(1, Math.floor(raw * (1 - defenseReduction(defense, floor, version)))); }
function potentialPayout(state) {
  const settled = enginePotentialPayout(state);
  return Math.max(0, Math.min(MAX_PAYOUT, Math.floor(settled * (1 + Math.max(-0.5, Number(state?.paradoxBloodBonus) || 0)))));
}
function payoutLoss(state, factor) {
  const before = potentialPayout(state);
  const copy = { ...state, payoutFactor: state.payoutFactor * factor };
  return Math.max(0, before - potentialPayout(copy));
}

const fairStateContext = new AsyncLocalStorage();
const hardcoreInteractionQueues = new Map();

function queueHardcoreInteraction(sessionId, task) {
  const key = String(sessionId);
  const previous = hardcoreInteractionQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  hardcoreInteractionQueues.set(key, current);
  current.finally(() => {
    if (hardcoreInteractionQueues.get(key) === current) hardcoreInteractionQueues.delete(key);
  }).catch(() => {});
  return current;
}
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

function riftModifierEffects(state, enemy = null) {
  const stoneSkin = modifierStacks(state, 'stone_skin');
  const elemental = modifierStacks(state, 'elemental_dominion');
  const bloodlust = modifierStacks(state, 'bloodlust');
  const unstable = modifierStacks(state, 'unstable_rift');
  const fortified = modifierStacks(state, 'fortified');
  const swift = modifierStacks(state, 'swift_horror');
  const soulDrain = modifierStacks(state, 'soul_drain');
  const cursedGround = modifierStacks(state, 'cursed_ground');
  const v2 = isV2(state);
  const power = stacks => v2 ? effectiveModifierStacks(stacks) : stacks;
  return {
    stoneSkinMultiplier: 1 + power(stoneSkin) * (v2 ? 0.08 : 0.1),
    elementalDamageMultiplier: 1 + power(elemental) * (v2 ? 0.03 : 0.04),
    magicChanceBonus: power(elemental) * (v2 ? 0.03 : 0.04),
    bloodlustDamageMultiplier: enemy && enemy.hp <= enemy.maxHp / 2 ? 1 + power(bloodlust) * (v2 ? 0.06 : 0.08) : 1,
    chestBoost: Math.min(0.16, unstable * 0.02),
    ancientMimicChance: Math.min(0.08, 0.03 + unstable * 0.01),
    mimicChance: Math.min(0.3, 0.15 + unstable * 0.03),
    treasureLegendaryChance: Math.min(0.7, 0.35 + unstable * 0.05),
    fortifiedMultiplier: 1 + power(fortified) * (v2 ? 0.08 : 0.1),
    swiftAccuracyBonus: v2 ? Math.round(power(swift) * 3) : swift * 3,
    swiftEvasionBonus: v2 ? Math.round(power(swift) * 1.5) : swift,
    soulDrainAmount: v2 ? (soulDrain ? Math.min(3, Math.ceil(soulDrain / 4)) : 0) : (soulDrain ? (soulDrain >= 5 ? 2 : 1) : 0),
    cursedResistancePenalty: v2 ? Math.round(power(cursedGround) * 3) : cursedGround * 4,
  };
}


function resolvePhysicalAttack(attacker, defender, level, options = {}) {
  const hitRoll = options.hitRoll ?? randomFloat();
  const version = options.statVersion || attacker.statVersion || defender.statVersion || 1;
  if (hitRoll >= hitChance(attacker.accuracy, defender.evasion, version)) return { hit: false, crit: false, raw: 0, damage: 0 };
  const base = options.baseDamage ?? randomInt(attacker.damageMin, attacker.damageMax);
  const multiplier = options.multiplier ?? 1;
  const critRoll = options.critRoll ?? randomFloat();
  const crit = critRoll < clamp((attacker.critChance || 0) - (defender.critResistance || 0), 0, 0.75);
  const raw = Math.floor(base * multiplier * (crit ? attacker.critDamage || 1.75 : 1));
  return { hit: true, crit, raw, damage: physicalAfterDefense(raw, defender.defense, level, version) };
}

function rollEnemyAttackType(enemy) {
  if (enemy.damageType === 'physical' || enemy.damageType === 'magic') return enemy.damageType;
  return randomFloat() < (enemy.magicChance || 0) ? 'magic' : 'physical';
}


function makeEnemy(floor, rank = 'normal', forcedName = null, state = null) {
  const rankStats = {
    normal: [1, 1, 1], champion: [1.4, 1.15, 1.4], elite: [2, 1.35, 2],
    boss: [floor <= 100 ? 2.6 : floor <= 500 ? 2.9 : 2.5, floor <= 100 ? 1.2 : floor <= 500 ? 1.25 : 1.1, 4],
    final_boss: [7.2, 1.05, 10],
    mimic: [1.7, 1.25, 1.8], ancient_mimic: [2.8, 1.5, 3],
  }[rank];
  const scale = enemyScale(floor);
  const rift = riftModifierEffects(state);
  const v2 = isV2(state);
  const lateProgress = v2 ? clamp((floor - 400) / 599, 0, 1) : 0;
  const lateHpMultiplier = 1 + lateProgress * 0.5;
  const lateDamageMultiplier = 1 + lateProgress * 0.9;
  const isBoss = rank === 'boss' || rank === 'final_boss';
  const boss = isBoss ? bossForFloor(floor) : null;
  const maxHp = Math.min(1_000_000_000_000, Math.max(10, Math.floor(28 * scale.hp * rankStats[0] * rift.fortifiedMultiplier * lateHpMultiplier)));
  const damageMin = Math.min(1_000_000_000_000, Math.max(2, Math.floor(5 * scale.damage * rankStats[1] * rift.elementalDamageMultiplier * lateDamageMultiplier)));
  const damageMax = Math.min(1_000_000_000_000, Math.max(damageMin + 1, Math.floor(9 * scale.damage * rankStats[1] * rift.elementalDamageMultiplier * lateDamageMultiplier)));
  const region = regionForFloor(floor);
  const name = forcedName || (boss?.name || (rank.includes('mimic') ? (rank === 'ancient_mimic' ? 'Ancient Mimic' : 'Mimic') : pick(region.enemies)));
  const enemy = {
    type: 'combat', rank, name, hp: maxHp, maxHp, damageMin, damageMax,
    defense: Math.floor((v2 ? 10 + floor * 0.4 : 4 + floor * 1.8) * (isBoss ? 1.25 : 1) * rift.stoneSkinMultiplier),
    accuracy: (v2 ? 70 + Math.floor(floor / 20) : 70 + floor * 3) + rift.swiftAccuracyBonus,
    evasion: (v2 ? 5 + Math.floor(floor / 30) : 4 + Math.floor(floor / 12)) + rift.swiftEvasionBonus, critChance: isBoss ? 0.1 : 0.05,
    critDamage: 1.5, critResistance: isBoss ? 0.08 : 0,
    resistance: v2 ? Math.min(55, 5 + Math.floor(floor / 25) + (isBoss ? 5 : 0)) : Math.min(60, Math.floor(floor * 0.8)),
    magicChance: Math.min(0.8, (isBoss ? 0.35 : rank === 'elite' || rank === 'ancient_mimic' ? 0.2 : 0.05) + rift.magicChanceBonus),
    damageType: boss?.damageType || 'mixed',
    rewardMultiplier: rankStats[2],
    soulDrainCharges: v2 ? rift.soulDrainAmount : null,
  };
  if (boss) {
    enemy.mechanic = boss.mechanic;
    enemy.mechanicDescription = boss.description;
    if (boss.mechanic === 'assur_evasion') { enemy.evasion += 18; enemy.critChance += 0.12; }
    if (boss.mechanic === 'abyssal_spires') enemy.damageReduction = 0.25;
    if (boss.mechanic === 'frenzy') enemy.frenzyStacks = 0;
  }
  enemy.nextAttackType = rollEnemyAttackType(enemy);
  return enemy;
}

function chooseRarity(state) {
  if (state.pityRare >= 5) return 'rare';
  const legendaryChance = Math.min(0.35, 0.1 + Math.max(0, state.pityLegendary - 9) * 0.02 + state.luck * 0.002 + (state.legendaryFind || 0));
  const roll = randomFloat();
  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + 0.03) return 'cursed';
  if (roll < legendaryChance + 0.25) return 'rare';
  if (roll < legendaryChance + 0.65) return 'common';
  if (roll < 0.95) return 'empty';
  return 'fake_legendary';
}

function makeChest(state, treasure = false) {
  const mimicRoll = randomFloat();
  const rift = riftModifierEffects(state);
  const ancientChance = Math.min(0.2, rift.ancientMimicChance + (state.mimicChance || 0) * 0.25);
  const mimicChance = Math.min(0.6, rift.mimicChance + (state.mimicChance || 0));
  const kind = mimicRoll < ancientChance ? 'ancient_mimic' : mimicRoll < mimicChance ? 'mimic'
    : treasure ? (randomFloat() < rift.treasureLegendaryChance ? 'legendary' : 'rare') : chooseRarity(state);
  const rarity = ITEMS[kind] ? kind : null;
  return {
    type: 'chest', kind, rarity, item: rarity ? pick(ITEMS[rarity]) : null,
    inspected: false, revealed: false,
    detectionSuccess: randomFloat() < Math.min(0.95, 0.25 + state.luck * 0.03 + (state.mimicDetection || 0)),
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
  const descriptions = isV2(state) ? {
    stone_skin: 'Tăng Defense quái theo stack giảm dần, tổng hiệu lực tối đa +64%.',
    elemental_dominion: 'Tăng damage và khả năng dùng phép theo stack giảm dần, tối đa +24%.',
    bloodlust: 'Dưới 50% HP, damage quái tăng theo stack giảm dần, tối đa +48%.',
    fortified: 'Tăng HP quái theo stack giảm dần, tổng hiệu lực tối đa +64%.',
    swift_horror: 'Tăng Accuracy/Evasion theo stack giảm dần.',
    soul_drain: 'Mỗi combat có số lần rút 1 Mana được khóa theo stack, tối đa 3 lần.',
    cursed_ground: 'Giảm RES hiệu dụng theo stack giảm dần, tối đa 24 điểm.',
  } : null;
  return { key, ...MODIFIERS[key], description: descriptions?.[key] || MODIFIERS[key].description, stacks: modifierStacks(state, key) };
}

function forgeableItems(state) {
  return normalizeEquipment(state.items).filter(item => Object.keys(itemEffects(item)).length > 0);
}

function cursedItems(state) {
  return normalizeEquipment(state.items).filter(item => item.rarity === 'cursed' && !item.purified);
}

function eventCost(state, rate) {
  // Cửa hàng chỉ dùng payout đã chốt; bonus tạm của Blood Paradox không thể đem đi mua rồi hồi máu để lách.
  const payout = enginePotentialPayout(state);
  if (payout <= 0) return 0;
  return Math.max(1, Math.min(payout, Math.floor(payout * rate)));
}

function rarityPool(rarity) { return ITEMS[rarity] || []; }
function makeRiftDuelist(state) {
  const hands = Array.from({ length: 5 }, () => pick(['rock', 'paper', 'scissors']));
  const penalty = Array.from({ length: 6 }, () => pick(['strength', 'dexterity', 'vitality', 'energy']));
  const rewardRarity = randomFloat() < 0.75 ? 'legendary' : 'cursed';
  const eligible = normalizeEquipment(state.items).filter(item => ['common', 'rare', 'legendary'].includes(item.rarity));
  return { type: 'surprise', kind: 'rift_duelist', stage: 'choose', hands, round: 0, wins: 0, penalty,
    rewardRarity, rewardItem: pick(rarityPool(rewardRarity)), penaltyItemName: eligible.length ? pick(eligible).name : null };
}

function makeItemMerchant(state, currency) {
  const rarityWeights = currency === 'payout' ? [['common', 45], ['rare', 40], ['legendary', 15]]
    : currency === 'hp' ? [['rare', 55], ['legendary', 35], ['cursed', 10]] : [['rare', 40], ['legendary', 40], ['cursed', 20]];
  const rates = currency === 'payout' ? { common: 0.05, rare: 0.12, legendary: 0.25 }
    : currency === 'hp' ? { rare: 0.12, legendary: 0.25, cursed: 0.4 } : { rare: 200, legendary: 600, cursed: 1600 };
  const rollRarity = () => {
    const roll = randomInt(1, 100); let cursor = 0;
    for (const [rarity, weight] of rarityWeights) { cursor += weight; if (roll <= cursor) return rarity; }
    return rarityWeights.at(-1)[0];
  };
  const used = new Set(); const offers = [];
  while (offers.length < 3) {
    const rarity = rollRarity(); const item = pick(rarityPool(rarity));
    if (used.has(item.id)) continue;
    used.add(item.id);
    const cost = currency === 'payout' ? eventCost(state, rates[rarity])
      : currency === 'hp' ? Math.max(1, Math.ceil(state.maxHp * rates[rarity])) : rates[rarity];
    offers.push({ rarity, item, cost });
  }
  state.merchantVisits[currency] = (state.merchantVisits[currency] || 0) + 1;
  state.merchantLastFloor[currency] = state.floor;
  return { type: 'surprise', kind: `${currency}_item_shop`, currency, offers, maxHpAtCreation: state.maxHp };
}

function luckyBreakChance(luck) { return Math.min(0.3, Math.max(0, Number(luck) || 0) * 0.015); }
function portalGoodChance() { return 0.5; }
function treasureGoblinChance(luck) { return Math.min(0.8, 0.6 + Math.max(0, Number(luck) || 0) * 0.01); }

function pickUnique(items, count) {
  const pool = [...items]; const selected = [];
  while (pool.length && selected.length < count) selected.push(pool.splice(randomInt(0, pool.length - 1), 1)[0]);
  return selected;
}

function merchantOffers(state) {
  const definitions = [
    { type: 'potion', name: 'Bình máu', rate: 0.05 },
    { type: 'heal', name: 'Hồi đầy HP', rate: 0.08 },
    { type: 'luck', name: '+1 Luck', rate: 0.1 },
    { type: 'rare_item', name: 'Trang bị SR', rate: 0.15 },
    { type: 'escape_token', name: 'Vé Thoát Hiểm', rate: 0.25 },
  ];
  return pickUnique(definitions, 3).map(offer => ({ ...offer, cost: eventCost(state, offer.rate), item: offer.type === 'rare_item' ? pick(ITEMS.rare) : null }));
}

function makeSurpriseEvent(state) {
  const kinds = [
    'wandering_healer', 'treasure_goblin', 'altar_of_sacrifice', 'lost_adventurer', 'blood_fountain',
    'mirror_of_fate', 'treasure_room', 'strange_doors',
  ];
  const forgeable = forgeableItems(state);
  const cursed = cursedItems(state);
  if (forgeable.length && eventCost(state, 0.12) > 0) kinds.push('blacksmith');
  if (cursed.length && eventCost(state, 0.2) > 0) kinds.push('purifier');
  if (forgeable.length) kinds.push('horadric_forge');
  if (eventCost(state, 0.1) > 0) kinds.push('cursed_gambler');
  if (eventCost(state, 0.05) > 0) kinds.push('rift_merchant');
  if (!state.contract) kinds.push('rift_contract');
  if (!state.classBlessing) kinds.push('class_shrine');
  if (isV2(state)) {
    kinds.push('rift_duelist');
    const visits = state.merchantVisits || {};
    const last = state.merchantLastFloor || {};
    if ((visits.payout || 0) < 5 && state.floor - (last.payout ?? -99) >= 50 && enginePotentialPayout(state) > 0) kinds.push('payout_item_shop');
    if ((visits.hp || 0) < 3 && state.floor - (last.hp ?? -99) >= 50) kinds.push('hp_item_shop');
    if (state.floor >= 101 && (visits.diamond || 0) < 2 && state.floor - (last.diamond ?? -99) >= 50) kinds.push('diamond_item_shop');
  }
  const kind = pick(kinds);
  if (kind === 'rift_duelist') return makeRiftDuelist(state);
  if (kind.endsWith('_item_shop')) return makeItemMerchant(state, kind.split('_')[0]);
  if (kind === 'blacksmith') {
    const item = pick(forgeable);
    return { type: 'surprise', kind, itemName: item.name, itemLevel: item.level, cost: eventCost(state, 0.12) };
  }
  if (kind === 'purifier') {
    const item = pick(cursed);
    return { type: 'surprise', kind, itemName: item.name, itemLevel: item.level, cost: eventCost(state, 0.2) };
  }
  if (kind === 'wandering_healer') return { type: 'surprise', kind, heal: Math.max(20, Math.floor(state.maxHp * 0.3)) };
  if (kind === 'treasure_goblin') {
    const successChance = Math.min(0.9, treasureGoblinChance(state.luck) + (state.goblinChance || 0));
    return { type: 'surprise', kind, success: randomFloat() < successChance, successChance, reward: Math.max(1, Math.floor(state.stake * 0.25)), penaltyRate: 0.1 };
  }
  if (kind === 'altar_of_sacrifice') return { type: 'surprise', kind, hpCost: Math.max(1, Math.floor(state.maxHp * 0.2)), payoutCost: eventCost(state, 0.1) };
  if (kind === 'cursed_gambler') return { type: 'surprise', kind, win: randomFloat() < 0.5, cost10: eventCost(state, 0.1), cost25: eventCost(state, 0.25) };
  if (kind === 'lost_adventurer') {
    const rescueRarity = randomFloat() < 0.3 ? 'rare' : 'common';
    const robbedCursed = randomFloat() < 0.25;
    return { type: 'surprise', kind, rescueRarity, rescueItem: pick(ITEMS[rescueRarity]), robbedRarity: robbedCursed ? 'cursed' : 'common', robbedItem: pick(ITEMS[robbedCursed ? 'cursed' : 'common']) };
  }
  if (kind === 'blood_fountain') {
    const roll = randomFloat();
    return { type: 'surprise', kind, outcome: roll < 0.6 ? 'heal' : roll < 0.85 ? 'max_hp' : 'mimic' };
  }
  if (kind === 'horadric_forge') {
    const item = pick(forgeable);
    return { type: 'surprise', kind, itemName: item.name, itemLevel: item.level, itemRarity: item.rarity, attributeRoll: pick(['strength', 'vitality']) };
  }
  if (kind === 'rift_merchant') return { type: 'surprise', kind, offers: merchantOffers(state) };
  if (kind === 'mirror_of_fate') return { type: 'surprise', kind, smashSuccess: randomFloat() < 0.2 };
  if (kind === 'treasure_room') {
    const colors = ['red', 'blue', 'gold']; const mimicColor = pick(colors);
    const inspectColor = randomFloat() < 0.5 ? mimicColor : pick(colors.filter(color => color !== mimicColor));
    return { type: 'surprise', kind, mimicColor, inspectColor, inspected: false, revealedColor: null };
  }
  if (kind === 'rift_contract') return { type: 'surprise', kind, contractKind: pick(['no_potion', 'no_skill', 'no_defend']) };
  if (kind === 'class_shrine') return { type: 'surprise', kind };
  return {
    type: 'surprise', kind: 'strange_doors',
    lightGood: randomFloat() < 0.7, goldGood: randomFloat() < 0.7, darkGood: randomFloat() < 0.6,
    goldReward: Math.max(1, Math.floor(state.stake * 0.5)), darkItem: pick(ITEMS.legendary),
  };
}

function makeTrap(state) {
  const kind = pick(['tax_collector', 'potion_thief', 'wrong_portal']);
  if (kind !== 'wrong_portal') {
    const breakChance = luckyBreakChance(state.luck);
    return { type: 'trap', kind, luckyBreak: breakChance > 0 && randomFloat() < breakChance, luckyBreakChance: breakChance };
  }
  const goodChance = portalGoodChance();
  if (randomFloat() < goodChance) {
    return { type: 'trap', kind, portalOutcome: 'good', portalGoodChance: goodChance, blessing: pick(['healing_sanctuary', 'treasure_vault', 'rift_blessing']) };
  }
  const penalties = ['blood_loss', 'payout_corruption', 'dimensional_curse'];
  if (state.energy > 0) penalties.push('energy_drain');
  if (state.potions > 0) penalties.push('supply_loss');
  return { type: 'trap', kind, portalOutcome: 'bad', portalGoodChance: goodChance, penalty: pick(penalties) };
}

const KARMA_ACTIONS = new Set(['adventurer_rescue', 'adventurer_rob', 'altar_hp', 'altar_payout', 'event_skip', 'mirror_smash', 'sell', 'bribe', 'pray']);
function rememberChoice(state, event, action) {
  if (!isV2(state) || !KARMA_ACTIONS.has(action) || event?.type === 'karma') return;
  state.karmaLedger ||= [];
  if (state.karmaLedger.length >= 8) state.karmaLedger.shift();
  state.karmaLedger.push({ id: crypto.randomBytes(4).toString('hex'), source: event?.kind || event?.type || 'unknown', action,
    madeAtFloor: state.floor, triggerFloor: state.floor + randomInt(10, 30), outcome: randomFloat() < 0.5 ? 'good' : 'bad',
    payloadRoll: randomInt(1, 100), active: false });
  state.karmaNoticePending = true;
}

function dueKarma(state) {
  return (state.karmaLedger || []).find(entry => !entry.resolved && state.floor >= entry.triggerFloor);
}

function generateEncounter(state) {
  if (state.floor === MAX_FLOOR) return makeEnemy(state.floor, 'final_boss', null, state);
  if (state.floor % 50 === 0) return makeEnemy(state.floor, 'boss', null, state);
  if (rollRngesus(state)) return { type: 'rngesus', name: 'RNGesus', fleeSuccess: randomFloat() < 0.75, prayerSuccess: randomFloat() < 0.1, prayerRarity: randomFloat() < 0.85 ? 'legendary' : 'cursed', chaosChance: state.lastChaosChance, chaosSpike: state.lastChaosSpike };
  const karma = dueKarma(state);
  if (karma) { karma.active = true; return { type: 'karma', karmaId: karma.id, source: karma.source, action: karma.action, outcome: karma.outcome, payloadRoll: karma.payloadRoll }; }
  const graveBand = Math.floor(state.floor / 100);
  if (isV2(state) && state.floor >= 101 && !(state.graveBandsSeen || []).includes(graveBand) && randomFloat() < 0.01) {
    const echo = hardcoreRepository.claimEcho(state.guildId, state.sessionId, state.userId, state.floor);
    if (echo) {
      state.graveBandsSeen ||= []; state.graveBandsSeen.push(graveBand);
      return { type: 'grave_echo', echoId: echo.id, name: echo.name, classKey: echo.class_key, deathFloor: echo.death_floor,
        level: echo.level, kills: echo.kills, isNemesis: Boolean(echo.is_nemesis), snapshot: echo.snapshot,
        robWakes: randomFloat() < 0.5, rewardIndex: echo.snapshot.items?.length ? randomInt(0, echo.snapshot.items.length - 1) : -1 };
    }
  }
  const roll = randomFloat();
  const chestBoost = riftModifierEffects(state).chestBoost;
  if (roll < 0.53 - chestBoost) return makeEnemy(state.floor, 'normal', null, state);
  if (roll < 0.65 - chestBoost) return makeEnemy(state.floor, 'elite', null, state);
  if (roll < 0.75 - chestBoost / 2) return makeChest(state);
  if (roll < 0.83 - chestBoost / 2) {
    const kind = pick(['healing', 'armor', 'blood', 'experience', 'corrupted', 'fake']);
    return { type: 'shrine', kind, attributeRoll: kind === 'armor' ? pick(['strength', 'vitality']) : null };
  }
  if (roll < 0.88) return makeChest(state, true);
  if (roll < 0.94) return makeTrap(state);
  if (roll < 0.98 && state.floor - (state.specialEventLastFloor ?? -99) >= 2) {
    state.specialEventLastFloor = state.floor;
    return makeSurpriseEvent(state);
  }
  return { type: 'empty' };
}

function applyEffectSet(state, effects, equipment, suppressCurse = false, trackCurse = false) {
  if (!effects || suppressCurse) return;
  const trackedKeys = ['defense', 'maxHp', 'resistance', 'critChance', 'luck', 'accuracy', 'evasion', 'maxEnergy', 'energy',
    'potions', 'escapeTokens', 'potionPower', 'bossDamage', 'eliteDamage', 'mimicDetection', 'goblinChance',
    'legendaryFind', 'floorHpLoss', 'mimicChance', 'damageTaken'];
  const before = trackCurse ? Object.fromEntries(trackedKeys.map(key => [key, Number(state[key]) || 0])) : null;
  const damageBefore = trackCurse ? state.damageMin : 0;
  if (effects.attack) { state.damageMin += effects.attack; state.damageMax += effects.attack; }
  if (effects.defense) state.defense = Math.max(0, state.defense + effects.defense);
  if (effects.defenseSet !== undefined) {
    equipment.curseDefenseLost = (equipment.curseDefenseLost || 0) + Math.max(0, state.defense - effects.defenseSet);
    state.defense = effects.defenseSet;
  }
  if (effects.resistance) state.resistance = clamp(state.resistance + effects.resistance, -50, 75);
  if (effects.critChance) state.critChance = clamp(state.critChance + effects.critChance, 0, 0.75);
  if (effects.luck) state.luck = Math.max(0, state.luck + effects.luck);
  if (effects.accuracy) state.accuracy = Math.max(0, state.accuracy + effects.accuracy);
  if (effects.evasion) state.evasion = Math.max(0, state.evasion + effects.evasion);
  if (effects.potions) state.potions = Math.max(0, state.potions + effects.potions);
  if (effects.escapeTokens) state.escapeTokens = Math.max(0, state.escapeTokens + effects.escapeTokens);
  if (effects.maxEnergy) {
    state.maxEnergy = Math.max(1, state.maxEnergy + effects.maxEnergy);
    state.energy = Math.min(state.maxEnergy, Math.max(0, state.energy + Math.max(0, effects.maxEnergy)));
  }
  if (effects.maxHp) {
    state.maxHp = Math.max(20, state.maxHp + effects.maxHp);
    state.hp = Math.min(state.maxHp, Math.max(1, state.hp + (effects.heal || Math.max(0, effects.maxHp))));
  } else if (effects.heal) state.hp = Math.min(state.maxHp, state.hp + effects.heal);
  if (effects.bonusPenalty) state.payoutFactor *= 1 - effects.bonusPenalty;
  const bounds = {
    potionPower: [-0.3, 0.5], bossDamage: [0, 1], eliteDamage: [0, 1], mimicDetection: [0, 0.5],
    goblinChance: [0, 0.3], legendaryFind: [0, 0.25], floorHpLoss: [0, 0.2], mimicChance: [0, 0.3], damageTaken: [0, 0.5],
  };
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    if (effects[key]) state[key] = clamp((Number(state[key]) || 0) + effects[key], minimum, maximum);
  }
  if (trackCurse) {
    equipment.curseApplied ||= {};
    const attackDelta = state.damageMin - damageBefore;
    if (attackDelta) equipment.curseApplied.attack = (equipment.curseApplied.attack || 0) + attackDelta;
    for (const key of trackedKeys) {
      const delta = (Number(state[key]) || 0) - before[key];
      if (delta) equipment.curseApplied[key] = (equipment.curseApplied[key] || 0) + delta;
    }
  }
}

function applyV2LevelEffects(state, item, suppressCurse = false) {
  const effects = item.effects || {};
  if (effects.potions) state.potions = Math.max(0, state.potions + effects.potions);
  if (effects.escapeTokens) state.escapeTokens = Math.max(0, state.escapeTokens + effects.escapeTokens);
  if (effects.heal && !effects.maxHp) applyHpDelta(state, { amount: effects.heal, source: 'healing' });
  const penalty = suppressCurse ? 0 : Number(item.curse?.effects?.bonusPenalty) || 0;
  if (penalty > 0 && penalty < 1) state.payoutFactor *= 1 - penalty;
}

function applyItem(state, item, rarity = 'common') {
  if (!item) return null;
  state.items = normalizeEquipment(state.items);
  let equipment = state.items.find(entry => entry.name === item.name);
  const itemAttributes = isV2(state) ? v2ItemBonuses(item) : null;
  if (!equipment) {
    equipment = { id: item.id || null, name: item.name, rarity, typeCode: item.typeCode || null, text: item.text, level: 0,
      attributes: isV2(state) ? Object.fromEntries(['strength', 'dexterity', 'vitality', 'energy'].map(key => [key, Number(itemAttributes[key]) || 0])) : undefined,
      catalogVersion: isV2(state) ? state.itemCatalogVersion : undefined };
    state.items.push(equipment);
  }
  const suppressCurse = equipment.purified && rarity === 'cursed';
  if (isV2(state)) {
    equipment.attributes ||= Object.fromEntries(['strength', 'dexterity', 'vitality', 'energy'].map(key => [key, Number(itemAttributes[key]) || 0]));
    applyV2LevelEffects(state, item, suppressCurse);
  } else if (item.effects) {
    applyEffectSet(state, item.effects, equipment);
    applyEffectSet(state, item.curse?.effects, equipment, suppressCurse, true);
  } else {
    // Phiên cũ lưu hiệu ứng ở cấp gốc; giữ nguyên cách đọc để resume không làm hỏng run.
    const legacy = itemEffects(item);
    const oldCurseKeys = rarity === 'cursed' ? ['bonusPenalty', 'defenseSet'] : [];
    if (rarity === 'cursed' && legacy.maxHp < 0) oldCurseKeys.push('maxHp');
    const boon = Object.fromEntries(Object.entries(legacy).filter(([key]) => !oldCurseKeys.includes(key)));
    const curse = Object.fromEntries(Object.entries(legacy).filter(([key]) => oldCurseKeys.includes(key)));
    applyEffectSet(state, boon, equipment);
    applyEffectSet(state, curse, equipment, suppressCurse, true);
  }
  equipment.level += 1;
  for (const key of ['id', 'text', 'typeCode', 'category', 'curseText']) if (item[key] !== undefined) equipment[key] = item[key];
  equipment.tags = Array.isArray(item.tags) ? [...item.tags] : equipment.tags;
  if (item.effects) equipment.effects = { ...item.effects };
  if (item.curse) equipment.curse = { ...item.curse, effects: { ...(item.curse.effects || {}) } };
  equipment.rarity = equipment.purified ? 'legendary' : rarity;
  for (const key of EFFECT_KEYS) if (item[key] !== undefined && key !== 'curseDefenseLost') equipment[key] = item[key];
  if (isV2(state)) syncDerived(state);
  return equipment;
}

function spendPayout(state, cost) {
  const amount = Math.max(0, Math.floor(Number(cost) || 0));
  if (!amount || enginePotentialPayout(state) < amount) throw new Error('NOT_ENOUGH_PAYOUT');
  state.payoutSpent = (Number(state.payoutSpent) || 0) + amount;
  return amount;
}

function forgeItem(state, itemName, cost) {
  state.items = normalizeEquipment(state.items);
  const item = state.items.find(entry => entry.name === itemName);
  if (!item || !Object.keys(itemEffects(item)).length) throw new Error('ITEM_NOT_FOUND');
  if (isV2(state)) {
    spendPayout(state, cost);
    applyV2LevelEffects(state, item, Boolean(item.purified));
    item.level += 1;
    syncDerived(state);
    return item;
  }
  spendPayout(state, cost);
  return applyItem(state, { ...item }, item.rarity);
}

function purifyItem(state, itemName, cost) {
  state.items = normalizeEquipment(state.items);
  const item = state.items.find(entry => entry.name === itemName && entry.rarity === 'cursed' && !entry.purified);
  if (!item) throw new Error('ITEM_NOT_FOUND');
  spendPayout(state, cost);
  if (isV2(state)) {
    item.rarity = 'legendary'; item.purified = true; delete item.curse; delete item.curseText; delete item.curseApplied;
    item.text = `${item.text || ''} · Đã giải nguyền`.replace(/^ · /, '');
    syncDerived(state);
    return item;
  }
  const levels = Math.max(1, item.level || 1);
  const curse = item.curse?.effects;
  if (curse) {
    const scaled = key => Number(curse[key] || 0) * levels;
    if (curse.bonusPenalty > 0 && curse.bonusPenalty < 1) state.payoutFactor /= (1 - curse.bonusPenalty) ** levels;
    const applied = item.curseApplied;
    if (applied) {
      if (applied.attack) { state.damageMin -= applied.attack; state.damageMax -= applied.attack; }
      for (const key of ['defense', 'resistance', 'critChance', 'luck', 'accuracy', 'evasion', 'potions', 'escapeTokens',
        'potionPower', 'bossDamage', 'eliteDamage', 'mimicDetection', 'goblinChance', 'legendaryFind', 'floorHpLoss', 'mimicChance', 'damageTaken']) {
        if (applied[key]) state[key] = (Number(state[key]) || 0) - applied[key];
      }
      if (applied.maxHp) { state.maxHp = Math.max(20, state.maxHp - applied.maxHp); state.hp = Math.min(state.maxHp, state.hp + Math.max(0, -applied.maxHp)); }
      if (applied.maxEnergy) state.maxEnergy = Math.max(1, state.maxEnergy - applied.maxEnergy);
      if (applied.energy) state.energy = clamp(state.energy - applied.energy, 0, state.maxEnergy);
    } else {
      if (curse.attack) { state.damageMin -= scaled('attack'); state.damageMax -= scaled('attack'); }
      if (curse.defense) state.defense = Math.max(0, state.defense - scaled('defense'));
      if (curse.maxHp) { const restored = -scaled('maxHp'); state.maxHp = Math.max(20, state.maxHp + restored); state.hp = Math.min(state.maxHp, state.hp + Math.max(0, restored)); }
      if (curse.resistance) state.resistance = clamp(state.resistance - scaled('resistance'), -50, 75);
      if (curse.critChance) state.critChance = clamp(state.critChance - scaled('critChance'), 0, 0.75);
      for (const key of ['luck', 'accuracy', 'evasion']) if (curse[key]) state[key] = Math.max(0, state[key] - scaled(key));
      if (curse.maxEnergy) { state.maxEnergy = Math.max(1, state.maxEnergy - scaled('maxEnergy')); state.energy = Math.min(state.maxEnergy, state.energy + Math.max(0, -scaled('maxEnergy'))); }
      const bounded = ['potionPower', 'bossDamage', 'eliteDamage', 'mimicDetection', 'goblinChance', 'legendaryFind', 'floorHpLoss', 'mimicChance', 'damageTaken'];
      for (const key of bounded) if (curse[key]) state[key] = Math.max(0, (Number(state[key]) || 0) - scaled(key));
    }
  } else {
    const penalty = item.bonusPenalty !== undefined ? Number(item.bonusPenalty) : item.typeCode ? 0.1 : 0;
    if (penalty > 0 && penalty < 1) state.payoutFactor /= (1 - penalty) ** levels;
    if (item.maxHp < 0) { const restored = Math.abs(item.maxHp) * levels; state.maxHp += restored; state.hp = Math.min(state.maxHp, state.hp + restored); }
  }
  if (item.curseDefenseLost > 0 && !item.curseApplied) state.defense += item.curseDefenseLost;
  delete item.bonusPenalty;
  delete item.defenseSet;
  delete item.curseDefenseLost;
  delete item.curseApplied;
  if (item.maxHp < 0) delete item.maxHp;
  delete item.curse;
  delete item.curseText;
  item.rarity = 'legendary';
  item.purified = true;
  item.text = `${item.text || ''} · Đã giải nguyền`.replace(/^ · /, '');
  return item;
}

function consumeEquipmentLevel(state, itemName) {
  state.items = normalizeEquipment(state.items);
  const index = state.items.findIndex(item => item.name === itemName);
  if (index < 0) throw new Error('ITEM_NOT_FOUND');
  const item = state.items[index];
  state.absorbedItemStats ||= { levels: 0, effects: {}, payoutFactor: 1, defenseSet: false };
  const absorbed = state.absorbedItemStats;
  const sets = [itemEffects(item)];
  if (!item.purified && item.curse?.effects) sets.push(item.curse.effects);
  for (const effects of sets) for (const [key, raw] of Object.entries(effects || {})) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (key === 'bonusPenalty') absorbed.payoutFactor *= 1 - value;
    else if (key === 'defenseSet') absorbed.defenseSet = true;
    else absorbed.effects[key] = (absorbed.effects[key] || 0) + value;
  }
  absorbed.levels += 1;
  if (isV2(state)) {
    const retained = equipmentBonuses([{ ...item, level: 1 }]);
    absorbed.v2Attributes ||= { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
    for (const key of Object.keys(state.statBonuses)) {
      if (key === 'defenseOverride') continue;
      state.statBonuses[key] = (Number(state.statBonuses[key]) || 0) + (Number(retained[key]) || 0);
      if (Object.hasOwn(absorbed.v2Attributes, key)) absorbed.v2Attributes[key] += Number(retained[key]) || 0;
    }
    if (retained.defenseOverride !== null) state.statBonuses.defenseOverride = retained.defenseOverride;
  }
  if (item.rarity === 'cursed' && !item.purified) absorbed.cursedLevels = (absorbed.cursedLevels || 0) + 1;
  if (item.curseApplied && item.level > 0) {
    for (const [key, total] of Object.entries(item.curseApplied)) {
      item.curseApplied[key] = total - total / item.level;
      if (Math.abs(item.curseApplied[key]) < 1e-9) delete item.curseApplied[key];
    }
  }
  if (item.curseDefenseLost && item.level > 0) item.curseDefenseLost -= item.curseDefenseLost / item.level;
  if (item.level > 1) item.level -= 1; else state.items.splice(index, 1);
  if (isV2(state)) syncDerived(state);
  return item;
}

function activeClassBlessing(state, classKey = state.classKey) {
  const blessing = state.classBlessing;
  return Boolean(blessing && blessing.classKey === classKey && state.cleared >= blessing.startCleared && state.cleared <= blessing.targetCleared);
}

function resolveTimedEffects(state, clearedFloor, log) {
  if (activeClassBlessing(state, 'druid') && clearedFloor > state.classBlessing.startCleared) {
    const healed = Math.min(state.maxHp - state.hp, Math.max(1, Math.floor(state.maxHp * 0.05)));
    applyHpDelta(state, { amount: healed, source: 'healing' });
    log += `\n🐺 Class Shrine hồi **${healed} HP**.`;
  }
  if (state.contract && clearedFloor >= state.contract.targetCleared) {
    if (state.contract.failed) log += '\n📜 Rift Contract thất bại; phần thưởng bị hủy.';
    else if (state.contract.kind === 'no_potion') {
      const item = pick(ITEMS.legendary); const equipment = applyItem(state, item, 'legendary');
      log += `\n📜 Hoàn thành hợp đồng không dùng bình: nhận **${item.name} Lv.${equipment.level}** (SSR).`;
    } else if (state.contract.kind === 'no_skill') {
      const reward = Math.max(1, Math.floor(state.stake * 0.5)); state.bonus += reward;
      log += `\n📜 Hoàn thành hợp đồng không dùng kỹ năng: +**${reward} xu payout**.`;
    } else {
      if (isV2(state)) {
        const key = damageAttributeForClass(state.classKey); changeEventAttributes(state, { [key]: 10 });
        log += `\n📜 Hoàn thành hợp đồng không phòng thủ: **+10 ${key.toUpperCase()}**.`;
      } else {
        state.damageMin += 5; state.damageMax += 5;
        log += '\n📜 Hoàn thành hợp đồng không phòng thủ: **+5 sát thương**.';
      }
    }
    state.contract = null;
  }
  if (state.classBlessing && clearedFloor >= state.classBlessing.targetCleared) {
    log += '\n⛩️ Hiệu ứng Class Shrine đã kết thúc.';
    state.classBlessing = null;
  }
  return log;
}

function updatePity(state, rarity) {
  if (rarity === 'legendary') state.pityLegendary = 0; else state.pityLegendary += 1;
  if (['rare', 'legendary', 'cursed'].includes(rarity)) state.pityRare = 0; else state.pityRare += 1;
}

function setNextEncounter(state, log) {
  expireParadox(state);
  if (state.floor >= MAX_FLOOR && state.cleared >= MAX_FLOOR) {
    state.phase = 'summit'; state.encounter = { type: 'summit' }; state.lastLog = log; return;
  }
  state.phase = 'encounter'; state.encounter = generateEncounter(state); state.lastLog = log;
}

function openPostFloorPhase(state, clearedFloor, log) {
  if (!isV2(state)) return setNextEncounter(state, log);
  const claimedParadox = state.paradoxMilestonesClaimed ||= [];
  if (clearedFloor > 0 && clearedFloor < MAX_FLOOR && clearedFloor % 25 === 0 && !claimedParadox.includes(clearedFloor)) {
    state.phase = 'paradox';
    state.encounter = { type: 'paradox', milestone: clearedFloor, duration: 5 };
    state.lastLog = `${log}\n🌀 Rift Paradox bắt buộc: chọn một luật cho 5 tầng tiếp theo.`;
    return;
  }
  const claimedSeverance = state.severanceMilestonesClaimed ||= [];
  if ([199, 399, 699, 899].includes(clearedFloor) && !claimedSeverance.includes(clearedFloor)) {
    const harmful = [...new Set((state.modifiers || []).filter(key => key !== 'unstable_rift'))];
    if (harmful.length) {
      state.phase = 'severance'; state.encounter = { type: 'severance', milestone: clearedFloor, choices: harmful.slice(0, 4) };
      state.lastLog = `${log}\n✂️ Rift Severance cho phép xóa toàn bộ stack của một modifier.`;
      return;
    }
    claimedSeverance.push(clearedFloor);
  }
  setNextEncounter(state, log);
}

function expireParadox(state) {
  if (!state.activeParadox || state.floor <= state.activeParadox.untilFloor) return;
  state.lastLog = `${state.lastLog || ''}\n🌀 Rift Paradox đã kết thúc.`;
  state.activeParadox = null;
  state.paradoxBloodBonus = 0;
}

function applyHpDelta(state, { amount, source }) {
  const before = state.hp;
  state.hp = clamp(state.hp + Math.trunc(amount), 0, state.maxHp);
  const actual = state.hp - before;
  if (state.activeParadox?.kind === 'blood_money' && ['hostile', 'healing'].includes(source) && state.maxHp > 0) {
    const rate = Math.abs(actual) / state.maxHp;
    const signed = source === 'hostile' ? rate : -rate;
    state.paradoxBloodBonus = clamp((Number(state.paradoxBloodBonus) || 0) + signed, -0.5, 0.5);
  }
  return actual;
}

function completeFloor(state, log, rewardMultiplier = 1) {
  const clearedFloor = state.floor;
  state.cleared = Math.max(state.cleared, clearedFloor);
  state.bonus += Math.floor(state.stake * 0.01 * rewardMultiplier);
  state.energy = Math.min(state.maxEnergy, state.energy + 1);
  log = resolveTimedEffects(state, clearedFloor, log);
  if (clearedFloor % 5 === 0) {
    const checkpoint = clearedFloor < 100 ? { hp: 6, damage: 1 }
      : clearedFloor < 400 ? { hp: 10, damage: 2 }
        : clearedFloor < 700 ? { hp: 14, damage: 3 }
          : { hp: 30, damage: 6 };
    if (!isV2(state)) {
      state.maxHp += checkpoint.hp;
      state.damageMin += checkpoint.damage;
      state.damageMax += checkpoint.damage;
    }
    state.hp = state.maxHp;
    state.potions = Math.min(5, state.potions + 2);
    log += isV2(state) ? '\n🏕️ Checkpoint: hồi đầy HP, nhận 2 bình máu và được phân bổ +5 thuộc tính.'
      : `\n🏕️ Checkpoint: +${checkpoint.hp} HP tối đa, +${checkpoint.damage} sát thương, hồi đầy máu và nhận 2 bình máu.`;
  }
  if (clearedFloor % 50 === 0) {
    state.bosses += 1;
    log += '\n🏆 Đã đánh bại boss Median XL của khu vực.';
  }
  if (clearedFloor % 10 === 0 && clearedFloor < MAX_FLOOR) {
    const modifier = addRiftModifier(state);
    log += `\n🌀 Rift Modifier mới: **${modifier.name}${modifier.stacks > 1 ? ` x${modifier.stacks}` : ''}** — ${modifier.description}`;
  }
  if (state.floorHpLoss > 0) {
    const lost = Math.min(Math.max(0, state.hp - 1), Math.max(1, Math.floor(state.maxHp * state.floorHpLoss)));
    applyHpDelta(state, { amount: -lost, source: 'hostile' });
    if (lost) log += `\n🩸 Lời nguyền trang bị lấy **${lost} HP** sau khi vượt tầng.`;
  }
  if (clearedFloor >= COMPLETION_FLOOR) state.completed = true;
  if (clearedFloor >= MAX_FLOOR) { state.floor = MAX_FLOOR; state.phase = 'summit'; state.encounter = { type: 'summit' }; state.lastLog = log; return; }
  state.floor = clearedFloor + 1;
  if (clearedFloor % 5 === 0 || clearedFloor === COMPLETION_FLOOR) {
    state.phase = 'upgrade'; state.encounter = { type: 'upgrade', milestone: clearedFloor };
    state.lastLog = `${log}\n🎁 Chọn một nâng cấp trước tầng ${state.floor}.`;
    return;
  }
  openPostFloorPhase(state, clearedFloor, log);
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

const startTx = db.transaction(({ guildId, userId, channelId, stake, classKey, playerName = null, forcedEncounter = null }) => {
  const template = CLASSES[classKey];
  if (!template) throw new Error('INVALID_CLASS');
  if (!Number.isSafeInteger(stake) || stake < MIN_BET || stake > MAX_BET) throw new Error('INVALID_BET');
  const maxBet = getGameBetLimit(guildId, 'hardcore');
  if (stake > maxBet) { const error = new Error('BET_LIMIT'); error.maxBet = maxBet; throw error; }
  if (getHardcoreByUser(guildId, userId)) throw new Error('ACTIVE_SESSION');
  const account = spendCoins({ guildId, userId, amount: stake, reason: 'hardcore:reserve' });
  const state = {
    classKey, className: template.name, playerName: String(playerName || userId).slice(0, 80), stake, floor: 1, cleared: 0, hp: template.hp, maxHp: template.hp,
    damageMin: template.damageMin, damageMax: template.damageMax, defense: template.defense,
    accuracy: template.accuracy, evasion: template.evasion, critChance: template.critChance, critDamage: 1.75,
    resistance: template.resistance, energy: template.energy, maxEnergy: template.energy, potions: 3,
    luck: 0, pityRare: 0, pityLegendary: 0, bosses: 0, bonus: 0, payoutFactor: 1, payoutSpent: 0,
    potionPower: 0, bossDamage: 0, eliteDamage: 0, mimicDetection: 0, goblinChance: 0,
    legendaryFind: 0, floorHpLoss: 0, mimicChance: 0, damageTaken: 0,
    escapeTokens: 0, items: [], absorbedItemStats: { levels: 0, effects: {}, payoutFactor: 1, defenseSet: false, cursedLevels: 0 },
    modifiers: [], contract: null, classBlessing: null, completed: false, turn: 0, phase: 'encounter', lastLog: 'Run bắt đầu.',
    rngesusDry: 0, lastChaosChance: 0, lastChaosSpike: false, fair: createFairness(), fairCounter: 0,
    sessionId: null, guildId: String(guildId), userId: String(userId), paradoxMilestonesClaimed: [], activeParadox: null, severanceMilestonesClaimed: [],
    karmaLedger: [], specialEventLastFloor: -99, merchantVisits: { payout: 0, hp: 0, diamond: 0 }, merchantLastFloor: {},
  };
  initializeV2State(state);
  state.hp = state.maxHp;
  state.energy = state.maxEnergy;
  const now = Date.now();
  const session = { id: crypto.randomBytes(6).toString('hex'), guild_id: String(guildId), user_id: String(userId), channel_id: String(channelId), message_id: null, created_at: now, updated_at: now };
  state.sessionId = session.id;
  state.encounter = forcedEncounter || fairStateContext.run(state, () => generateEncounter(state));
  hardcoreRepository.insertSession({ ...session, created_at: now, updated_at: now }, state);
  return { session, state, account };
});

function startHardcore(args) { return startTx(args); }

const resumeTx = db.transaction(({ guildId, userId, channelId }) => {
  const session = getHardcoreByUser(guildId, userId);
  if (!session) throw new Error('NO_ACTIVE_SESSION');
  const state = parseState(session);
  const pendingMessageId = `pending:${Date.now()}:${crypto.randomBytes(3).toString('hex')}`;
  const changed = hardcoreRepository.relocateSession(session.id, guildId, userId, channelId, pendingMessageId);
  if (!changed) throw new Error('NO_ACTIVE_SESSION');
  return { session: { ...session, channel_id: String(channelId), message_id: pendingMessageId }, state };
});

function resumeHardcore(args) { return resumeTx(args); }

function finishRun(session, state, reason) {
  let payout = reason === 'cashout' || reason === 'summit' ? potentialPayout(state) : 0;
  const outcome = payout > state.stake ? 'win' : payout === state.stake ? 'draw' : 'loss';
  const account = settleReservedGame({ guildId: session.guild_id, userId: session.user_id, payout, stake: state.stake, game: 'hardcore', outcome,
    operationId: `settle:hardcore:${session.id}`, countGame: reason !== 'forfeit' });
  recordRun(session.guild_id, session.user_id, state, reason);
  if (reason === 'death' || reason === 'rngesus') {
    if (state.activeEchoId) {
      const snapshot = state.activeEchoSnapshot || { items: [] };
      const candidates = normalizeEquipment(state.items);
      if (candidates.length) {
        const source = pick(candidates);
        const absorbed = { ...source, level: Math.min(5, Math.max(1, source.level || 1)) };
        snapshot.items = [...(snapshot.items || []).filter(item => item.name !== absorbed.name), absorbed].slice(-3);
      }
      hardcoreRepository.strengthenEcho(state.activeEchoId, snapshot);
    } else if (isV2(state) && state.cleared >= 100) {
      const items = normalizeEquipment(state.items).sort((a, b) => b.level - a.level).slice(0, 3).map(item => ({ ...item, level: Math.min(5, item.level) }));
      const attributes = state.attributes || {};
      const build = Object.entries(attributes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';
      hardcoreRepository.createEcho({ id: crypto.randomBytes(8).toString('hex'), guildId: session.guild_id, ownerUserId: session.user_id,
        name: state.playerName || session.user_id, classKey: state.classKey, deathFloor: state.cleared,
        snapshot: { skill: CLASSES[state.classKey].skill, items, build, cause: reason, statVersion: state.statVersion }, expiresAt: Date.now() + 7 * 86_400_000 });
    }
  } else if (state.encounter?.echoId) hardcoreRepository.releaseEcho(state.encounter.echoId, session.id);
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
  const finishTurn = text => { enemy.nextAttackType = rollEnemyAttackType(enemy); return text; };
  if (dodge) return finishTurn('💨 Bạn né hoàn toàn đòn phản công.');
  if (activeClassBlessing(state, 'assassin')) {
    state.classBlessing = null;
    return finishTurn('🗡️ Shadow Omen từ Class Shrine giúp bạn chắc chắn né đòn này.');
  }
  const rift = riftModifierEffects(state, enemy);
  const frenzy = enemy.mechanic === 'frenzy' ? Math.min(5, enemy.frenzyStacks || 0) : 0;
  const damageMultiplier = rift.bloodlustDamageMultiplier + frenzy * 0.08;
  const attacker = { ...enemy, damageMin: Math.max(1, Math.floor(enemy.damageMin * damageMultiplier)), damageMax: Math.max(2, Math.floor(enemy.damageMax * damageMultiplier)) };
  const barbarianBonus = activeClassBlessing(state, 'barbarian') && state.hp <= state.maxHp * 0.3 ? 8 : 0;
  const reverse = isV2(state) && state.activeParadox?.kind === 'reverse';
  const effectiveDefense = (reverse ? Math.floor((state.damageMin + state.damageMax) / 2) : state.defense) + barbarianBonus;
  const defender = { statVersion: state.statVersion, defense: defend ? Math.floor(effectiveDefense * 2) : effectiveDefense, evasion: state.evasion, critResistance: defend ? 1 : 0 };
  const afterHit = damage => {
    const effects = [];
    const soulDrain = isV2(state) ? Math.min(1, enemy.soulDrainCharges || 0) : rift.soulDrainAmount;
    if (soulDrain && state.energy > 0) {
      const drained = Math.min(state.energy, soulDrain);
      state.energy -= drained;
      if (isV2(state)) enemy.soulDrainCharges = Math.max(0, enemy.soulDrainCharges - 1);
      effects.push(`Soul Drain −${drained} Mana`);
    }
    if (enemy.mechanic === 'life_drain' && damage > 0) {
      const healed = Math.min(enemy.maxHp - enemy.hp, Math.max(1, Math.floor(damage * 0.35)));
      enemy.hp += healed;
      effects.push(`Lucion hồi ${healed} HP`);
    }
    return effects.length ? ` ${effects.join(' · ')}.` : '';
  };
  const addFrenzy = () => { if (enemy.mechanic === 'frenzy') enemy.frenzyStacks = frenzy + 1; };
  const useMagic = (enemy.nextAttackType || rollEnemyAttackType(enemy)) === 'magic';
  if (useMagic) {
    if (randomFloat() >= hitChance(attacker.accuracy, state.evasion, state.statVersion)) { addFrenzy(); return finishTurn('💨 Phép của quái đánh trượt.'); }
    if (activeClassBlessing(state, 'necromancer')) {
      state.classBlessing = null; addFrenzy();
      return finishTurn('💀 Totem Ward từ Class Shrine hấp thụ hoàn toàn đòn đánh.');
    }
    const raw = randomInt(attacker.damageMin, attacker.damageMax);
    const effectiveResistance = state.resistance + (activeClassBlessing(state, 'paladin') ? 10 : 0) - rift.cursedResistancePenalty + (defend && isV2(state) ? 15 : 0);
    let damage = magicAfterResistance(raw, effectiveResistance);
    damage = Math.max(1, Math.floor(damage * (1 + (state.damageTaken || 0))));
    if (defend) damage = Math.max(1, Math.floor(damage * (isV2(state) ? 0.85 : 0.6)));
    applyHpDelta(state, { amount: -damage, source: 'hostile' });
    const effects = afterHit(damage); addFrenzy();
    return finishTurn(`🔮 Bạn nhận **${damage} sát thương phép**${defend ? ' sau khi đỡ 40%' : ''}.${effects}`);
  }
  const hit = resolvePhysicalAttack(attacker, defender, state.floor, { statVersion: state.statVersion });
  if (!hit.hit) { addFrenzy(); return finishTurn('💨 Quái đánh trượt.'); }
  if (activeClassBlessing(state, 'necromancer')) {
    state.classBlessing = null; addFrenzy();
    return finishTurn('💀 Totem Ward từ Class Shrine hấp thụ hoàn toàn đòn đánh.');
  }
  let damage = Math.max(1, Math.floor(hit.damage * (1 + (state.damageTaken || 0))));
  if (defend) damage = Math.max(1, Math.floor(damage * (isV2(state) ? 0.85 : 0.6)));
  applyHpDelta(state, { amount: -damage, source: 'hostile' });
  const effects = afterHit(damage); addFrenzy();
  return finishTurn(`${hit.crit ? '💢 Critical! ' : ''}Bạn nhận **${damage} sát thương vật lý**${defend ? ' sau khi đỡ 40%' : ''}.${effects}`);
}

function playerAttack(state, action) {
  const enemy = state.encounter;
  if (action === 'defend') { state.energy = Math.min(state.maxEnergy, state.energy + 1); return { log: isV2(state)
    ? '🛡️ Thủ thế: Defense x2 với vật lý, +15 RES với phép, giảm thêm 15%, miễn chí mạng và hồi 1 Mana.'
    : '🛡️ Bạn thủ thế: Defense x2, chặn 40% sát thương còn lại, miễn chí mạng và hồi 1 năng lượng.', defend: true }; }
  if (action === 'potion') {
    if (state.potions <= 0) throw new Error('NO_POTION');
    if (state.hp >= state.maxHp) throw new Error('FULL_HP');
    const healRate = isV2(state) ? state.potionRate : clamp(0.35 + (state.potionPower || 0), 0.1, 0.75);
    const healed = Math.min(state.maxHp - state.hp, Math.max(20, Math.floor(state.maxHp * healRate)));
    state.potions -= 1; applyHpDelta(state, { amount: healed, source: 'healing' });
    return { log: `🧪 Hồi **${healed} HP**.`, defend: false };
  }
  let attack;
  let dodge = false;
  if (action === 'skill') {
    const freeSorceressSkill = activeClassBlessing(state, 'sorceress');
    if (state.energy < SKILL_MANA_COST && !freeSorceressSkill) throw new Error('NO_ENERGY');
    if (!freeSorceressSkill) state.energy -= SKILL_MANA_COST;
    else state.classBlessing = null;
    if (state.classKey === 'sorceress') {
      const raw = Math.floor(randomInt(state.spellMin || state.damageMin, state.spellMax || state.damageMax) * 2.1);
      attack = { hit: true, crit: false, damage: magicAfterResistance(raw, enemy.resistance) };
    } else if (state.classKey === 'amazon') {
      const shots = [
        resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 0.85 }),
        resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 0.85 }),
      ];
      if (activeClassBlessing(state, 'amazon') && randomFloat() < 0.2) shots.push(resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 0.85 }));
      const hits = shots.filter(shot => shot.hit);
      attack = { hit: hits.length > 0, crit: hits.some(shot => shot.crit), damage: hits.reduce((sum, shot) => sum + shot.damage, 0) };
    } else if (state.classKey === 'assassin') {
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.3 }); dodge = true;
    } else if (state.classKey === 'druid') {
      const healed = Math.min(state.maxHp - state.hp, Math.max(1, Math.floor(state.maxHp * 0.12)));
      applyHpDelta(state, { amount: healed, source: 'healing' });
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.35 });
      attack.extraLog = ` Hồi **${healed} HP**.`;
    } else if (state.classKey === 'necromancer') {
      const raw = Math.floor(randomInt(state.spellMin || state.damageMin, state.spellMax || state.damageMax) * 1.55);
      attack = { hit: true, crit: false, damage: magicAfterResistance(raw, enemy.resistance) };
      dodge = true;
      attack.extraLog = ' Totem đỡ đòn phản công.';
    } else if (state.classKey === 'paladin') {
      attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.4 });
      attack.defend = true;
    } else attack = resolvePhysicalAttack(state, enemy, state.floor, { multiplier: 1.65 });
  } else {
    const attacker = isV2(state) && state.activeParadox?.kind === 'reverse'
      ? { ...state, damageMin: Math.max(1, state.defense - 2), damageMax: Math.max(2, state.defense + 3) } : state;
    attack = resolvePhysicalAttack(attacker, enemy, state.floor, { statVersion: state.statVersion });
    state.energy = Math.min(state.maxEnergy, state.energy + basicAttackManaRestore(state));
  }
  const rankBonus = ['boss', 'final_boss'].includes(enemy.rank) ? (state.bossDamage || 0)
    : ['elite', 'ancient_mimic'].includes(enemy.rank) ? (state.eliteDamage || 0) : 0;
  if (attack.damage > 0 && rankBonus > 0) attack.damage = Math.max(1, Math.floor(attack.damage * (1 + rankBonus)));
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

function applyShrine(state, encounter) {
  const kind = typeof encounter === 'string' ? encounter : encounter.kind;
  if (kind === 'healing') { const heal = state.maxHp - state.hp; applyHpDelta(state, { amount: heal, source: 'healing' }); return `💚 Healing Shrine hồi ${heal} HP.`; }
  if (kind === 'armor') {
    if (isV2(state)) { const key = encounter.attributeRoll || 'vitality'; changeEventAttributes(state, { [key]: 5 }); return `🛡️ Armor Shrine: +5 ${key === 'strength' ? 'STR' : 'VIT'}.`; }
    state.defense += 3; return '🛡️ Armor Shrine: +3 Defense.';
  }
  if (kind === 'blood') {
    if (isV2(state)) { const oldHp = state.hp; changeEventAttributes(state, { strength: 8, vitality: -5 }); state.hp = Math.max(1, Math.min(state.hp, state.maxHp)); return `🩸 Blood Shrine: +8 STR, −5 VIT${oldHp > state.hp ? `, mất ${oldHp - state.hp} HP do Max HP giảm` : ''}.`; }
    state.hp = Math.max(1, state.hp - 15); state.damageMin += 4; state.damageMax += 4; return '🩸 Mất 15 HP, +4 sát thương.';
  }
  if (kind === 'experience') { state.bonus += Math.floor(state.stake * 0.25); return '✨ Payout tạm thời tăng thêm 25% tiền cược.'; }
  if (kind === 'corrupted') {
    if (isV2(state)) { changeEventAttributes(state, { strength: 12, vitality: -8 }); return '☣️ Corrupted Shrine: +12 STR, −8 VIT.'; }
    state.damageMin += 7; state.damageMax += 7; state.defense = Math.max(0, state.defense - 4); return '☣️ +7 sát thương, −4 Defense.';
  }
  const damage = Math.max(10, Math.floor(state.maxHp * 0.3)); applyHpDelta(state, { amount: -damage, source: 'hostile' }); return `🤡 Shrine giả gây ${damage} damage.`;
}

function applyWrongPortalPenalty(state, penalty) {
  if (penalty === 'energy_drain') {
    const lost = state.energy;
    state.energy = 0;
    return `🔷 Mana Void hút cạn **${lost} Energy**.`;
  }
  if (penalty === 'supply_loss') {
    const lost = Math.min(2, state.potions);
    state.potions -= lost;
    return `🧪 Túi đồ vỡ trong khe nứt: mất **${lost} bình máu**.`;
  }
  if (penalty === 'payout_corruption') {
    const lost = payoutLoss(state, 0.9);
    state.payoutFactor *= 0.9;
    return `💸 Rift Corruption lấy mất **${formatCoins(lost)} xu payout** của run.`;
  }
  if (penalty === 'dimensional_curse') {
    if (isV2(state)) {
      changeEventAttributes(state, { strength: -5, energy: -5 });
      return '☣️ Dimensional Curse: **−5 STR và −5 ENE**.';
    }
    const defenseLost = Math.min(5, state.defense);
    const resistanceBefore = state.resistance;
    state.defense -= defenseLost;
    state.resistance = Math.max(-50, state.resistance - 5);
    return `☣️ Dimensional Curse khiến bạn mất **${defenseLost} Defense** và **${resistanceBefore - state.resistance} Resistance**.`;
  }
  const damage = Math.min(Math.max(0, state.hp - 1), Math.max(1, Math.floor(state.maxHp * 0.15)));
  applyHpDelta(state, { amount: -damage, source: 'hostile' });
  return `🩸 Blood Rift xé cơ thể, gây **${damage} damage** nhưng không trực tiếp kết liễu bạn.`;
}

function applyWrongPortalBlessing(state, blessing) {
  if (blessing === 'treasure_vault') {
    const reward = Math.max(1, Math.floor(state.stake * 0.5));
    state.bonus += reward;
    return `💰 Treasure Vault cộng **${reward} xu** vào payout của run.`;
  }
  if (blessing === 'rift_blessing') {
    if (isV2(state)) {
      changeEventAttributes(state, { strength: 6, energy: 6 }); state.baseLuck = (state.baseLuck || 0) + 1; syncDerived(state);
      return '✨ Rift Blessing ban **+6 STR, +6 ENE và +1 Luck**.';
    }
    state.defense += 4;
    state.resistance = Math.min(75, state.resistance + 5);
    state.luck += 1;
    return '✨ Rift Blessing ban **+4 Defense, +5 Resistance và +1 Luck**.';
  }
  const oldMax = state.maxHp;
  state.maxHp += 10;
  applyHpDelta(state, { amount: oldMax - state.hp + 10, source: 'healing' });
  state.potions = Math.min(5, state.potions + 1);
  return '💚 Healing Sanctuary ban **+10 HP tối đa**, hồi đầy máu và tặng 1 bình máu.';
}

function rpsOutcome(player, enemy) {
  if (player === enemy) return 'tie';
  return (player === 'rock' && enemy === 'scissors') || (player === 'paper' && enemy === 'rock') || (player === 'scissors' && enemy === 'paper') ? 'win' : 'loss';
}

function damageAttributeForClass(classKey) {
  if (['barbarian', 'paladin', 'druid'].includes(classKey)) return 'strength';
  if (['amazon', 'assassin'].includes(classKey)) return 'dexterity';
  return 'energy';
}

function changeEventAttributes(state, changes) {
  state.eventAttributes ||= { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
  for (const [key, amount] of Object.entries(changes)) state.eventAttributes[key] = (state.eventAttributes[key] || 0) + amount;
  syncDerived(state);
}

function echoEnemy(state, grave, challenge = false) {
  const enemy = makeEnemy(state.floor, grave.isNemesis ? 'boss' : 'elite', grave.isNemesis ? `Server Nemesis: ${grave.name}` : `Grave Echo: ${grave.name}`, state);
  const multiplier = (1 + Math.min(1, (grave.level - 1) * 0.08)) * (challenge ? 1.25 : 1);
  enemy.maxHp = Math.floor(enemy.maxHp * multiplier); enemy.hp = enemy.maxHp;
  enemy.damageMin = Math.floor(enemy.damageMin * multiplier); enemy.damageMax = Math.floor(enemy.damageMax * multiplier);
  enemy.echoId = grave.echoId; enemy.echoSnapshot = grave.snapshot; enemy.echoKills = grave.kills; enemy.rewardMultiplier += grave.kills;
  const build = grave.snapshot?.build;
  if (build === 'dexterity') { enemy.evasion += 8; enemy.mechanicDescription = 'Bóng ma né cao và có thể phản công.'; }
  else if (build === 'vitality') { enemy.defense += 12; enemy.mechanicDescription = 'Bóng ma có lớp phòng thủ rất dày.'; }
  else if (build === 'strength') { enemy.critChance += 0.1; enemy.mechanicDescription = 'Bóng ma có thể gây Critical mạnh.'; }
  else if (build === 'energy') { enemy.damageType = 'magic'; enemy.magicChance = 1; enemy.mechanicDescription = 'Bóng ma dùng sát thương phép.'; }
  return enemy;
}

function applyAttributePenalty(state, rolls) {
  const lost = { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
  for (const rolledKey of rolls) {
    const totals = syncDerived(state).totalAttributes;
    const key = [rolledKey, 'strength', 'dexterity', 'vitality', 'energy'].find((candidate, index, all) => all.indexOf(candidate) === index && totals[candidate] > 1);
    if (key) { state.eventAttributes[key] = (state.eventAttributes[key] || 0) - 1; lost[key] += 1; }
  }
  syncDerived(state);
  return lost;
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
  if (state.phase === 'summit') return { settled: true, state, result: finishRun(session, state, 'summit') };
  if (action === 'retreat') return { settled: true, state, result: finishRun(session, state, state.cleared > 0 ? 'cashout' : 'forfeit') };
  if (state.contract && state.cleared >= state.contract.startCleared && state.cleared < state.contract.targetCleared) {
    if ((state.contract.kind === 'no_potion' && action === 'potion')
      || (state.contract.kind === 'no_skill' && action === 'skill')
      || (state.contract.kind === 'no_defend' && action === 'defend')) state.contract.failed = true;
  }
  rememberChoice(state, state.encounter, action);

  if (state.phase === 'paradox') {
    if (!['paradox_blood', 'paradox_reverse'].includes(action)) throw new Error('INVALID_ACTION');
    const milestone = state.encounter.milestone;
    state.paradoxMilestonesClaimed ||= [];
    if (state.paradoxMilestonesClaimed.includes(milestone)) throw new Error('STALE_ACTION');
    state.paradoxMilestonesClaimed.push(milestone);
    state.activeParadox = { kind: action === 'paradox_blood' ? 'blood_money' : 'reverse', startFloor: state.floor, untilFloor: state.floor + 4 };
    state.paradoxBloodBonus = 0;
    setNextEncounter(state, `${action === 'paradox_blood' ? '🩸 Máu là tiền' : '🔄 Ngược đời'} có hiệu lực từ tầng ${state.floor} đến ${state.floor + 4}.`);
  } else if (state.phase === 'severance') {
    if (!action.startsWith('sever_')) throw new Error('INVALID_ACTION');
    const index = Number(action.slice(7));
    const key = state.encounter.choices?.[index];
    if (!key || key === 'unstable_rift') throw new Error('INVALID_ACTION');
    const beforeCount = state.modifiers.length;
    state.modifiers = state.modifiers.filter(entry => entry !== key);
    state.severanceMilestonesClaimed ||= [];
    state.severanceMilestonesClaimed.push(state.encounter.milestone);
    setNextEncounter(state, `✂️ Đã xóa **${beforeCount - state.modifiers.length} stack ${MODIFIERS[key]?.name || key}**.`);
  } else if (state.phase === 'upgrade') {
    if (isV2(state)) {
      const attribute = ({ upgrade_attack: 'strength', upgrade_hp: 'vitality', upgrade_defense: 'dexterity', upgrade_luck: 'energy' })[action];
      if (!attribute) throw new Error('INVALID_ACTION');
      state.attributes[attribute] = (state.attributes[attribute] || 0) + 5;
      syncDerived(state);
      state.lastLog = `${{ strength: '💪 STR', dexterity: '🎯 DEX', vitality: '❤️ VIT', energy: '🔮 ENE' }[attribute]} +5.`;
    } else if (action === 'upgrade_attack') { state.damageMin += 5; state.damageMax += 5; state.lastLog = '⚔️ +5 sát thương.'; }
    else if (action === 'upgrade_hp') { state.maxHp += 30; state.hp = Math.min(state.maxHp, state.hp + 30); state.lastLog = '❤️ +30 HP tối đa và hiện tại.'; }
    else if (action === 'upgrade_defense') { state.defense += 6; state.lastLog = '🛡️ +6 Defense.'; }
    else if (action === 'upgrade_luck') { state.luck += 2; state.lastLog = '🍀 +2 Luck.'; }
    else throw new Error('INVALID_ACTION');
    openPostFloorPhase(state, state.encounter.milestone, `${state.lastLog}\nBạn tiến vào tầng ${state.floor}.`);
  } else if (state.encounter.type === 'combat') {
    if (!['attack', 'defend', 'skill', 'potion'].includes(action)) throw new Error('INVALID_ACTION');
    const acted = playerAttack(state, action);
    let log = acted.log;
    if (state.encounter.hp <= 0) {
      const enemy = state.encounter;
      if (enemy.echoId) {
        const grave = { ...state.encounter, snapshot: enemy.echoSnapshot };
        const reward = !state.echoLootTaken && grave.snapshot?.items?.length ? grave.snapshot.items[Math.min(grave.snapshot.items.length - 1, state.echoRewardIndex || 0)] : null;
        if (reward) applyItem(state, reward, reward.rarity);
        state.bonus += Math.floor(state.stake * (0.2 + Math.min(1, (enemy.echoKills || 0) * 0.1)));
        hardcoreRepository.deleteEcho(enemy.echoId);
        state.activeEchoId = null; state.activeEchoSnapshot = null; state.echoLootTaken = false;
        log += `\n👻 Grave Echo đã bị xóa khỏi server${reward ? `; bạn nhận ${reward.name}` : ''}.`;
      }
      completeFloor(state, `${log}\n🏆 Đã hạ **${enemy.name}**.`, enemy.rewardMultiplier);
    } else {
      log += `\n${enemyTurn(state, acted.defend, acted.dodge)}`;
      state.lastLog = log;
      if (state.hp <= 0) return { settled: true, state, result: finishRun(session, state, 'death') };
    }
  } else if (state.encounter.type === 'karma') {
    if (action !== 'karma_resolve') throw new Error('INVALID_ACTION');
    const debt = (state.karmaLedger || []).find(entry => entry.id === state.encounter.karmaId && !entry.resolved);
    if (!debt) throw new Error('STALE_ACTION');
    debt.resolved = true;
    if (debt.outcome === 'good') {
      const healed = Math.min(state.maxHp - state.hp, Math.max(1, Math.floor(state.maxHp * (0.1 + debt.payloadRoll / 1000))));
      applyHpDelta(state, { amount: healed, source: 'healing' });
      const reward = Math.max(1, Math.floor(state.stake * (0.1 + debt.payloadRoll / 500)));
      state.bonus += reward; completeFloor(state, `🕯️ The Tower Remembers: lựa chọn **${debt.action}** quay lại giúp bạn hồi ${healed} HP và +${reward} payout.`, 0);
    } else if (debt.payloadRoll <= 50) {
      const lost = payoutLoss(state, 0.9); state.payoutFactor *= 0.9;
      completeFloor(state, `🕯️ Món nợ cũ từ **${debt.action}** lấy ${lost} payout.`, 0);
    } else {
      state.encounter = makeEnemy(state.floor, 'elite', 'Bounty Hunter of the Tower', state);
      state.lastLog = `🕯️ Lựa chọn **${debt.action}** đã trở lại dưới hình dạng Bounty Hunter.`;
    }
    state.karmaLedger = state.karmaLedger.filter(entry => !entry.resolved);
  } else if (state.encounter.type === 'grave_echo') {
    const grave = state.encounter;
    const reward = grave.rewardIndex >= 0 ? grave.snapshot?.items?.[grave.rewardIndex] : null;
    if (action === 'grave_pray') {
      const healed = Math.max(1, Math.floor(state.maxHp * 0.15)); applyHpDelta(state, { amount: healed, source: 'healing' });
      hardcoreRepository.releaseEcho(grave.echoId, session.id); completeFloor(state, `🙏 Cầu nguyện bên mộ hồi **${healed} HP**.`, 0);
    } else if (action === 'grave_leave') {
      hardcoreRepository.releaseEcho(grave.echoId, session.id); completeFloor(state, '🚶 Bạn để ngôi mộ yên nghỉ.', 0);
    } else if (action === 'grave_rob') {
      if (reward) applyItem(state, reward, reward.rarity);
      if (grave.robWakes) {
        state.echoRewardIndex = grave.rewardIndex; state.echoLootTaken = Boolean(reward); state.activeEchoId = grave.echoId; state.activeEchoSnapshot = grave.snapshot;
        state.encounter = echoEnemy(state, grave, false); state.lastLog = `🪦 Bạn lấy ${reward?.name || 'thứ còn sót lại'} và đánh thức Grave Echo!`;
      } else {
        hardcoreRepository.deleteEcho(grave.echoId); completeFloor(state, `🪦 Cướp mộ thành công${reward ? `: nhận **${reward.name}**` : ''}.`, 1);
      }
    } else if (action === 'grave_challenge') {
      state.echoRewardIndex = grave.rewardIndex; state.echoLootTaken = false; state.activeEchoId = grave.echoId; state.activeEchoSnapshot = grave.snapshot;
      state.encounter = echoEnemy(state, grave, true); state.lastLog = '⚔️ Bạn chủ động gọi Grave Echo; nó mạnh hơn 25%.';
    } else throw new Error('INVALID_ACTION');
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
      const log = applyShrine(state, state.encounter);
      if (state.hp <= 0) return { settled: true, state, result: finishRun(session, state, 'death') };
      completeFloor(state, log, 0.5);
    } else throw new Error('INVALID_ACTION');
  } else if (state.encounter.type === 'empty') {
    if (action !== 'continue') throw new Error('INVALID_ACTION');
    completeFloor(state, '🕳️ Căn phòng không có gì. Đúng nghĩa không có gì.', 0);
  } else if (state.encounter.type === 'trap') {
    if (action !== 'continue') throw new Error('INVALID_ACTION');
    const kind = state.encounter.kind;
    if (state.encounter.luckyBreak && kind !== 'wrong_portal') {
      const avoided = kind === 'tax_collector' ? 'Tax Collector' : 'kẻ trộm bình máu';
      completeFloor(state, `🍀 Lucky Break! Bạn tránh được **${avoided}** mà không chịu tổn thất.`, 0);
    } else if (kind === 'tax_collector') {
      const lost = payoutLoss(state, 0.85);
      state.payoutFactor *= 0.85;
      completeFloor(state, `🧾 Tax Collector thu **${formatCoins(lost)} xu payout** vì lý do: “quy định là quy định”.`, 0);
    } else if (kind === 'potion_thief') {
      const stolen = state.potions > 0 ? 1 : 0;
      state.potions = Math.max(0, state.potions - stolen);
      completeFloor(state, stolen ? '🦹 Kẻ trộm lấy mất 1 bình máu rồi biến mất.' : '🦹 Kẻ trộm kiểm tra túi đồ rỗng và tỏ vẻ thất vọng.', 0);
    } else {
      if (state.encounter.portalOutcome === 'good') {
        const blessingLog = applyWrongPortalBlessing(state, state.encounter.blessing);
        completeFloor(state, `🌀 Wrong Portal bất ngờ dẫn tới một khu vực an toàn.\n${blessingLog}`, 0);
        state.lastStatChanges = statChanges(state, before);
        saveState(session, state);
        return { settled: false, state, result: null };
      }
      const penaltyLog = applyWrongPortalPenalty(state, state.encounter.penalty || 'blood_loss');
      state.encounter = makeEnemy(state.floor, 'elite', 'Rift Ambusher', state);
      const ambush = enemyTurn(state);
      state.lastLog = `🌀 Wrong Portal ném bạn vào ổ phục kích của **Rift Ambusher**.\n${penaltyLog}\nElite được ra đòn trước! ${ambush}`;
      if (state.hp <= 0) return { settled: true, state, result: finishRun(session, state, 'death') };
    }
  } else if (state.encounter.type === 'surprise') {
    const event = state.encounter;
    if (action === 'event_skip') {
      completeFloor(state, '🚶 Bạn bỏ qua sự kiện bất ngờ và tiếp tục.', 0);
    } else if (event.kind === 'rift_duelist' && event.stage === 'choose') {
      if (!['duelist_stat', 'duelist_gear'].includes(action)) throw new Error('INVALID_ACTION');
      event.mode = action === 'duelist_stat' ? 'stat' : 'gear'; event.stage = 'playing';
      state.lastLog = event.mode === 'stat' ? '🎭 Thắng một ván để nhận +6 thuộc tính; thua hoặc hòa bị trừ 6 điểm đã khóa trước.'
        : '🎭 Thắng 3 trong tối đa 5 ván để nhận SSR/UR. Luck không hé lộ tay đối thủ.';
    } else if (event.kind === 'rift_duelist' && event.stage === 'playing' && action.startsWith('rps_')) {
      const hand = action.slice(4);
      if (!['rock', 'paper', 'scissors'].includes(hand) || event.round >= event.hands.length) throw new Error('INVALID_ACTION');
      const enemyHand = event.hands[event.round]; const outcome = rpsOutcome(hand, enemyHand);
      event.round += 1; if (outcome === 'win') event.wins += 1;
      if (event.mode === 'stat') {
        if (outcome === 'win') {
          const key = { rock: 'strength', scissors: 'dexterity', paper: 'energy' }[hand];
          changeEventAttributes(state, { [key]: 6 });
          completeFloor(state, `🎭 ${hand} thắng ${enemyHand}: **+6 ${key.toUpperCase()}**.`, 0);
        } else {
          const lost = applyAttributePenalty(state, event.penalty);
          completeFloor(state, `🎭 ${hand} ${outcome === 'tie' ? 'hòa' : 'thua'} ${enemyHand}: mất **${Object.values(lost).reduce((a, b) => a + b, 0)} điểm thuộc tính**.`, 0);
        }
      } else if (event.wins >= 3) {
        const equipment = applyItem(state, event.rewardItem, event.rewardRarity);
        completeFloor(state, `🎭 Thắng 3 ván: nhận **${equipment.name} Lv.${equipment.level}** (${rarityLabel(event.rewardRarity)}).`, 0);
      } else if (event.round >= 5 || event.wins + (5 - event.round) < 3) {
        const eligible = normalizeEquipment(state.items).filter(item => ['common', 'rare', 'legendary'].includes(item.rarity));
        const victim = eligible.find(item => item.name === event.penaltyItemName);
        if (victim) {
          state.items = normalizeEquipment(state.items).filter(item => item.name !== victim.name); syncDerived(state);
          completeFloor(state, `🎭 Thất bại: mất toàn bộ **${victim.name}**. UR được miễn.`, 0);
        } else completeFloor(state, '🎭 Thất bại nhưng không có trang bị R/SR/SSR để mất.', 0);
      } else state.lastLog = `🎭 Ván ${event.round}: bạn ${outcome === 'win' ? 'thắng' : outcome === 'tie' ? 'hòa' : 'thua'} (${hand} vs ${enemyHand}). Cần ${3 - event.wins} trận thắng nữa.`;
    } else if (event.kind.endsWith('_item_shop') && action.startsWith('shop_buy_')) {
      const index = Number(action.slice(9)); const offer = event.offers?.[index];
      if (!offer || event.purchased) throw new Error('INVALID_ACTION');
      if (event.currency === 'payout') spendPayout(state, offer.cost);
      else if (event.currency === 'hp') {
        if (state.hp <= offer.cost) throw new Error('NOT_ENOUGH_HP');
        applyHpDelta(state, { amount: -offer.cost, source: 'voluntary_cost' });
      } else spendDiamonds(session.guild_id, session.user_id, offer.cost, { reason: 'hardcore:diamond-shop', operationId: `hardcore-shop:${session.id}:${state.turn}:${index}` });
      event.purchased = true;
      const equipment = applyItem(state, offer.item, offer.rarity);
      completeFloor(state, `🛒 Đã mua **${equipment.name} Lv.${equipment.level}** bằng ${event.currency === 'payout' ? `${formatCoins(offer.cost)} payout` : event.currency === 'hp' ? `${offer.cost} HP` : `${offer.cost} kim cương`}.`, 0);
    } else if (event.kind === 'blacksmith' && action === 'forge') {
      const item = forgeItem(state, event.itemName, event.cost);
      completeFloor(state, `🔨 Thợ rèn lấy **${event.cost} xu payout** và nâng **${item.name}** lên **Lv.${item.level}**.`, 0);
    } else if (event.kind === 'purifier' && action === 'purify') {
      const item = purifyItem(state, event.itemName, event.cost);
      completeFloor(state, `✨ Tu sĩ lấy **${event.cost} xu payout** và giải lời nguyền cho **${item.name}**. Hiệu ứng phạt đã được gỡ.`, 0);
    } else if (event.kind === 'wandering_healer' && action === 'event_accept') {
      const healed = Math.min(state.maxHp - state.hp, event.heal);
      applyHpDelta(state, { amount: healed, source: 'healing' });
      state.potions = Math.min(5, state.potions + 1);
      completeFloor(state, `🧙 Người chữa trị hồi **${healed} HP** và tặng 1 bình máu.`, 0);
    } else if (event.kind === 'treasure_goblin' && action === 'event_accept') {
      if (event.success) {
        state.bonus += event.reward;
        completeFloor(state, `🪙 Bạn bắt được Treasure Goblin và cộng **${event.reward} xu** vào payout.`, 0);
      } else {
        const lost = payoutLoss(state, 1 - event.penaltyRate);
        state.payoutFactor *= 1 - event.penaltyRate;
        completeFloor(state, `💨 Treasure Goblin trốn mất, còn cuỗm theo **${formatCoins(lost)} xu payout**.`, 0);
      }
    } else if (event.kind === 'altar_of_sacrifice' && action === 'altar_hp') {
      const lost = Math.min(Math.max(0, state.hp - 1), event.hpCost);
      state.hp -= lost;
      if (isV2(state)) { const key = damageAttributeForClass(state.classKey); changeEventAttributes(state, { [key]: 6 }); completeFloor(state, `🩸 Hiến **${lost} HP** và nhận **+6 ${key.toUpperCase()}**.`, 0); }
      else { state.damageMin += 3; state.damageMax += 3; completeFloor(state, `🩸 Hiến **${lost} HP** cho Altar và nhận **+3 sát thương**.`, 0); }
    } else if (event.kind === 'altar_of_sacrifice' && action === 'altar_payout') {
      spendPayout(state, event.payoutCost);
      if (isV2(state)) { changeEventAttributes(state, { vitality: 6 }); completeFloor(state, `🗿 Hiến **${formatCoins(event.payoutCost)} payout** và nhận **+6 VIT**.`, 0); }
      else { state.defense += 3; completeFloor(state, `🗿 Hiến **${formatCoins(event.payoutCost)} xu payout** và nhận **+3 Defense**.`, 0); }
    } else if (event.kind === 'cursed_gambler' && ['gamble_10', 'gamble_25'].includes(action)) {
      const cost = action === 'gamble_25' ? event.cost25 : event.cost10;
      spendPayout(state, cost);
      if (event.win) state.bonus += cost * 2;
      completeFloor(state, event.win ? `🎲 Thắng cược: đặt ${formatCoins(cost)} và nhận lại **${formatCoins(cost * 2)} xu payout**.`
        : `🎲 Thua cược và mất **${formatCoins(cost)} xu payout**.`, 0);
    } else if (event.kind === 'lost_adventurer' && action === 'adventurer_rescue') {
      if (state.potions <= 0) throw new Error('NO_POTION');
      state.potions -= 1;
      const equipment = applyItem(state, event.rescueItem, event.rescueRarity);
      completeFloor(state, `🧭 Bạn dùng 1 bình cứu nhà thám hiểm và nhận **${event.rescueItem.name} Lv.${equipment.level}**.`, 0);
    } else if (event.kind === 'lost_adventurer' && action === 'adventurer_rob') {
      const equipment = applyItem(state, event.robbedItem, event.robbedRarity);
      completeFloor(state, `🗡️ Bạn lấy **${event.robbedItem.name} Lv.${equipment.level}** (${rarityLabel(event.robbedRarity)}).`, 0);
    } else if (event.kind === 'blood_fountain' && action === 'blood_drink') {
      if (event.outcome === 'heal') {
        const healed = state.maxHp - state.hp; applyHpDelta(state, { amount: healed, source: 'healing' });
        completeFloor(state, `🩸 Blood Fountain hồi đầy **${healed} HP**.`, 0);
      } else if (event.outcome === 'max_hp') {
        state.maxHp += 15; state.hp = Math.min(state.maxHp, state.hp + 15);
        completeFloor(state, '🩸 Máu cổ đại ban **+15 HP tối đa và hiện tại**.', 0);
      } else {
        state.encounter = makeEnemy(state.floor, 'mimic', 'Blood Mimic', state);
        state.lastLog = '🩸 Đài phun máu biến thành **Blood Mimic**!';
      }
    } else if (event.kind === 'horadric_forge' && action.startsWith('salvage_')) {
      const reward = action.slice('salvage_'.length);
      const consumed = consumeEquipmentLevel(state, event.itemName);
      if (isV2(state) && reward === 'attack') changeEventAttributes(state, { [damageAttributeForClass(state.classKey)]: 6 });
      else if (isV2(state) && reward === 'defense') changeEventAttributes(state, { [event.attributeRoll || 'vitality']: 7 });
      else if (isV2(state) && reward === 'hp') changeEventAttributes(state, { vitality: 4 });
      else if (reward === 'attack') { state.damageMin += 3; state.damageMax += 3; }
      else if (reward === 'defense') state.defense += 4;
      else if (reward === 'hp') { state.maxHp += 10; state.hp = Math.min(state.maxHp, state.hp + 10); }
      else if (reward === 'token' && ['legendary', 'cursed'].includes(event.itemRarity)) state.escapeTokens += 1;
      else throw new Error('INVALID_ACTION');
      const rewardText = isV2(state) ? { attack: '+6 thuộc tính damage chính', defense: `+7 ${(event.attributeRoll || 'vitality').toUpperCase()}`, hp: '+4 VIT', token: '+1 Vé Thoát Hiểm' }[reward]
        : { attack: '+3 sát thương', defense: '+4 Defense', hp: '+10 HP', token: '+1 Vé Thoát Hiểm' }[reward];
      completeFloor(state, `⚒️ Nghiền 1 cấp **${consumed.name}** và nhận **${rewardText}**. Hiệu ứng đã hấp thụ trước đó được giữ lại.`, 0);
    } else if (event.kind === 'rift_merchant' && action.startsWith('merchant_')) {
      const index = Number(action.slice('merchant_'.length)); const offer = event.offers[index];
      if (!offer) throw new Error('INVALID_ACTION');
      spendPayout(state, offer.cost);
      if (offer.type === 'potion') state.potions = Math.min(5, state.potions + 1);
      else if (offer.type === 'heal') applyHpDelta(state, { amount: state.maxHp - state.hp, source: 'healing' });
      else if (offer.type === 'luck') { if (isV2(state)) { state.baseLuck += 1; syncDerived(state); } else state.luck += 1; }
      else if (offer.type === 'escape_token') state.escapeTokens += 1;
      else if (offer.type === 'rare_item') applyItem(state, offer.item, 'rare');
      completeFloor(state, `🛒 Mua **${offer.name}** với giá **${formatCoins(offer.cost)} xu payout**.`, 0);
    } else if (event.kind === 'mirror_of_fate' && action === 'mirror_attack') {
      if (isV2(state)) {
        const key = damageAttributeForClass(state.classKey); changeEventAttributes(state, { [key]: 10 });
        completeFloor(state, `🪞 Bản thể sức mạnh: **+10 ${key.toUpperCase()}**.`, 0);
      } else {
      const gain = Math.max(1, Math.floor((state.damageMin + state.damageMax) / 2 * 0.1));
      const hpLost = Math.min(state.maxHp - 20, Math.max(1, Math.floor(state.maxHp * 0.1)));
      state.damageMin += gain; state.damageMax += gain; state.maxHp -= hpLost; state.hp = Math.min(state.hp, state.maxHp);
      completeFloor(state, `🪞 Bản thể sức mạnh: **+${gain} sát thương**, **−${hpLost} HP tối đa**.`, 0);
      }
    } else if (event.kind === 'mirror_of_fate' && action === 'mirror_defense') {
      if (isV2(state)) { const secondary = ['amazon', 'assassin'].includes(state.classKey) ? 'dexterity' : 'strength'; changeEventAttributes(state, { vitality: 8, [secondary]: 5 }); completeFloor(state, `🪞 Bản thể phòng thủ: **+8 VIT, +5 ${secondary.toUpperCase()}**.`, 0); }
      else { state.defense += 8; state.damageMin = Math.max(1, state.damageMin - 2); state.damageMax = Math.max(state.damageMin + 1, state.damageMax - 2); completeFloor(state, '🪞 Bản thể phòng thủ: **+8 Defense**, **−2 sát thương**.', 0); }
    } else if (event.kind === 'mirror_of_fate' && action === 'mirror_smash') {
      if (event.smashSuccess) { state.luck += 2; completeFloor(state, '🍀 Gương vỡ và giải phóng **+2 Luck**.', 0); }
      else {
        const clone = makeEnemy(state.floor, 'elite', 'Mirror Clone', state);
        clone.maxHp = clone.hp = Math.max(20, state.maxHp); clone.damageMin = Math.max(2, state.damageMin); clone.damageMax = Math.max(clone.damageMin + 1, state.damageMax);
        clone.defense = state.defense; clone.resistance = state.resistance; state.encounter = clone;
        state.lastLog = '🪞 Một **Mirror Clone** mang chỉ số của bạn bước ra khỏi gương!';
      }
    } else if (event.kind === 'treasure_room' && action === 'treasure_inspect') {
      if (event.inspected) throw new Error('ALREADY_INSPECTED');
      event.inspected = true; event.revealedColor = event.inspectColor;
      state.lastLog = event.inspectColor === event.mimicColor ? `👁️ Hòm ${event.inspectColor} là Mimic.` : `👁️ Hòm ${event.inspectColor} an toàn.`;
    } else if (event.kind === 'treasure_room' && action.startsWith('treasure_')) {
      const color = action.slice('treasure_'.length);
      if (!['red', 'blue', 'gold'].includes(color)) throw new Error('INVALID_ACTION');
      if (color === event.mimicColor) {
        state.encounter = makeEnemy(state.floor, 'mimic', 'Treasure Mimic', state); state.lastLog = '😈 Bạn chọn trúng **Treasure Mimic**!';
      } else if (color === 'red') {
        state.damageMin += 5; state.damageMax += 5; completeFloor(state, '🔴 Hòm đỏ ban **+5 sát thương**.', 0);
      } else if (color === 'blue') {
        state.defense += 6; state.resistance = Math.min(75, state.resistance + 5); completeFloor(state, '🔵 Hòm xanh ban **+6 Defense, +5 Resistance**.', 0);
      } else {
        const reward = Math.max(1, Math.floor(state.stake * 0.5)); state.bonus += reward; state.luck += 1;
        completeFloor(state, `🟡 Hòm vàng ban **${reward} xu payout và +1 Luck**.`, 0);
      }
    } else if (event.kind === 'rift_contract' && action === 'contract_accept') {
      state.contract = { kind: event.contractKind, startCleared: state.cleared + 1, targetCleared: state.cleared + 4, failed: false };
      completeFloor(state, '📜 Đã ký Rift Contract. Thử thách áp dụng trong **3 tầng tiếp theo**.', 0);
    } else if (event.kind === 'class_shrine' && action === 'class_blessing') {
      state.classBlessing = { classKey: state.classKey, startCleared: state.cleared + 1, targetCleared: state.cleared + 4 };
      completeFloor(state, `⛩️ Class Shrine cường hóa **${CLASSES[state.classKey].name}** trong 3 tầng tiếp theo.`, 0);
    } else if (event.kind === 'strange_doors' && action.startsWith('door_')) {
      const door = action.slice('door_'.length);
      if (door === 'light') {
        if (event.lightGood) { applyHpDelta(state, { amount: state.maxHp - state.hp, source: 'healing' }); state.potions = Math.min(5, state.potions + 1); completeFloor(state, '🚪 Cửa sáng hồi đầy HP và tặng 1 bình máu.', 0); }
        else { const damage = Math.min(state.hp - 1, Math.max(1, Math.floor(state.maxHp * 0.2))); applyHpDelta(state, { amount: -damage, source: 'hostile' }); completeFloor(state, `🚪 Ánh sáng giả gây **${damage} damage**.`, 0); }
      } else if (door === 'gold') {
        if (event.goldGood) { state.bonus += event.goldReward; completeFloor(state, `🚪 Cửa vàng cộng **${event.goldReward} xu payout**.`, 0); }
        else { state.encounter = makeEnemy(state.floor, 'mimic', 'Golden Door Mimic', state); state.lastLog = '🚪 Cửa vàng mọc răng và hóa thành Mimic!'; }
      } else if (door === 'dark') {
        if (event.darkGood) { const equipment = applyItem(state, event.darkItem, 'legendary'); completeFloor(state, `🚪 Bóng tối trao **${event.darkItem.name} Lv.${equipment.level}** (SSR).`, 1); }
        else { state.encounter = makeEnemy(state.floor, 'boss', 'Premature Rift Boss', state); state.lastLog = '🚪 Cửa đen gọi ra **Premature Rift Boss**!'; }
      } else throw new Error('INVALID_ACTION');
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
      const lost = payoutLoss(state, 0.6);
      state.payoutFactor *= 0.6; completeFloor(state, `💸 RNGesus nhận **${formatCoins(lost)} xu payout** và cho bạn đi.`, 0);
    } else if (action === 'pray') {
      if (!event.prayerSuccess) return { settled: true, state, result: finishRun(session, state, 'rngesus') };
      const rarity = event.prayerRarity === 'cursed' ? 'cursed' : 'legendary';
      const item = pick(ITEMS[rarity]);
      const equipment = applyItem(state, item, rarity); updatePity(state, rarity);
      completeFloor(state, `🙏 RNGesus cười và trao **${item.name} Lv.${equipment.level}** (${rarityLabel(rarity)}).`, 2);
    } else if (action === 'escape_token') {
      if (state.escapeTokens <= 0) throw new Error('NO_TOKEN');
      state.escapeTokens -= 1; completeFloor(state, '🪞 Vé Thoát Hiểm vỡ vụn và đưa bạn tới tầng tiếp theo.', 0);
    } else throw new Error('INVALID_ACTION');
  } else throw new Error('INVALID_ACTION');

  if (state.karmaNoticePending) {
    state.lastLog = `${state.lastLog || ''}\n🕯️ The Tower will remember this.`;
    state.karmaNoticePending = false;
  }
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
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferUpdate();
    } catch (error) {
      logger?.warn({ err: error, code: error?.code, sessionId, interactionId: interaction.id,
        acknowledgementDelayMs: Date.now() - (interaction.createdTimestamp || Date.now()) }, 'could not acknowledge hardcore interaction');
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: 'Nút đã hết thời gian phản hồi. Hãy bấm lại trên bảng Sinh tồn mới nhất.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return null;
    }
  }
  return queueHardcoreInteraction(sessionId, async () => {
  try {
    const session = getSession(sessionId);
    if (!session || session.guild_id !== interaction.guildId || session.channel_id !== interaction.channelId) {
      return interaction.followUp({ content: 'Lượt Sinh tồn đã kết thúc hoặc nút không còn hợp lệ.', flags: MessageFlags.Ephemeral });
    }
    if (session.message_id && session.message_id !== interaction.message?.id) {
      return interaction.followUp({ content: 'Đây là bảng Sinh tồn cũ. Dùng `/choi sinhton tieptuc` để mở lại bảng mới nhất.', flags: MessageFlags.Ephemeral });
    }
    if (session.user_id !== interaction.user.id) {
      return interaction.followUp({ content: 'Đây là lượt Sinh tồn của người chơi khác.', flags: MessageFlags.Ephemeral });
    }
    if (action === 'items') {
      const state = parseState(session);
      return interaction.followUp({ embeds: [hardcoreView.equipmentEmbed(state, ITEMS, 0)], components: hardcoreView.equipmentRows(session.id, state, 0), flags: MessageFlags.Ephemeral });
    }
    if (action === 'stats' || action === 'enemy_info' || action === 'rift_info') {
      const state = parseState(session);
      const embed = action === 'stats' ? hardcoreView.statsDetailEmbed(state)
        : action === 'rift_info' ? hardcoreView.riftDetailEmbed(state) : hardcoreView.enemyDetailEmbed(state);
      return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
                  : error.message === 'NOT_ENOUGH_HP' ? 'HP hiện tại phải lớn hơn giá món đồ; cửa hàng không cho phép tự sát.'
                    : error.message === 'INSUFFICIENT_DIAMONDS' ? 'Bạn không đủ kim cương để mua món này.'
                  : error.message === 'ITEM_NOT_FOUND' ? 'Item của sự kiện không còn hợp lệ.' : 'Không thể thực hiện lựa chọn này.';
    if (!['NO_ENERGY', 'NO_POTION', 'FULL_HP', 'ALREADY_INSPECTED', 'NO_TOKEN', 'NOT_ENOUGH_PAYOUT', 'NOT_ENOUGH_HP', 'INSUFFICIENT_DIAMONDS', 'ITEM_NOT_FOUND', 'INVALID_ACTION', 'INVALID_SESSION'].includes(error.message)) {
      logger?.error({ err: error, code: error?.code, sessionId, action, interactionId: interaction.id }, 'hardcore interaction failed after acknowledgement');
    }
    return interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(responseError => {
      logger?.warn({ err: responseError, code: responseError?.code, sessionId, interactionId: interaction.id }, 'could not send hardcore interaction error');
      return null;
    });
  }
  });
}

async function handleHardcoreItemsButton(interaction, logger) {
  const [, sessionId, rawPage] = interaction.customId.split(':');
  if (!interaction.deferred && !interaction.replied) {
    try { await interaction.deferUpdate(); }
    catch (error) {
      logger?.warn({ err: error, code: error?.code, sessionId, interactionId: interaction.id }, 'could not acknowledge hardcore equipment page');
      return null;
    }
  }
  try {
    const session = getSession(sessionId);
    if (!session || session.guild_id !== interaction.guildId) {
      return interaction.followUp({ content: 'Run Sinh tồn này đã kết thúc.', flags: MessageFlags.Ephemeral });
    }
    if (session.user_id !== interaction.user.id) {
      return interaction.followUp({ content: 'Bạn không thể xem trang bị trong run của người khác.', flags: MessageFlags.Ephemeral });
    }
    const state = parseState(session);
    const page = Math.max(0, Number(rawPage) || 0);
    return interaction.editReply({ embeds: [hardcoreView.equipmentEmbed(state, ITEMS, page)], components: hardcoreView.equipmentRows(session.id, state, page) });
  } catch (error) {
    logger?.error({ err: error, code: error?.code, sessionId, interactionId: interaction.id }, 'hardcore equipment page failed');
    return interaction.followUp({ content: 'Không thể tải danh sách trang bị lúc này.', flags: MessageFlags.Ephemeral }).catch(() => null);
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
  hitChance, defenseReduction, physicalAfterDefense, magicAfterResistance, resolvePhysicalAttack, riftModifierEffects,
  enemyScale, makeEnemy, rollEnemyAttackType, addRiftModifier, rngesusChance, rollRngesus, chaosLabel, baseMultiplier, potentialPayout, payoutLoss, generateEncounter,
  applyItem, forgeItem, purifyItem, makeSurpriseEvent, luckyBreakChance, portalGoodChance, treasureGoblinChance,
  startHardcore, resumeHardcore, playHardcore, getHardcoreByUser, setMessageId, hardcoreEmbed, hardcoreRows, forceEndHardcoreSession,
  handleHardcoreButton, handleHardcoreItemsButton, getHardcoreRecord, getHardcoreTop, cleanupStaleHardcoreSessions,
};



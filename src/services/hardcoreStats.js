'use strict';

const STAT_VERSION = 2;
const ITEM_CATALOG_VERSION = 2;
const ATTRIBUTES = Object.freeze(['strength', 'dexterity', 'vitality', 'energy']);

const CLASS_V2 = Object.freeze({
  amazon: Object.freeze({ attributes: { strength: 18, dexterity: 28, vitality: 20, energy: 14 }, baseHp: 40, baseMana: 2, baseResistance: 3, baseCrit: 0.06, weapon: [0.25, 0.75] }),
  barbarian: Object.freeze({ attributes: { strength: 30, dexterity: 14, vitality: 28, energy: 8 }, baseHp: 46, baseMana: 2, baseResistance: 2, baseCrit: 0.05, weapon: [1, 0] }),
  assassin: Object.freeze({ attributes: { strength: 18, dexterity: 30, vitality: 18, energy: 14 }, baseHp: 38, baseMana: 2, baseResistance: 3, baseCrit: 0.08, weapon: [0.3, 0.7] }),
  sorceress: Object.freeze({ attributes: { strength: 10, dexterity: 16, vitality: 20, energy: 34 }, baseHp: 34, baseMana: 2, baseResistance: 8, baseCrit: 0.04, weapon: [0.7, 0.3] }),
  druid: Object.freeze({ attributes: { strength: 20, dexterity: 16, vitality: 20, energy: 24 }, baseHp: 42, baseMana: 2, baseResistance: 6, baseCrit: 0.05, weapon: [0.8, 0.2] }),
  necromancer: Object.freeze({ attributes: { strength: 12, dexterity: 16, vitality: 22, energy: 30 }, baseHp: 36, baseMana: 2, baseResistance: 7, baseCrit: 0.04, weapon: [0.7, 0.3] }),
  paladin: Object.freeze({ attributes: { strength: 26, dexterity: 14, vitality: 24, energy: 16 }, baseHp: 43, baseMana: 2, baseResistance: 10, baseCrit: 0.05, weapon: [0.9, 0.1] }),
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function emptyBonuses() {
  return { strength: 0, dexterity: 0, vitality: 0, energy: 0, flatHp: 0, flatPhysical: 0, flatSpell: 0,
    flatDefense: 0, flatAccuracy: 0, flatEvasion: 0, flatCrit: 0, flatResistance: 0, flatMana: 0,
    potionPower: 0, luck: 0, bossDamage: 0, eliteDamage: 0, mimicDetection: 0, goblinChance: 0,
    legendaryFind: 0, floorHpLoss: 0, mimicChance: 0, damageTaken: 0, defenseOverride: null };
}

// Catalog v1 vẫn được đọc, nhưng được quy đổi sang bốn thuộc tính cho run v2.
// Việc quy đổi theo vai trò của item giữ đủ 100 item mà không phụ thuộc database Median XL.
function v2ItemBonuses(item) {
  if (item?.attributes) return { ...emptyBonuses(), ...item.attributes };
  const effects = item?.effects || item || {};
  const tags = new Set(item?.tags || []);
  const result = emptyBonuses();
  const attack = number(effects.attack);
  if (attack) {
    if (tags.has('magic') || tags.has('energy')) result.energy += Math.round(attack * 1.5);
    else if (tags.has('accuracy') || tags.has('crit') || tags.has('evasion')) result.dexterity += Math.round(attack * 1.5);
    else result.strength += Math.round(attack * 1.5);
  }
  result.strength += Math.round(number(effects.defense) * 0.7);
  result.vitality += Math.round(number(effects.maxHp) / 4 + number(effects.defense) * 0.5);
  result.dexterity += Math.round(number(effects.accuracy) / 2 + number(effects.evasion) / 1.5 + number(effects.critChance) * 100 / 2);
  result.energy += Math.round(number(effects.resistance) / 2 + number(effects.maxEnergy) * 3);
  result.flatHp += number(effects.heal) && !number(effects.maxHp) ? Math.round(number(effects.heal) / 2) : 0;
  result.flatResistance += effects.resistance ? Math.sign(number(effects.resistance)) * Math.floor(Math.abs(number(effects.resistance)) / 4) : 0;
  result.flatMana += number(effects.maxEnergy);
  result.potionPower += number(effects.potionPower);
  result.luck += number(effects.luck);
  return result;
}

function addBonuses(target, source, scale = 1) {
  for (const key of Object.keys(target)) {
    if (key === 'defenseOverride') continue;
    target[key] += number(source?.[key]) * scale;
  }
  return target;
}

function addSpecials(target, effects, scale = 1, includeFlatResistance = false) {
  if (!effects) return;
  target.luck += number(effects.luck) * scale;
  target.flatMana += number(effects.maxEnergy) * scale;
  target.potionPower += number(effects.potionPower) * scale;
  if (includeFlatResistance) target.flatResistance += number(effects.resistance) * scale;
  for (const key of ['bossDamage', 'eliteDamage', 'mimicDetection', 'goblinChance', 'legendaryFind', 'floorHpLoss', 'mimicChance', 'damageTaken']) {
    target[key] += number(effects[key]) * scale;
  }
  if (effects.defenseSet !== undefined) target.defenseOverride = number(effects.defenseSet);
}

function equipmentBonuses(items) {
  const total = emptyBonuses();
  for (const item of Array.isArray(items) ? items : []) {
    const level = Math.max(1, Math.floor(number(item.level) || 1));
    addBonuses(total, item.attributes || v2ItemBonuses(item), level);
    addSpecials(total, item.effects, level);
    if (!item.purified && item.curse) {
      addBonuses(total, item.curse.attributes || {}, level);
      addSpecials(total, item.curse.effects, level, true);
    }
  }
  return total;
}

function totalAttributes(state) {
  const base = CLASS_V2[state.classKey];
  if (!base) throw new Error('INVALID_CLASS');
  const allocated = state.attributes || {};
  const events = state.eventAttributes || {};
  const equipment = equipmentBonuses(state.items);
  const permanent = state.statBonuses || {};
  return Object.fromEntries(ATTRIBUTES.map(key => [key, Math.max(1, Math.floor(number(base.attributes[key]) + number(allocated[key]) + number(events[key]) + number(equipment[key]) + number(permanent[key])))]));
}

function deriveStats(state) {
  const cls = CLASS_V2[state.classKey];
  if (!cls) throw new Error('INVALID_CLASS');
  const attributes = totalAttributes(state);
  const items = equipmentBonuses(state.items);
  const bonus = state.statBonuses || {};
  const power = attributes.strength * cls.weapon[0] + attributes.dexterity * cls.weapon[1];
  const physical = Math.floor(power * 0.6) + number(items.flatPhysical) + number(bonus.flatPhysical);
  const spell = Math.floor(attributes.energy * 0.75) + number(items.flatSpell) + number(bonus.flatSpell);
  const maxHp = Math.max(20, Math.floor(cls.baseHp + attributes.vitality * 3 + number(items.flatHp) + number(bonus.flatHp)));
  const maxMana = clamp(Math.floor(cls.baseMana + attributes.energy / 100 + number(items.flatMana) + number(bonus.flatMana)), 1, 10);
  return {
    totalAttributes: attributes,
    maxHp,
    damageMin: Math.max(1, physical - 2), damageMax: Math.max(2, physical + 3), spellMin: Math.max(1, spell - 2), spellMax: Math.max(2, spell + 3),
    defense: items.defenseOverride !== null ? items.defenseOverride : bonus.defenseOverride !== null && bonus.defenseOverride !== undefined ? bonus.defenseOverride
      : Math.max(0, Math.floor(attributes.strength * 0.3 + attributes.vitality * 0.15 + number(items.flatDefense) + number(bonus.flatDefense))),
    accuracy: Math.max(1, Math.floor(60 + attributes.dexterity * 1.2 + number(items.flatAccuracy) + number(bonus.flatAccuracy))),
    evasion: Math.max(0, Math.floor(attributes.dexterity * 0.55 + number(items.flatEvasion) + number(bonus.flatEvasion))),
    critChance: clamp(cls.baseCrit + attributes.dexterity * 0.001 + number(items.flatCrit) + number(bonus.flatCrit), 0, 0.6),
    resistance: clamp(cls.baseResistance + Math.floor(attributes.energy * 0.2) + number(items.flatResistance) + number(bonus.flatResistance), -30, 70),
    maxMana,
    potionRate: clamp(0.35 + Math.min(0.15, attributes.vitality * 0.0005) + number(items.potionPower) + number(bonus.potionPower), 0.1, 0.75),
    luck: Math.max(0, Math.floor(number(state.baseLuck) + number(items.luck) + number(bonus.luck))),
    bossDamage: clamp(number(items.bossDamage) + number(bonus.bossDamage), 0, 1),
    eliteDamage: clamp(number(items.eliteDamage) + number(bonus.eliteDamage), 0, 1),
    mimicDetection: clamp(number(items.mimicDetection) + number(bonus.mimicDetection), 0, 0.5),
    goblinChance: clamp(number(items.goblinChance) + number(bonus.goblinChance), 0, 0.3),
    legendaryFind: clamp(number(items.legendaryFind) + number(bonus.legendaryFind), 0, 0.25),
    floorHpLoss: clamp(number(items.floorHpLoss) + number(bonus.floorHpLoss), 0, 0.2),
    mimicChance: clamp(number(items.mimicChance) + number(bonus.mimicChance), 0, 0.3),
    damageTaken: clamp(number(items.damageTaken) + number(bonus.damageTaken), 0, 0.5),
  };
}

function initializeV2State(state) {
  state.statVersion = STAT_VERSION;
  state.itemCatalogVersion = ITEM_CATALOG_VERSION;
  state.attributes ||= { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
  state.eventAttributes ||= { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
  state.statBonuses ||= emptyBonuses();
  state.baseLuck ||= 0;
  syncDerived(state, { healToFull: true, fillMana: true });
  return state;
}

function syncDerived(state, { healToFull = false, fillMana = false } = {}) {
  if (state.statVersion !== STAT_VERSION) return state;
  const previousMaxHp = number(state.maxHp);
  const previousHp = number(state.hp);
  const previousMana = number(state.energy);
  if (state._derivedBase) {
    state.statBonuses ||= emptyBonuses();
    const baseline = state._derivedBase;
    const physicalDelta = ((number(state.damageMin) - number(baseline.damageMin)) + (number(state.damageMax) - number(baseline.damageMax))) / 2;
    state.statBonuses.flatPhysical += physicalDelta;
    state.statBonuses.flatDefense += number(state.defense) - number(baseline.defense);
    state.statBonuses.flatAccuracy += number(state.accuracy) - number(baseline.accuracy);
    state.statBonuses.flatEvasion += number(state.evasion) - number(baseline.evasion);
    state.statBonuses.flatCrit += number(state.critChance) - number(baseline.critChance);
    state.statBonuses.flatResistance += number(state.resistance) - number(baseline.resistance);
    state.statBonuses.flatHp += number(state.maxHp) - number(baseline.maxHp);
    state.statBonuses.flatMana += number(state.maxEnergy) - number(baseline.maxMana);
    state.statBonuses.luck += number(state.luck) - number(baseline.luck);
  }
  const stats = deriveStats(state);
  Object.assign(state, stats, { maxEnergy: stats.maxMana });
  state.hp = healToFull ? stats.maxHp : clamp(previousHp + Math.max(0, stats.maxHp - previousMaxHp), 0, stats.maxHp);
  state.energy = fillMana ? stats.maxMana : clamp(previousMana, 0, stats.maxMana);
  state._derivedBase = { damageMin: stats.damageMin, damageMax: stats.damageMax, defense: stats.defense, accuracy: stats.accuracy,
    evasion: stats.evasion, critChance: stats.critChance, resistance: stats.resistance, maxHp: stats.maxHp, maxMana: stats.maxMana, luck: stats.luck };
  return state;
}

function v2HitChance(accuracy, evasion) {
  const dodge = clamp(number(evasion) / Math.max(1, number(accuracy) + number(evasion)), 0.05, 0.45);
  return 1 - dodge;
}

function v2DefenseReduction(defense, floor) {
  return clamp(number(defense) / Math.max(1, number(defense) + 100 + Math.max(1, number(floor)) / 2), 0, 0.7);
}

module.exports = { STAT_VERSION, ITEM_CATALOG_VERSION, ATTRIBUTES, CLASS_V2, emptyBonuses, v2ItemBonuses,
  equipmentBonuses, totalAttributes, deriveStats, initializeV2State, syncDerived, v2HitChance, v2DefenseReduction, clamp };

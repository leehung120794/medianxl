'use strict';

const { STAT_VERSION, v2DefenseReduction } = require('./hardcoreStats');
const { defenseReduction: legacyDefenseReduction, magicAfterResistance } = require('./hardcoreEngine');

const CLASS_INFO = Object.freeze({
  amazon: Object.freeze({ name: 'Amazon', role: 'Nhiều phát, chính xác', primary: 'DEX', skill: 'Barrage', type: 'physical', multiplier: 0.85, hits: 2,
    summary: 'Bắn 2 phát độc lập; mỗi phát có thể trượt hoặc Crit.' }),
  assassin: Object.freeze({ name: 'Assassin', role: 'Crit và né phản công', primary: 'DEX', skill: 'Shadow Step', type: 'physical', multiplier: 1.3, hits: 1,
    summary: 'Đánh vật lý rồi né hoàn toàn đòn phản công.' }),
  barbarian: Object.freeze({ name: 'Barbarian', role: 'Vật lý và chống chịu', primary: 'STR', skill: 'Iron Will', type: 'physical', multiplier: 1.65, hits: 1,
    summary: 'Một đòn vật lý mạnh, có thể trượt hoặc Crit.' }),
  druid: Object.freeze({ name: 'Druid', role: 'Vật lý và hồi phục', primary: 'STR', skill: 'Wild Regeneration', type: 'physical', multiplier: 1.35, hits: 1,
    summary: 'Đánh vật lý và hồi 12% Max HP.' }),
  necromancer: Object.freeze({ name: 'Necromancer', role: 'Phép và chặn phản công', primary: 'ENE', skill: 'Totem Ward', type: 'magic', multiplier: 1.55, hits: 1,
    summary: 'Phép luôn trúng, không Crit và chặn phản công.' }),
  paladin: Object.freeze({ name: 'Paladin', role: 'Vật lý và phòng thủ', primary: 'STR', skill: 'Divine Shield', type: 'physical', multiplier: 1.4, hits: 1,
    summary: 'Đánh vật lý rồi tự phòng thủ trước phản công.' }),
  sorceress: Object.freeze({ name: 'Sorceress', role: 'Sát thương phép luôn trúng', primary: 'ENE', skill: 'Arcane Burst', type: 'magic', multiplier: 2.1, hits: 1,
    summary: 'Phép luôn trúng, không Crit.' }),
});

const SKILL_MANA_COST = 2;

function basicAttackManaRestore(state) {
  if (state?.statVersion !== STAT_VERSION) return 1;
  const maximum = Math.max(1, Math.floor(Number(state.maxEnergy) || 1));
  const rate = ['sorceress', 'necromancer'].includes(state.classKey) ? 0.7 : 0.4;
  return Math.max(1, Math.floor(maximum * rate));
}

function afterRankBonuses(state, enemy, damage) {
  const rankBonus = ['boss', 'final_boss'].includes(enemy?.rank) ? Number(state.bossDamage) || 0
    : ['elite', 'ancient_mimic'].includes(enemy?.rank) ? Number(state.eliteDamage) || 0 : 0;
  let result = rankBonus ? Math.max(1, Math.floor(damage * (1 + rankBonus))) : damage;
  if (enemy?.damageReduction && result > 0) result = Math.max(1, Math.floor(result * (1 - enemy.damageReduction)));
  return result;
}

function skillDamagePreview(state, enemy = state?.encounter) {
  const info = CLASS_INFO[state?.classKey];
  if (!info || enemy?.type !== 'combat') return null;
  const sourceMin = info.type === 'magic' ? Number(state.spellMin || state.damageMin) : Number(state.damageMin);
  const sourceMax = info.type === 'magic' ? Number(state.spellMax || state.damageMax) : Number(state.damageMax);
  const resolve = source => {
    const raw = Math.max(1, Math.floor(source * info.multiplier));
    const reduced = info.type === 'magic'
      ? magicAfterResistance(raw, Number(enemy.resistance) || 0)
      : Math.max(1, Math.floor(raw * (1 - (state.statVersion === STAT_VERSION
        ? v2DefenseReduction(Number(enemy.defense) || 0, Number(state.floor) || 1)
        : legacyDefenseReduction(Number(enemy.defense) || 0, Number(state.floor) || 1)))));
    return afterRankBonuses(state, enemy, reduced);
  };
  const perHitMin = resolve(sourceMin); const perHitMax = resolve(sourceMax);
  return { ...info, cost: SKILL_MANA_COST, perHitMin, perHitMax, min: perHitMin * info.hits, max: perHitMax * info.hits };
}

module.exports = { CLASS_INFO, SKILL_MANA_COST, basicAttackManaRestore, skillDamagePreview };

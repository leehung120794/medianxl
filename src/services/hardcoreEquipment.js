const RARITY_TIERS = Object.freeze({ common: 'R', rare: 'SR', legendary: 'SSR', cursed: 'UR' });
const EFFECT_KEYS = Object.freeze([
  'attack', 'defense', 'maxHp', 'resistance', 'critChance', 'luck', 'heal', 'potions', 'escapeTokens',
  'defenseSet', 'bonusPenalty', 'curseDefenseLost', 'accuracy', 'evasion', 'maxEnergy', 'potionPower',
  'bossDamage', 'eliteDamage', 'mimicDetection', 'goblinChance', 'legendaryFind', 'floorHpLoss',
  'mimicChance', 'damageTaken',
]);

function rarityLabel(rarity) {
  const tier = RARITY_TIERS[rarity] || rarity || 'R';
  return rarity === 'cursed' ? `${tier} · Nguyền` : tier;
}

function itemEffects(item) {
  if (item?.effects && typeof item.effects === 'object') return { ...item.effects };
  const effects = {};
  for (const key of EFFECT_KEYS) if (item?.[key] !== undefined && key !== 'curseDefenseLost') effects[key] = item[key];
  return effects;
}

function normalizeEquipment(items) {
  const merged = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.name) continue;
    const level = Number.isSafeInteger(item.level) && item.level > 0 ? item.level : 1;
    const previous = merged.get(item.name);
    if (previous) {
      previous.level += level;
      for (const key of ['id', 'text', 'typeCode', 'category', 'curseText']) if (item[key] !== undefined) previous[key] = item[key];
      if (Array.isArray(item.tags)) previous.tags = [...item.tags];
      if (item.effects) previous.effects = { ...item.effects };
      if (item.attributes) previous.attributes = { ...item.attributes };
      if (item.catalogVersion) previous.catalogVersion = item.catalogVersion;
      if (item.curse) previous.curse = { ...item.curse, effects: { ...(item.curse.effects || {}) } };
      if (item.curseApplied) {
        previous.curseApplied ||= {};
        for (const [key, value] of Object.entries(item.curseApplied)) previous.curseApplied[key] = (previous.curseApplied[key] || 0) + value;
      }
      for (const key of EFFECT_KEYS) if (item[key] !== undefined) previous[key] = item[key];
      if (item.purified) previous.purified = true;
    } else {
      const normalized = {
        id: item.id || null, name: item.name, rarity: item.rarity || 'common', typeCode: item.typeCode || null,
        category: item.category || null, tags: Array.isArray(item.tags) ? [...item.tags] : [],
        text: item.text || null, curseText: item.curseText || null, level,
      };
      if (item.effects) normalized.effects = { ...item.effects };
      if (item.attributes) normalized.attributes = { ...item.attributes };
      if (item.catalogVersion) normalized.catalogVersion = item.catalogVersion;
      if (item.curse) normalized.curse = { ...item.curse, effects: { ...(item.curse.effects || {}) } };
      if (item.curseApplied) normalized.curseApplied = { ...item.curseApplied };
      for (const key of EFFECT_KEYS) if (item[key] !== undefined) normalized[key] = item[key];
      if (item.purified) normalized.purified = true;
      merged.set(item.name, normalized);
    }
  }
  return [...merged.values()];
}

function describeEffects(item, level, cursed = false) {
  const effects = [];
  const sign = value => `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
  if (item.attack) effects.push(`${sign(item.attack * level)} sát thương`);
  if (item.defense) effects.push(`${sign(item.defense * level)} phòng thủ`);
  if (item.maxHp) effects.push(`${sign(item.maxHp * level)} HP tối đa`);
  if (item.resistance) effects.push(`${sign(item.resistance * level)}% kháng phép`);
  if (item.critChance) effects.push(`+${Math.round(item.critChance * level * 100)}% chí mạng`);
  if (item.luck) effects.push(`${sign(item.luck * level)} may mắn`);
  if (item.accuracy) effects.push(`${sign(item.accuracy * level)} Accuracy`);
  if (item.evasion) effects.push(`${sign(item.evasion * level)} Evasion`);
  if (item.maxEnergy) effects.push(`${sign(item.maxEnergy * level)} Energy tối đa`);
  if (item.heal) effects.push(`hồi tối đa ${item.heal} HP mỗi cấp`);
  if (item.potions) effects.push(`đã nhận ${item.potions * level} bình máu`);
  if (item.escapeTokens) effects.push(`đã nhận ${item.escapeTokens * level} Vé Thoát Hiểm`);
  if (item.defenseSet !== undefined) effects.push(`phòng thủ về ${item.defenseSet} mỗi lần nhặt`);
  if (item.bonusPenalty) effects.push(`payout giảm ${Math.round((1 - (1 - item.bonusPenalty) ** level) * 100)}% cộng dồn`);
  const percent = key => Math.round(Math.abs(item[key]) * level * 100);
  if (item.potionPower) effects.push(`hiệu lực bình ${item.potionPower > 0 ? '+' : '−'}${percent('potionPower')}% HP`);
  if (item.bossDamage) effects.push(`+${percent('bossDamage')}% damage Boss`);
  if (item.eliteDamage) effects.push(`+${percent('eliteDamage')}% damage Elite`);
  if (item.mimicDetection) effects.push(`+${percent('mimicDetection')}% phát hiện Mimic`);
  if (item.goblinChance) effects.push(`+${percent('goblinChance')}% bắt Goblin`);
  if (item.legendaryFind) effects.push(`+${percent('legendaryFind')}% tỉ lệ SSR`);
  if (item.floorHpLoss) effects.push(`mất ${percent('floorHpLoss')}% HP mỗi tầng`);
  if (item.mimicChance) effects.push(`+${percent('mimicChance')}% gặp Mimic`);
  if (item.damageTaken) effects.push(`nhận thêm ${percent('damageTaken')}% damage`);
  return effects.length ? `${cursed ? 'Nguyền: ' : ''}${effects.join(' · ')}` : '';
}

function effectText(item, level) {
  if (!item) return 'Không rõ tác dụng';
  const positive = describeEffects(itemEffects(item), level);
  const curse = !item.purified && item.curse?.effects ? describeEffects(item.curse.effects, level, true) : '';
  return [positive || item.text, curse].filter(Boolean).join(' · ') || 'Không rõ tác dụng';
}

module.exports = { RARITY_TIERS, EFFECT_KEYS, rarityLabel, itemEffects, normalizeEquipment, effectText };

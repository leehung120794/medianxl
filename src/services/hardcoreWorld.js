const REGIONS = Object.freeze([
  { min: 1, max: 99, name: 'Sanctuary', enemies: ['Fallen Zealot', 'Goatman', 'Dark Cultist', 'Lost Soul'] },
  { min: 100, max: 199, name: 'Duncraig', enemies: ['Possessed Citizen', 'Necromorb', 'Ashen Marauder', 'Powder Keg Fanatic'] },
  { min: 200, max: 299, name: 'Fauztinville', enemies: ['Necrobot', 'Harpylisk', 'Steel Terror', 'Fauztinville Drone'] },
  { min: 300, max: 399, name: 'Teganze', enemies: ['Teganze Spirit', 'Storm Shaman', 'Poisoned Hunter', 'Elemental Guardian'] },
  { min: 400, max: 499, name: 'Scosglen', enemies: ['Moon Panther', 'Witchblood Druid', 'Wild Hunt', 'Ancient Treant'] },
  { min: 500, max: 699, name: 'Dimensional Labyrinth', enemies: ['Corrupted Hero', 'Unstable Anomaly', 'Abyssal Shrine', 'Rift Stalker'] },
  { min: 700, max: 899, name: 'Heroic Rift', enemies: ['Zakarum Avatar', 'Heavenly Exile', 'Heroic Guardian', 'Fate Devourer'] },
  { min: 900, max: 999, name: 'Dimensional Plane', enemies: ['Abyssal Spire', 'Void Spawn', 'Dream Eater', 'Fleshweaver Spawn'] },
]);

const MODIFIERS = Object.freeze({
  stone_skin: { name: 'Stone Skin', description: 'Quái tăng 10% Defense mỗi cộng dồn.' },
  elemental_dominion: { name: 'Elemental Dominion', description: 'Quái tăng 4% sát thương và khả năng dùng phép mỗi cộng dồn.' },
  bloodlust: { name: 'Bloodlust', description: 'Quái còn dưới 50% HP gây thêm 8% sát thương mỗi cộng dồn.' },
  unstable_rift: { name: 'Unstable Rift', description: 'Nhiều hòm tốt hơn nhưng Mimic cũng xuất hiện nhiều hơn.' },
  fortified: { name: 'Fortified', description: 'Quái tăng 10% HP mỗi cộng dồn.' },
  swift_horror: { name: 'Swift Horror', description: 'Quái tăng 3 Accuracy và 1 Evasion mỗi cộng dồn.' },
  soul_drain: { name: 'Soul Drain', description: 'Đòn trúng rút 1 Energy; từ 5 cộng dồn sẽ rút 2.' },
  cursed_ground: { name: 'Cursed Ground', description: 'All Resistance của người chơi giảm 4% mỗi cộng dồn khi nhận phép.' },
});

const BOSS_SEQUENCE = Object.freeze([
  { name: 'The Butcher', mechanic: 'frenzy', damageType: 'physical', description: 'Gây sát thương vật lý; mỗi lần ra đòn tăng 8% sát thương, tối đa 5 cộng dồn.' },
  { name: 'Ascendant Riftwalker', mechanic: 'rift_shield', damageType: 'magic', description: 'Gây sát thương phép; miễn nhiễm đòn đầu tiên trong mỗi chu kỳ ba lượt.' },
  { name: 'Assur', mechanic: 'assur_evasion', damageType: 'physical', description: 'Gây sát thương vật lý; có Evasion cao và đòn chí mạng nguy hiểm.' },
  { name: 'Lucion', mechanic: 'life_drain', damageType: 'magic', description: 'Gây sát thương phép; hồi máu bằng 35% sát thương gây ra.' },
  { name: 'Deimoss the Fleshweaver', mechanic: 'abyssal_spires', damageType: 'physical', description: 'Gây sát thương vật lý; Abyssal Spires giảm 25% sát thương nhận vào.' },
]);

function regionForFloor(floor) {
  return REGIONS.find(region => floor >= region.min && floor <= region.max) || REGIONS.at(-1);
}

function bossForFloor(floor) {
  if (floor >= 999) return BOSS_SEQUENCE[4];
  const index = Math.max(0, Math.floor(floor / 50) - 1) % BOSS_SEQUENCE.length;
  return BOSS_SEQUENCE[index];
}

function modifierStacks(state, key) {
  return (Array.isArray(state?.modifiers) ? state.modifiers : []).filter(value => value === key).length;
}

// Ba stack đầu giữ nguyên sức mạnh; stack 4–8 chỉ còn 50%; stack 9+ còn 25% và tổng hiệu lực cap 8.
function effectiveModifierStacks(stacks) {
  const count = Math.max(0, Math.floor(Number(stacks) || 0));
  return Math.min(8, Math.min(count, 3) + Math.min(Math.max(0, count - 3), 5) * 0.5 + Math.max(0, count - 8) * 0.25);
}

function riftModifierEffects(state, enemy = null) {
  const stacks = key => modifierStacks(state, key);
  const stoneSkin = stacks('stone_skin'); const elemental = stacks('elemental_dominion');
  const bloodlust = stacks('bloodlust'); const unstable = stacks('unstable_rift');
  const fortified = stacks('fortified'); const swift = stacks('swift_horror');
  const soulDrain = stacks('soul_drain'); const cursedGround = stacks('cursed_ground');
  const v2 = state?.statVersion === 2;
  const power = count => v2 ? effectiveModifierStacks(count) : count;
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

module.exports = { REGIONS, MODIFIERS, BOSS_SEQUENCE, regionForFloor, bossForFloor, modifierStacks, effectiveModifierStacks, riftModifierEffects };

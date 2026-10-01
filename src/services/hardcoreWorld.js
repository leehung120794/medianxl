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

module.exports = { REGIONS, MODIFIERS, BOSS_SEQUENCE, regionForFloor, bossForFloor, modifierStacks };

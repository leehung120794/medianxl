const MAX_PAYOUT = 10_000_000;
const COMPLETION_FLOOR = 100;
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hitChance(accuracy, evasion) { return clamp(0.75 + (accuracy - evasion) * 0.005, 0.2, 0.95); }
function defenseReduction(defense, level) { return clamp(defense / (defense + 50 + level * 8), 0, 0.75); }
function physicalAfterDefense(rawDamage, defense, level) { return Math.max(1, Math.floor(rawDamage * (1 - defenseReduction(defense, level)))); }
function magicAfterResistance(rawDamage, resistance) { return Math.max(1, Math.floor(rawDamage * (1 - clamp(resistance, -50, 75) / 100))); }
function enemyScale(floor) {
  const current = clamp(Number(floor) || 1, 1, 999);
  const early = Math.min(current, 100);
  const overrun = Math.max(0, current - 100);
  return {
    hp: 1 + early * 0.065 + overrun * 0.08,
    damage: 1 + early * 0.04 + overrun * 0.038,
  };
}
function baseMultiplier(state) {
  const floor = Math.min(state.cleared, COMPLETION_FLOOR);
  const checkpoints = Math.min(20, Math.floor(floor / 5));
  return 1 + Math.min(floor, 50) * 0.06 + Math.max(0, floor - 50) * 0.1 + checkpoints * 0.15;
}
function potentialPayout(state) {
  if (state.cleared <= 0) return 0;
  const gross = Math.floor((state.stake * baseMultiplier(state) + state.bonus) * state.payoutFactor);
  const cappedGross = Math.min(MAX_PAYOUT, Math.max(0, gross));
  return Math.max(0, cappedGross - (Number(state.payoutSpent) || 0));
}
function payoutLoss(state, remainingFactor) {
  const before = potentialPayout(state);
  const factor = clamp(Number(remainingFactor) || 0, 0, 1);
  const after = potentialPayout({ ...state, payoutFactor: (Number(state.payoutFactor) || 0) * factor });
  return Math.max(0, before - after);
}
module.exports = { clamp, hitChance, defenseReduction, physicalAfterDefense, magicAfterResistance, enemyScale, baseMultiplier, potentialPayout, payoutLoss };

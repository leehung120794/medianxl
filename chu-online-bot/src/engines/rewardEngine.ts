// Engine for calculating rewards
export interface CultivationRewardInput {
  baseAmount: number;
  rootMultiplier: number;
  eventMultiplier?: number;
  methodMultiplier?: number;
}

export function calculateCultivationReward(input: CultivationRewardInput): number {
  const eventMultiplier = input.eventMultiplier ?? 1;
  const methodMultiplier = input.methodMultiplier ?? 1;

  return Math.floor(
    input.baseAmount *
    input.rootMultiplier *
    eventMultiplier *
    methodMultiplier
  );
}

export function calculateBreakthroughSuccess(
  baseRate: number,
  daoHeartBonus: number = 0,
  itemBonus: number = 0
): number {
  let rate = baseRate + daoHeartBonus + itemBonus;
  // Cap at 95% maximum success rate
  return Math.min(rate, 95);
}

export function isBreakthroughSuccessful(rate: number): boolean {
  const roll = Math.random() * 100;
  return roll < rate;
}

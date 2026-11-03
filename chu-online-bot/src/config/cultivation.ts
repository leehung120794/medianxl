// Configuration for Cultivation Sessions
export interface CultivationDuration {
  minutes: number;
  baseReward: number;
}

export const CULTIVATION_DURATIONS: CultivationDuration[] = [
  { minutes: 5, baseReward: 10 },
  { minutes: 30, baseReward: 70 },
  { minutes: 60, baseReward: 150 },
  { minutes: 240, baseReward: 650 },
  { minutes: 480, baseReward: 1300 },
];

export const RETREAT_DURATIONS: CultivationDuration[] = [
  { minutes: 60, baseReward: 180 },
  { minutes: 240, baseReward: 780 },
  { minutes: 480, baseReward: 1560 },
  { minutes: 720, baseReward: 2340 },
];

export const RETREAT_EFFICIENCY_MULTIPLIER = 1.2; // Retreat is 20% more efficient

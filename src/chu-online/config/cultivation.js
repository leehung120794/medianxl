// Configuration for Cultivation Sessions
const CULTIVATION_DURATIONS = [
  { minutes: 5, baseReward: 10 },
  { minutes: 30, baseReward: 70 },
  { minutes: 60, baseReward: 150 },
  { minutes: 240, baseReward: 650 },
  { minutes: 480, baseReward: 1300 },
];

const RETREAT_DURATIONS = [
  { minutes: 60, baseReward: 180 },
  { minutes: 240, baseReward: 780 },
  { minutes: 480, baseReward: 1560 },
  { minutes: 720, baseReward: 2340 },
];

const RETREAT_EFFICIENCY_MULTIPLIER = 1.2; // Retreat is 20% more efficient

module.exports = {
  CULTIVATION_DURATIONS,
  RETREAT_DURATIONS,
  RETREAT_EFFICIENCY_MULTIPLIER,
};

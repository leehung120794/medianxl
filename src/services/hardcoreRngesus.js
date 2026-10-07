"use strict";

const RNGESUS_BASE_CHANCE = 0.003;
const RNGESUS_DRY_STEP = 0.0005;
const RNGESUS_MAX_CHANCE = 0.12;
const RNGESUS_MAX_DRY = Math.ceil(
  (RNGESUS_MAX_CHANCE - RNGESUS_BASE_CHANCE) / RNGESUS_DRY_STEP,
);

// Floors 1–4 remain the opening grace period. Every eligible cycle then uses
// the same linear pity curve, independent of the absolute floor number.
function rngesusChance(floor) {
  if (floor < 5) return 0;
  if (floor === 999 || floor % 50 === 0) return 0;
  return RNGESUS_BASE_CHANCE;
}
function rngesusDryCount(state) {
  return Number.isSafeInteger(state.rngesusDry)
    ? Math.max(0, Math.min(RNGESUS_MAX_DRY, state.rngesusDry))
    : 0;
}
function isRngesusRollBlocked(state) {
  if (!Number.isSafeInteger(state.floor) || !rngesusChance(state.floor))
    return true;
  const resetFloor = state.rngesusResetFloor;
  return (
    Number.isSafeInteger(resetFloor) &&
    resetFloor > 0 &&
    state.floor - resetFloor <= 1
  );
}
function rngesusEncounterChance(state) {
  if (isRngesusRollBlocked(state)) return 0;
  return Math.min(
    RNGESUS_MAX_CHANCE,
    RNGESUS_BASE_CHANCE + rngesusDryCount(state) * RNGESUS_DRY_STEP,
  );
}
function resetRngesusEncounter(state) {
  state.rngesusResetFloor = state.floor;
  state.rngesusDry = 0;
  state.lastChaosChance = 0;
  state.lastChaosSpike = false;
}
// Shared by /luat and /sinhton tyle so both describe the same encounter cycle.
const RNGESUS_CYCLE_RULES = [
  "- Tầng 1–4 là giai đoạn an toàn. Lần roll hợp lệ đầu tiên có **0,30%** cơ hội gặp RNGesus.",
  "- Mỗi lần roll nhưng không gặp cộng cố định **0,05 điểm phần trăm** cho lần hợp lệ kế tiếp, tối đa **12%**.",
  "- Khi gặp RNGesus, bộ đếm không gặp được reset. Nếu vượt qua tại tầng F thì tầng F+1 an toàn **0%**; lần roll hợp lệ sau đó bắt đầu lại ở **0,30%**.",
  "- Boss tầng 50/100/…/999 và mọi tầng bị chặn không roll RNGesus, không tăng bộ đếm.",
  "- Không còn nhân ngẫu nhiên hoặc spike. Tỷ lệ bỏ chạy và hiệu lực vé cầu nguyện vẫn theo trạng thái riêng của run, không bị reset theo Chaos.",
].join("\n");
function rngesusChaosRules() {
  return [
    "Chaos là tỷ lệ gặp RNGesus của lần roll gần nhất, không phải debuff.",
    "- Công thức: **0,30% + 0,05 điểm % × số lần roll liên tiếp không gặp**.",
    "- Ví dụ: **0,30% → 0,35% → 0,40% → 0,45%…**, tối đa **12%**.",
    "- Không còn biến động ngẫu nhiên hoặc spike; cùng số lần trượt luôn cho cùng tỷ lệ.",
    "- Tầng an toàn, tầng boss và tầng bị chặn hiển thị **0%** và không làm tỷ lệ tăng.",
  ].join("\n");
}
module.exports = {
  RNGESUS_BASE_CHANCE,
  RNGESUS_CYCLE_RULES,
  RNGESUS_DRY_STEP,
  RNGESUS_MAX_CHANCE,
  RNGESUS_MAX_DRY,
  rngesusChaosRules,
  rngesusChance,
  rngesusDryCount,
  rngesusEncounterChance,
  isRngesusRollBlocked,
  resetRngesusEncounter,
};

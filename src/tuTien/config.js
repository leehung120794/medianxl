const ROOTS = Object.freeze([
  { id: "mortal", name: "Phàm Cốt", chance: 40, multiplier: 1 },
  { id: "spirit", name: "Linh Cốt", chance: 25, multiplier: 1.2 },
  { id: "earth", name: "Địa Linh Cốt", chance: 15, multiplier: 1.5 },
  { id: "mystic", name: "Huyền Linh Cốt", chance: 10, multiplier: 1.8 },
  { id: "heaven", name: "Thiên Linh Cốt", chance: 6, multiplier: 2.2 },
  { id: "saint", name: "Thánh Linh Cốt", chance: 3, multiplier: 2.8 },
  { id: "immortal", name: "Tiên Linh Cốt", chance: 1, multiplier: 3.5 },
]);

const REALMS = Object.freeze([
  "Phàm Nhân", "Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh", "Hóa Thần",
  "Luyện Hư", "Hợp Thể", "Đại Thừa", "Độ Kiếp", "Chân Tiên", "Tiên Đế",
]);

const ACTIVITIES = Object.freeze([
  { id: "incense", name: "Thắp hương", cultivation: 50, merit: 5, dao: 0, dailyLimit: 1, emoji: "🕯️" },
  { id: "buddha", name: "Lễ Phật", cultivation: 80, merit: 8, dao: 0, dailyLimit: 1, emoji: "🙏" },
  { id: "sutra", name: "Tụng kinh", cultivation: 150, merit: 10, dao: 2, dailyLimit: 1, emoji: "📿" },
  { id: "meditate", name: "Ngồi thiền", cultivation: 200, merit: 0, dao: 5, dailyLimit: 1, emoji: "🧘" },
  { id: "sweep", name: "Quét sân chùa", cultivation: 100, merit: 10, dao: 0, dailyLimit: 2, emoji: "🧹" },
  { id: "lotus", name: "Chăm sóc hoa sen", cultivation: 120, merit: 8, dao: 0, dailyLimit: 2, emoji: "🪷" },
  { id: "charity", name: "Công quả", cultivation: 300, merit: 20, dao: 5, dailyLimit: 1, emoji: "🌿" },
]);

const SESSION_OPTIONS = Object.freeze({
  normal: [
    { seconds: 300, baseReward: 10, label: "5 phút" },
    { seconds: 1800, baseReward: 70, label: "30 phút" },
    { seconds: 3600, baseReward: 150, label: "1 giờ" },
    { seconds: 14400, baseReward: 650, label: "4 giờ" },
    { seconds: 28800, baseReward: 1300, label: "8 giờ" },
  ],
  retreat: [
    { seconds: 3600, baseReward: 190, label: "1 giờ" },
    { seconds: 14400, baseReward: 800, label: "4 giờ" },
    { seconds: 28800, baseReward: 1700, label: "8 giờ" },
    { seconds: 43200, baseReward: 2700, label: "12 giờ" },
  ],
});

const ITEMS = Object.freeze({
  dan_nghich_thien: {
    id: "dan_nghich_thien",
    name: "Đan Dược Nghịch Thiên",
    description: "Random lại căn cốt theo tỷ lệ hiện hành. Căn cốt mới có thể yếu hơn căn cốt cũ.",
    price: 10000,
  },
});

const DAILY_QUESTS = Object.freeze([
  { id: "any_activity", name: "Hoàn thành 1 hoạt động bất kỳ", target: 1, reward: { cultivation: 50, spiritStone: 100 } },
  { id: "meditate_once", name: "Ngồi thiền 1 lần", target: 1, activityId: "meditate", reward: { cultivation: 80, daoHeart: 1 } },
  { id: "three_activities", name: "Hoàn thành 3 hoạt động chùa", target: 3, reward: { cultivation: 150, spiritStone: 200 } },
]);

function requiredCultivation(realmOrder, stage) {
  return Math.max(1, Math.round(100 * 1.35 ** (realmOrder - 1) * 1.22 ** (stage - 1)));
}

function stageName(stage) {
  return stage <= 3 ? "Sơ kỳ" : stage <= 6 ? "Trung kỳ" : "Hậu kỳ";
}

function rootById(id) {
  return ROOTS.find((root) => root.id === id) || ROOTS[0];
}

module.exports = {
  ROOTS,
  REALMS,
  ACTIVITIES,
  SESSION_OPTIONS,
  ITEMS,
  DAILY_QUESTS,
  requiredCultivation,
  stageName,
  rootById,
};

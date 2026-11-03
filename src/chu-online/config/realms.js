// Configuration for Realms (Cảnh giới)
const REALMS = [
  { id: 'mortal', name: 'Phàm Nhân', order: 1 },
  { id: 'qi_refining', name: 'Luyện Khí', order: 2 },
  { id: 'foundation', name: 'Trúc Cơ', order: 3 },
  { id: 'core', name: 'Kim Đan', order: 4 },
  { id: 'nascent', name: 'Nguyên Anh', order: 5 },
  { id: 'spirit', name: 'Hóa Thần', order: 6 },
  { id: 'void', name: 'Luyện Hư', order: 7 },
  { id: 'body', name: 'Hợp Thể', order: 8 },
  { id: 'mahayana', name: 'Đại Thừa', order: 9 },
  { id: 'tribulation', name: 'Độ Kiếp', order: 10 },
  { id: 'true_immortal', name: 'Chân Tiên', order: 11 },
  { id: 'emperor', name: 'Tiên Đế', order: 12 },
];

function getRealmById(id) {
  return REALMS.find(realm => realm.id === id);
}

function getRealmByOrder(order) {
  return REALMS.find(realm => realm.order === order);
}

function getStageName(stage) {
  if (stage >= 1 && stage <= 3) return 'Sơ kỳ';
  if (stage >= 4 && stage <= 6) return 'Trung kỳ';
  if (stage >= 7 && stage <= 9) return 'Hậu kỳ';
  return 'Không xác định';
}

// Calculate required cultivation for a realm stage
function calculateRequiredCultivation(realmOrder, stage) {
  const base = 100;
  const realmMultiplier = Math.pow(1.35, realmOrder - 1);
  const stageMultiplier = Math.pow(1.22, stage - 1);
  return Math.round(base * realmMultiplier * stageMultiplier);
}

// Get breakthrough success rate for major breakthroughs
function getBreakthroughRate(fromRealmOrder) {
  const rates = {
    1: 90, // Phàm Nhân → Luyện Khí
    2: 80, // Luyện Khí → Trúc Cơ
    3: 70, // Trúc Cơ → Kim Đan
    4: 60, // Kim Đan → Nguyên Anh
    5: 50, // Nguyên Anh → Hóa Thần
  };

  return rates[fromRealmOrder] ?? 50; // Default 50% for higher realms
}

module.exports = {
  REALMS,
  getRealmById,
  getRealmByOrder,
  getStageName,
  calculateRequiredCultivation,
  getBreakthroughRate,
};

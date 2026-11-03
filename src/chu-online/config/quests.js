// Configuration for Quests
const QUESTS = [
  {
    id: 'daily_1',
    name: 'Người Chăm Chùa',
    description: 'Hoàn thành 1 hoạt động chùa bất kỳ',
    questType: 'daily',
    targetValue: 1,
    reward: { cultivation: 100, spiritStone: 50 },
  },
  {
    id: 'daily_2',
    name: 'Thắp Hương Đầu Ngày',
    description: 'Thắp hương 1 lần',
    questType: 'daily',
    targetValue: 1,
    activityId: 'thap_huong',
    reward: { cultivation: 150, merit: 10 },
  },
  {
    id: 'daily_3',
    name: 'Người Thiền Định',
    description: 'Ngồi thiền 1 lần',
    questType: 'daily',
    targetValue: 1,
    activityId: 'ngoi_thien',
    reward: { cultivation: 300, daoHeart: 5 },
  },
  {
    id: 'daily_4',
    name: 'Chăm Sân Chùa',
    description: 'Quét sân chùa 1 lần',
    questType: 'daily',
    targetValue: 1,
    activityId: 'quet_san',
    reward: { cultivation: 200, merit: 15 },
  },
  {
    id: 'daily_5',
    name: 'Tu Luyện Siêng Năng',
    description: 'Hoàn thành 3 phiên tu luyện',
    questType: 'daily',
    targetValue: 3,
    reward: { cultivation: 500, spiritStone: 100 },
  },
];

function getQuestById(id) {
  return QUESTS.find(quest => quest.id === id);
}

function getDailyQuests() {
  return QUESTS.filter(quest => quest.questType === 'daily');
}

module.exports = { QUESTS, getQuestById, getDailyQuests };

// Configuration for Temple Activities
export interface TempleActivityConfig {
  id: string;
  name: string;
  description: string;
  baseCultivationReward: number;
  meritReward: number;
  daoHeartReward: number;
  dailyLimit: number;
  cooldownSeconds: number;
  imageUrl: string;
}

export const TEMPLE_ACTIVITIES: TempleActivityConfig[] = [
  {
    id: 'thap_huong',
    name: 'Thắp hương',
    description: 'Thắp hương trước bàn thờ, cầu mong sự bình an và thiện lành.',
    baseCultivationReward: 50,
    meritReward: 5,
    daoHeartReward: 0,
    dailyLimit: 1,
    cooldownSeconds: 86400,
    imageUrl: 'assets/activities/thap-huong.png',
  },
  {
    id: 'le_phat',
    name: 'Lễ Phật',
    description: 'Thực hiện nghi lễ bái lạy để phát triển tâm linh.',
    baseCultivationReward: 80,
    meritReward: 8,
    daoHeartReward: 0,
    dailyLimit: 1,
    cooldownSeconds: 86400,
    imageUrl: 'assets/activities/le-phat.png',
  },
  {
    id: 'tung_kinh',
    name: 'Tụng kinh',
    description: 'Tụng kinh thư để tu dưỡng đạo tâm và trí tuệ.',
    baseCultivationReward: 150,
    meritReward: 10,
    daoHeartReward: 2,
    dailyLimit: 1,
    cooldownSeconds: 86400,
    imageUrl: 'assets/activities/tung-kinh.png',
  },
  {
    id: 'ngoi_thien',
    name: 'Ngồi thiền',
    description: 'Ngồi thiền định để tĩnh tâm và tích lũy đạo tâm.',
    baseCultivationReward: 200,
    meritReward: 0,
    daoHeartReward: 5,
    dailyLimit: 1,
    cooldownSeconds: 86400,
    imageUrl: 'assets/activities/ngoi-thien.png',
  },
  {
    id: 'quet_san',
    name: 'Quét sân chùa',
    description: 'Quét dọn sân chùa để tích lũy công đức.',
    baseCultivationReward: 100,
    meritReward: 10,
    daoHeartReward: 0,
    dailyLimit: 2,
    cooldownSeconds: 43200,
    imageUrl: 'assets/activities/quet-san.png',
  },
  {
    id: 'cham_hoa_sen',
    name: 'Chăm sóc hoa sen',
    description: 'Chăm sóc vườn hoa sen để phát triển lòng từ bi.',
    baseCultivationReward: 120,
    meritReward: 8,
    daoHeartReward: 0,
    dailyLimit: 2,
    cooldownSeconds: 43200,
    imageUrl: 'assets/activities/cham-soc-hoa-sen.png',
  },
  {
    id: 'cong_qua',
    name: 'Công quả',
    description: 'Thực hiện các công việc thiện nguyện lớn hơn.',
    baseCultivationReward: 300,
    meritReward: 20,
    daoHeartReward: 5,
    dailyLimit: 1,
    cooldownSeconds: 86400,
    imageUrl: 'assets/activities/cong-qua.png',
  },
];

export const getActivityById = (id: string): TempleActivityConfig | undefined => {
  return TEMPLE_ACTIVITIES.find(activity => activity.id === id);
};

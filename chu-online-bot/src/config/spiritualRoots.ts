// Configuration for Spiritual Roots (Căn Cốt)
export interface SpiritualRootConfig {
  id: string;
  name: string;
  chance: number;
  multiplier: number;
}

export const SPIRITUAL_ROOTS: SpiritualRootConfig[] = [
  { id: 'mortal', name: 'Phàm Cốt', chance: 40, multiplier: 1.0 },
  { id: 'spirit', name: 'Linh Cốt', chance: 25, multiplier: 1.2 },
  { id: 'earth', name: 'Địa Linh Cốt', chance: 15, multiplier: 1.5 },
  { id: 'mystic', name: 'Huyền Linh Cốt', chance: 10, multiplier: 1.8 },
  { id: 'heaven', name: 'Thiên Linh Cốt', chance: 6, multiplier: 2.2 },
  { id: 'saint', name: 'Thánh Linh Cốt', chance: 3, multiplier: 2.8 },
  { id: 'immortal', name: 'Tiên Linh Cốt', chance: 1, multiplier: 3.5 },
];

export const getRootById = (id: string): SpiritualRootConfig | undefined => {
  return SPIRITUAL_ROOTS.find(root => root.id === id);
};

export const getRandomRoot = (): SpiritualRootConfig => {
  const total = SPIRITUAL_ROOTS.reduce((sum, root) => sum + root.chance, 0);
  let roll = Math.random() * total;

  for (const root of SPIRITUAL_ROOTS) {
    roll -= root.chance;
    if (roll < 0) return root;
  }

  return SPIRITUAL_ROOTS[SPIRITUAL_ROOTS.length - 1];
};

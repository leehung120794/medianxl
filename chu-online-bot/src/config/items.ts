// Configuration for Items
export interface ItemConfig {
  id: string;
  name: string;
  description: string;
  itemType: string;
  priceSpiritStone: number;
}

export const ITEMS: ItemConfig[] = [
  {
    id: 'dan_nghich_thien',
    name: 'Đan Dược Nghịch Thiên',
    description: 'Đan dược thần kỳ có thể thay đổi căn cốt của đạo hữu. Không đảm bảo căn cốt mới tốt hơn căn cốt cũ.',
    itemType: 'elixir',
    priceSpiritStone: 10000,
  },
];

export const getItemById = (id: string): ItemConfig | undefined => {
  return ITEMS.find(item => item.id === id);
};

// Configuration for Items
const ITEMS = [
  {
    id: 'dan_nghich_thien',
    name: 'Đan Dược Nghịch Thiên',
    description: 'Đan dược thần kỳ có thể thay đổi căn cốt của đạo hữu. Không đảm bảo căn cốt mới tốt hơn căn cốt cũ.',
    itemType: 'elixir',
    priceSpiritStone: 10000,
  },
];

function getItemById(id) {
  return ITEMS.find(item => item.id === id);
}

module.exports = { ITEMS, getItemById };

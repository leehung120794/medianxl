const { CATALOG: PROFILE_COSMETICS, DEFAULT_IDS } = require('./profileCosmeticService');

const RARITY = Object.freeze({ common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 });
const DEFAULT_PRICE_MULTIPLIER = 100;
const shopPrice = basePrice => basePrice * DEFAULT_PRICE_MULTIPLIER;
const DEFAULT_PROFILE_ITEMS = new Set(DEFAULT_IDS);

const UTILITY_ITEMS = [
  { id: 'hint_charm', type: 'consumable', name: 'Bùa Gợi Ý', effect: 'quiz_hint', rarity: 'common', price: shopPrice(300), stackable: true, tradeable: true, description: 'Mở thêm một gợi ý trong Đoán item hoặc Vua tiếng Việt.' },
  { id: 'skip_card', type: 'consumable', name: 'Thẻ Đổi Câu', effect: 'quiz_skip', rarity: 'common', price: shopPrice(500), stackable: true, tradeable: true, description: 'Đổi câu hiện tại mà không nhận thưởng.' },
  { id: 'reward_booster', type: 'consumable', name: 'Bùa Nhân Đôi Thưởng', effect: 'quiz_reward_boost', rarity: 'rare', price: shopPrice(1000), stackable: true, tradeable: true, description: 'Nhân đôi xu cho câu trả lời đúng tiếp theo trong Nối từ, Vua tiếng Việt hoặc Đoán item; hiệu lực 7 ngày.' },
  { id: 'craft_discount', type: 'consumable', name: 'Búa Thợ Rèn', effect: 'craft_discount', rarity: 'rare', price: shopPrice(1200), stackable: true, tradeable: true, description: 'Giảm 25% Mảnh linh hồn cho lần chế tạo thẻ tiếp theo; hiệu lực 7 ngày.' },
  { id: 'chest_luck', type: 'consumable', name: 'Bùa May Mắn Hòm', effect: 'chest_luck', rarity: 'epic', price: shopPrice(2000), stackable: true, tradeable: true, description: 'Hòm sưu tập tiếp theo chắc chắn cho thẻ từ Epic trở lên; hiệu lực 7 ngày.' },
  { id: 'soul_pouch', type: 'consumable', name: 'Túi Mảnh Linh Hồn', effect: 'soul_shards', rarity: 'rare', price: shopPrice(2500), stackable: true, tradeable: true, description: 'Mở để nhận ngay 100 Mảnh linh hồn dùng cho /craft.' },
  { id: 'soul_crate', type: 'consumable', name: 'Rương Mảnh Linh Hồn', effect: 'soul_shards_large', rarity: 'epic', price: shopPrice(6000), stackable: true, tradeable: true, description: 'Mở để nhận ngay 300 Mảnh linh hồn dùng cho /craft.' },
  { id: 'duplicate_ward', type: 'consumable', name: 'Bùa Chống Trùng', effect: 'chest_duplicate_ward', rarity: 'epic', price: shopPrice(1800), stackable: true, tradeable: true, description: 'Nếu hòm kế tiếp ra thẻ đã sở hữu, tự đổi sang một thẻ còn thiếu cùng bộ; hiệu lực 7 ngày.' },
  { id: 'mines_detector', type: 'consumable', name: 'Máy Dò Bẫy', effect: 'mines_detector', rarity: 'rare', price: shopPrice(800), stackable: true, tradeable: true, description: 'Báo riêng vị trí một quả mìn chưa mở trong ván Mines.' },
  { id: 'mines_safe_map', type: 'consumable', name: 'Bản Đồ An Toàn Mines', effect: 'mines_safe_cell', rarity: 'rare', price: shopPrice(1000), stackable: true, tradeable: true, description: 'Chỉ ra riêng một ô an toàn chưa mở trong ván Mines hiện tại.' },
  { id: 'bet_insurance', type: 'consumable', name: 'Bảo Hiểm Cược', effect: 'bet_insurance', rarity: 'rare', price: shopPrice(1500), stackable: true, tradeable: true, description: 'Kích hoạt một lần hoàn 25% tiền cược nếu ván kế tiếp thua trắng; hiệu lực 24 giờ.' },
  { id: 'bet_insurance_plus', type: 'consumable', name: 'Bảo Hiểm Cược Cao Cấp', effect: 'bet_insurance_plus', rarity: 'epic', price: shopPrice(3500), stackable: true, tradeable: true, description: 'Kích hoạt một lần hoàn 50% tiền cược nếu ván kế tiếp thua trắng; hiệu lực 24 giờ.' },
  { id: 'hardcore_revive', type: 'consumable', name: 'Bùa Hồi Sinh', effect: 'hardcore_revive', rarity: 'epic', price: shopPrice(3000), stackable: true, tradeable: true, description: 'Kích hoạt một lần hồi sinh trong Hardcore Run; tối đa một lần mỗi run.' },
  { id: 'chest_lock', type: 'consumable', name: 'Khóa Hòm', effect: 'hardcore_chest_lock', rarity: 'rare', price: shopPrice(1200), stackable: true, tradeable: true, description: 'Loại bỏ một kết quả hòm rỗng hoặc đồ Legendary giả trong Hardcore Run.' },
  { id: 'boss_fury', type: 'consumable', name: 'Dầu Săn Boss', effect: 'boss_damage_boost', rarity: 'rare', price: shopPrice(1400), stackable: true, tradeable: true, description: 'Ba chiến thắng tiếp theo gây gấp đôi sát thương lên boss cộng đồng; hiệu lực 7 ngày.' },
  { id: 'season_booster', type: 'consumable', name: 'Cờ Hiệu Mùa Giải', effect: 'season_points_boost', rarity: 'epic', price: shopPrice(2200), stackable: true, tradeable: true, description: 'Ba ván tiếp theo nhận gấp đôi điểm mùa; hiệu lực 7 ngày.' },
  { id: 'streak_guard', type: 'consumable', name: 'Thẻ Giữ Chuỗi', effect: 'checkin_streak_guard', rarity: 'rare', price: shopPrice(900), stackable: true, tradeable: true, description: 'Tự bảo vệ chuỗi điểm danh nếu bỏ lỡ đúng một ngày; hiệu lực 30 ngày.' },
  { id: 'common_chest', type: 'chest', name: 'Hòm Sanctuary', effect: 'open_common_chest', rarity: 'common', price: shopPrice(1000), stackable: true, tradeable: true, description: 'Mở thẻ sưu tập; vật phẩm trùng đổi thành Mảnh linh hồn.' },
  { id: 'premium_chest', type: 'chest', name: 'Hòm Nephalem', effect: 'open_premium_chest', rarity: 'epic', price: shopPrice(5000), stackable: true, tradeable: true, description: 'Tỷ lệ cao nhận thẻ Epic, Legendary hoặc Mythic.' },
  { id: 'boss_cache', type: 'chest', name: 'Hòm Trophy Hunter', effect: 'open_boss_chest', collectionPool: 'boss', minimumRarity: 'rare', rarity: 'epic', price: shopPrice(4500), stackable: true, tradeable: true, description: 'Chỉ mở thẻ boss, tối thiểu Rare.' },
  { id: 'charm_cache', type: 'chest', name: 'Hòm Charm Sanctuary', effect: 'open_charm_chest', collectionPool: 'charm', minimumRarity: 'rare', rarity: 'epic', price: shopPrice(5500), stackable: true, tradeable: true, description: 'Chỉ mở thẻ charm Median XL, tối thiểu Rare.' },
  { id: 'set_cache', type: 'chest', name: 'Hòm Sacred Set', effect: 'open_set_chest', collectionPool: 'set', minimumRarity: 'rare', rarity: 'epic', price: shopPrice(5000), stackable: true, tradeable: true, description: 'Chỉ mở thẻ Sacred Set, tối thiểu Rare.' },
  { id: 'soul_shard', type: 'material', name: 'Mảnh Linh Hồn', effect: 'craft_material', rarity: 'rare', price: 0, stackable: true, tradeable: false, description: 'Nguyên liệu chế tạo thẻ sưu tập còn thiếu.' },
];

const COLLECTIBLES = [
  ['card_baal', 'Thẻ Boss · Baal', 'boss', 'rare', 80],
  ['card_belial', 'Thẻ Boss · Belial', 'boss', 'epic', 180],
  ['card_lucion', 'Thẻ Boss · Lucion', 'boss', 'legendary', 420],
  ['card_deimoss', 'Thẻ Boss · Deimoss', 'boss', 'mythic', 900],
  ['class_amazon', 'Huy Hiệu · Amazon', 'class', 'common', 45],
  ['class_assassin', 'Huy Hiệu · Assassin', 'class', 'common', 45],
  ['class_barbarian', 'Huy Hiệu · Barbarian', 'class', 'common', 45],
  ['class_druid', 'Huy Hiệu · Druid', 'class', 'common', 45],
  ['class_necromancer', 'Huy Hiệu · Necromancer', 'class', 'common', 45],
  ['class_paladin', 'Huy Hiệu · Paladin', 'class', 'common', 45],
  ['class_sorceress', 'Huy Hiệu · Sorceress', 'class', 'common', 45],
  ['pet_edryem', 'Pet · Edyrem', 'pet', 'rare', 100],
  ['pet_nephalem', 'Pet · Nephalem Spirit', 'pet', 'legendary', 500],
  ['relic_sunstone', 'Relic · Sunstone', 'relic', 'epic', 220],
  ['relic_worldstone', 'Relic · Worldstone Shard', 'relic', 'mythic', 1000],
  ['boss_butcher', 'Thẻ Boss · The Butcher', 'boss', 'rare', 90],
  ['boss_akarat', 'Thẻ Boss · Akarat', 'boss', 'rare', 110],
  ['boss_tal_rasha', 'Thẻ Boss · Tal Rasha', 'boss', 'epic', 220],
  ['boss_bartuc', 'Thẻ Boss · Bartuc', 'boss', 'epic', 260],
  ['boss_azmodan', 'Thẻ Boss · Azmodan', 'boss', 'legendary', 520],
  ['boss_astrogha', 'Thẻ Boss · Astrogha', 'boss', 'legendary', 600],
  ['boss_bull_prince_rodeo', 'Thẻ Boss · Bull Prince Rodeo', 'boss', 'epic', 300],
  ['boss_phoboss', 'Thẻ Boss · Phoboss', 'boss', 'mythic', 1100],
  ['charm_sunstone', 'Charm · Sunstone of the Twin Seas', 'charm', 'rare', 100],
  ['charm_scroll_of_kings', 'Charm · Scroll of Kings', 'charm', 'rare', 120],
  ['charm_horazons_focus', "Charm · Horazon's Focus", 'charm', 'rare', 140],
  ['charm_visions_of_akarat', 'Charm · Visions of Akarat', 'charm', 'epic', 220],
  ['charm_worldstone_key', 'Charm · Sacred Worldstone Key', 'charm', 'epic', 280],
  ['charm_moon_spider', 'Charm · Moon of the Spider', 'charm', 'epic', 320],
  ['charm_fools_gold', "Charm · Fool's Gold", 'charm', 'rare', 180],
  ['charm_black_road', 'Charm · The Black Road', 'charm', 'legendary', 520],
  ['charm_legacy_of_blood', 'Charm · Legacy of Blood', 'charm', 'legendary', 620],
  ['charm_paragons_hammer', "Charm · Paragon's Hammer", 'charm', 'legendary', 700],
  ['charm_dimensional_key', 'Charm · Dimensional Key', 'charm', 'mythic', 1200],
  ['set_pantheon', 'Sacred Set · Pantheon', 'set', 'rare', 160],
  ['set_celestias_myth', "Sacred Set · Celestia's Myth", 'set', 'epic', 300],
  ['set_yshari', 'Sacred Set · Yshari', 'set', 'legendary', 650],
].map(([id, name, collection, rarity, craftCost]) => ({
  id, type: 'collectible', name, collection, rarity, craftCost, price: 0,
  stackable: false, tradeable: true, effect: 'collection', description: `${rarity.toUpperCase()} · Bộ sưu tập ${collection}.`,
}));

const COSMETICS = PROFILE_COSMETICS.map(item => ({
  ...item,
  rarity: item.rarity || 'rare',
  price: shopPrice(10000),
  shopEligible: !DEFAULT_PROFILE_ITEMS.has(item.id),
  stackable: false,
  tradeable: false,
  effect: `profile_${item.type}`,
  description: 'Đổi màu chủ đạo của thẻ /hoso.',
}));

const CATALOG = Object.freeze([...COSMETICS, ...UTILITY_ITEMS, ...COLLECTIBLES]);
const BY_ID = new Map(CATALOG.map(item => [item.id, item]));

function getCatalogItem(id) { return BY_ID.get(String(id)) || null; }
function listCatalog({ shopEligible = false, collectible = false } = {}) {
  if (collectible) return COLLECTIBLES;
  if (shopEligible) return CATALOG.filter(item => item.price > 0 && item.shopEligible !== false && item.type !== 'material' && item.type !== 'collectible');
  return CATALOG;
}

module.exports = { RARITY, DEFAULT_PRICE_MULTIPLIER, CATALOG, COSMETICS, UTILITY_ITEMS, COLLECTIBLES, getCatalogItem, listCatalog };

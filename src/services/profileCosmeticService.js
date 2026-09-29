const { db } = require('../db');

const CATALOG = Object.freeze([
  { id: 'color_blood', type: 'color', name: 'Blood Red', value: '#ef4444' },
  { id: 'color_arcane', type: 'color', name: 'Arcane Violet', value: '#a855f7', rarity: 'epic' },
  { id: 'color_frost', type: 'color', name: 'Frost Blue', value: '#38bdf8' },
  { id: 'color_poison', type: 'color', name: 'Poison Green', value: '#22c55e' },
  { id: 'color_gold', type: 'color', name: 'Sacred Gold', value: '#fbbf24' },
  { id: 'color_worldstone', type: 'color', name: 'Worldstone Cyan', value: '#22d3ee', rarity: 'epic' },
  { id: 'color_triune', type: 'color', name: 'Triune Rose', value: '#f472b6', rarity: 'epic' },
  { id: 'color_toraja', type: 'color', name: 'Toraja Emerald', value: '#34d399' },
]);

const BY_ID = new Map(CATALOG.map(item => [item.id, item]));
const DEFAULT_IDS = Object.freeze(['color_blood']);
const grantStatement = db.prepare(`INSERT OR IGNORE INTO profile_cosmetics
  (guild_id, user_id, cosmetic_id, acquired_at) VALUES (?, ?, ?, ?)`);
const loadoutStatement = db.prepare('SELECT * FROM profile_loadouts WHERE guild_id = ? AND user_id = ?');

// Retire the old title, badge, frame and background system from existing databases.
db.transaction(() => {
  db.prepare("DELETE FROM profile_cosmetics WHERE cosmetic_id LIKE 'title_%' OR cosmetic_id LIKE 'badge_%' OR cosmetic_id LIKE 'frame_%' OR cosmetic_id LIKE 'background_%'").run();
  db.prepare("DELETE FROM user_inventory WHERE item_id LIKE 'title_%' OR item_id LIKE 'badge_%' OR item_id LIKE 'frame_%' OR item_id LIKE 'background_%'").run();
  db.prepare("DELETE FROM shop_items WHERE cosmetic_id LIKE 'title_%' OR cosmetic_id LIKE 'badge_%' OR cosmetic_id LIKE 'frame_%' OR cosmetic_id LIKE 'background_%'").run();
})();

const ensureProfileTx = db.transaction((guildId, userId, now) => {
  grantStatement.run(guildId, userId, 'color_blood', now);
  db.prepare(`INSERT OR IGNORE INTO user_inventory
    (guild_id,user_id,item_id,quantity,acquired_at,updated_at) VALUES (?,?,'color_blood',1,?,?)`)
    .run(guildId, userId, now, now);
  db.prepare(`INSERT OR IGNORE INTO profile_loadouts
    (guild_id,user_id,color_id,updated_at) VALUES (?,?,'color_blood',?)`).run(guildId, userId, now);
  return loadoutStatement.get(guildId, userId);
});

function ensureProfile(guildId, userId, now = Date.now()) {
  return ensureProfileTx(String(guildId), String(userId), now);
}

function ownsCosmetic(guildId, userId, cosmeticId) {
  return Boolean(db.prepare('SELECT 1 FROM profile_cosmetics WHERE guild_id=? AND user_id=? AND cosmetic_id=?')
    .get(String(guildId), String(userId), String(cosmeticId)));
}

function getCosmetic(cosmeticId) { return BY_ID.get(String(cosmeticId)) || null; }

function grantCosmetic(guildId, userId, cosmeticId, now = Date.now()) {
  const item = getCosmetic(cosmeticId);
  if (!item) throw new Error('UNKNOWN_COSMETIC');
  ensureProfile(guildId, userId, now);
  const result = grantStatement.run(String(guildId), String(userId), item.id, now);
  return { item, newlyOwned: result.changes > 0 };
}

function equipCosmetic(guildId, userId, cosmeticId, now = Date.now()) {
  const item = getCosmetic(cosmeticId);
  if (!item || item.type !== 'color') throw new Error('UNKNOWN_COSMETIC');
  ensureProfile(guildId, userId, now);
  if (!ownsCosmetic(guildId, userId, item.id)) throw new Error('COSMETIC_NOT_OWNED');
  db.prepare('UPDATE profile_loadouts SET color_id=?,updated_at=? WHERE guild_id=? AND user_id=?')
    .run(item.id, now, String(guildId), String(userId));
  return getProfileAppearance(guildId, userId);
}

function getOwnedCosmetics(guildId, userId) {
  ensureProfile(guildId, userId);
  return db.prepare('SELECT cosmetic_id,acquired_at FROM profile_cosmetics WHERE guild_id=? AND user_id=? ORDER BY acquired_at,cosmetic_id')
    .all(String(guildId), String(userId)).map(row => ({ ...row, item: getCosmetic(row.cosmetic_id) })).filter(row => row.item);
}

function getProfileAppearance(guildId, userId) {
  const row = ensureProfile(guildId, userId);
  return { color: getCosmetic(row.color_id) || getCosmetic('color_blood') };
}

module.exports = { CATALOG, DEFAULT_IDS, getCosmetic, getProfileAppearance, getOwnedCosmetics, grantCosmetic, equipCosmetic, ownsCosmetic };

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');
dotenv.config();

const dbPath = path.resolve(process.env.DB_PATH || './data/median-xl.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Remove the retired item-request feature and its stored data from existing databases.
db.exec('DROP TABLE IF EXISTS cin_requests; DROP TABLE IF EXISTS cin_settings;');

db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_slug TEXT NOT NULL,
  source_type TEXT NOT NULL,
  type_code TEXT NOT NULL,
  name TEXT NOT NULL,
  base_type TEXT,
  group_name TEXT,
  tier_or_variant TEXT,
  requirements_json TEXT NOT NULL DEFAULT '{}',
  stats_json TEXT NOT NULL DEFAULT '[]',
  socket_count INTEGER,
  limit_per_item INTEGER,
  apply_text TEXT,
  image_url TEXT,
  source_url TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  search_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_slug, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type_code);
CREATE INDEX IF NOT EXISTS idx_items_search ON items(search_text);

CREATE TABLE IF NOT EXISTS economy_accounts (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 1000 CHECK(balance >= 0),
  last_daily_at INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_economy_leaderboard ON economy_accounts(guild_id, balance DESC);

CREATE TABLE IF NOT EXISTS economy_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_created ON economy_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(guild_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_cosmetics (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_cosmetics_user ON profile_cosmetics(guild_id, user_id);

CREATE TABLE IF NOT EXISTS profile_loadouts (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  color_id TEXT NOT NULL DEFAULT 'color_blood',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS shop_items (
  guild_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 1 AND price <= 100000000),
  stock INTEGER CHECK(stock IS NULL OR stock >= 0),
  sold_count INTEGER NOT NULL DEFAULT 0,
  min_games INTEGER NOT NULL DEFAULT 0 CHECK(min_games >= 0),
  min_wins INTEGER NOT NULL DEFAULT 0 CHECK(min_wins >= 0),
  min_balance INTEGER NOT NULL DEFAULT 0 CHECK(min_balance >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent >= 0 AND discount_percent <= 90),
  discount_ends_at INTEGER,
  listed INTEGER NOT NULL DEFAULT 1 CHECK(listed IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, item_id),
  UNIQUE (guild_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(guild_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_created ON shop_purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_user ON shop_purchases(guild_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_inventory (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  acquired_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(guild_id, user_id, quantity DESC);

CREATE TABLE IF NOT EXISTS user_item_effects (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  effect_id TEXT NOT NULL,
  charges INTEGER NOT NULL DEFAULT 0 CHECK(charges >= 0),
  expires_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, effect_id)
);

CREATE TABLE IF NOT EXISTS shop_settings (
  guild_id TEXT PRIMARY KEY,
  rotation_size INTEGER NOT NULL DEFAULT 8 CHECK(rotation_size BETWEEN 6 AND 10),
  next_rotation_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_requests (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  requester_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 1 AND amount <= 100000),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coin_requests_requester ON coin_requests(guild_id, requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_requests_expiry ON coin_requests(status, expires_at);

CREATE TABLE IF NOT EXISTS game_channels (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game),
  UNIQUE (guild_id, channel_id)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game)
);

CREATE TABLE IF NOT EXISTS word_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  phrase TEXT NOT NULL,
  normalized_phrase TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  UNIQUE(guild_id, normalized_phrase)
);
CREATE INDEX IF NOT EXISTS idx_word_suggestions_queue ON word_suggestions(guild_id, status, created_at);

CREATE TABLE IF NOT EXISTS game_player_stats (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  user_id TEXT NOT NULL,
  played INTEGER NOT NULL DEFAULT 0 CHECK(played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK(wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK(losses >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK(draws >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game, user_id)
);
CREATE INDEX IF NOT EXISTS idx_game_player_leaderboard ON game_player_stats(guild_id, game, wins DESC, played ASC);

CREATE TABLE IF NOT EXISTS game_rewards (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  reward INTEGER NOT NULL CHECK(reward >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game)
);

CREATE TABLE IF NOT EXISTS game_bet_limits (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  max_bet INTEGER NOT NULL CHECK(max_bet >= 10 AND max_bet <= 100000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game)
);

CREATE TABLE IF NOT EXISTS multiplayer_rounds (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  closes_at INTEGER NOT NULL,
  result_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rounds_active ON multiplayer_rounds(guild_id, game, status, closes_at);

CREATE TABLE IF NOT EXISTS multiplayer_bets (
  round_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, user_id, choice),
  FOREIGN KEY (round_id) REFERENCES multiplayer_rounds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_bets_round ON multiplayer_bets(round_id, user_id);

CREATE TABLE IF NOT EXISTS blackjack_sessions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_blackjack_channel ON blackjack_sessions(guild_id, channel_id);

CREATE TABLE IF NOT EXISTS mines_sessions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mines_channel ON mines_sessions(guild_id, channel_id);

CREATE TABLE IF NOT EXISTS hardcore_sessions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_hardcore_channel ON hardcore_sessions(guild_id, channel_id);

CREATE TABLE IF NOT EXISTS hardcore_records (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  best_floor INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  escapes INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_hardcore_leaderboard ON hardcore_records(guild_id, best_floor DESC, completions DESC);

CREATE TABLE IF NOT EXISTS player_progress (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  daily_key TEXT NOT NULL DEFAULT '',
  daily_json TEXT NOT NULL DEFAULT '{}',
  daily_claimed_json TEXT NOT NULL DEFAULT '[]',
  weekly_key TEXT NOT NULL DEFAULT '',
  weekly_json TEXT NOT NULL DEFAULT '{}',
  weekly_claimed_json TEXT NOT NULL DEFAULT '[]',
  streak INTEGER NOT NULL DEFAULT 0,
  last_checkin_key TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS season_scores (
  guild_id TEXT NOT NULL,
  season_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, season_key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_season_leaderboard ON season_scores(guild_id, season_key, points DESC, wins DESC);

CREATE TABLE IF NOT EXISTS season_claims (
  guild_id TEXT NOT NULL,
  season_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, season_key, user_id)
);

CREATE TABLE IF NOT EXISTS server_events (
  guild_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  max_hp INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  defeated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, event_key)
);

CREATE TABLE IF NOT EXISTS server_event_contributions (
  guild_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, event_key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_damage ON server_event_contributions(guild_id, event_key, damage DESC);

`);

// Seed per-game rankings once from retained transaction history. New results are
// written directly by progressionService, while INSERT OR IGNORE prevents repeats.
db.exec(`WITH parsed AS (
  SELECT guild_id,user_id,amount,created_at,
    substr(reason,1,instr(reason,':')-1) AS game,
    substr(reason,instr(reason,':')+1) AS outcome
  FROM economy_transactions WHERE instr(reason,':')>0
)
INSERT OR IGNORE INTO game_player_stats(guild_id,game,user_id,played,wins,losses,draws,updated_at)
SELECT guild_id,game,user_id,COUNT(*),SUM(outcome='win'),SUM(outcome='loss'),SUM(outcome='draw'),MAX(created_at)
FROM parsed WHERE game IN ('noitu','vuatiengviet','doanitem','baucua','taixiu','oantuti','blackjack','duangua','mines','hardcore')
  AND outcome IN ('win','loss','draw')
GROUP BY guild_id,game,user_id;`);

// Retire the player market. Return escrowed items before removing its data.
const marketTableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_listings'").get();
if (marketTableExists) {
  db.transaction(() => {
    const now = Date.now();
    db.prepare(`INSERT INTO user_inventory (guild_id,user_id,item_id,quantity,acquired_at,updated_at)
      SELECT guild_id,seller_id,item_id,quantity,?,? FROM market_listings WHERE status='open'
      ON CONFLICT(guild_id,user_id,item_id) DO UPDATE SET
        quantity=user_inventory.quantity+excluded.quantity,updated_at=excluded.updated_at`).run(now, now);
    db.exec('DROP TABLE market_listings');
  })();
}

// Lightweight migrations for databases created before the rotating shop fields existed.
const shopColumns = new Set(db.prepare('PRAGMA table_info(shop_items)').all().map(column => column.name));
if (!shopColumns.has('discount_percent')) db.exec('ALTER TABLE shop_items ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent >= 0 AND discount_percent <= 90)');
if (!shopColumns.has('discount_ends_at')) db.exec('ALTER TABLE shop_items ADD COLUMN discount_ends_at INTEGER');
if (!shopColumns.has('listed')) db.exec('ALTER TABLE shop_items ADD COLUMN listed INTEGER NOT NULL DEFAULT 1 CHECK(listed IN (0, 1))');

// Collapse legacy profile decoration loadouts to the single supported color setting.
const profileColumns = new Set(db.prepare('PRAGMA table_info(profile_loadouts)').all().map(column => column.name));
if (profileColumns.has('title_id') || profileColumns.has('frame_id') || profileColumns.has('background_id') || profileColumns.has('badges_json')) {
  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS profile_loadouts_color_v2;
      CREATE TABLE profile_loadouts_color_v2 (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        color_id TEXT NOT NULL DEFAULT 'color_blood',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
      INSERT INTO profile_loadouts_color_v2 (guild_id,user_id,color_id,updated_at)
      SELECT guild_id,user_id,color_id,updated_at FROM profile_loadouts;
      DROP TABLE profile_loadouts;
      ALTER TABLE profile_loadouts_color_v2 RENAME TO profile_loadouts;
    `);
  })();
}

// Expand the original 100,000 xu price ceiling without losing existing shop configuration.
const shopTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='shop_items'").get()?.sql || '';
if (!/price\s*<=\s*100000000/i.test(shopTableSql)) {
  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS shop_items_price_v2;
      CREATE TABLE shop_items_price_v2 (
        guild_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        cosmetic_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        price INTEGER NOT NULL CHECK(price >= 1 AND price <= 100000000),
        stock INTEGER CHECK(stock IS NULL OR stock >= 0),
        sold_count INTEGER NOT NULL DEFAULT 0,
        min_games INTEGER NOT NULL DEFAULT 0 CHECK(min_games >= 0),
        min_wins INTEGER NOT NULL DEFAULT 0 CHECK(min_wins >= 0),
        min_balance INTEGER NOT NULL DEFAULT 0 CHECK(min_balance >= 0),
        discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent >= 0 AND discount_percent <= 90),
        discount_ends_at INTEGER,
        listed INTEGER NOT NULL DEFAULT 1 CHECK(listed IN (0, 1)),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, item_id),
        UNIQUE (guild_id, cosmetic_id)
      );
      INSERT INTO shop_items_price_v2
        (guild_id,item_id,cosmetic_id,display_name,price,stock,sold_count,min_games,min_wins,min_balance,
         discount_percent,discount_ends_at,listed,active,created_by,created_at,updated_at)
      SELECT guild_id,item_id,cosmetic_id,display_name,price,stock,sold_count,min_games,min_wins,min_balance,
         discount_percent,discount_ends_at,listed,active,created_by,created_at,updated_at FROM shop_items;
      DROP TABLE shop_items;
      ALTER TABLE shop_items_price_v2 RENAME TO shop_items;
      CREATE INDEX idx_shop_items_active ON shop_items(guild_id, active, updated_at DESC);
    `);
  })();
}

const insertItemStatement = db.prepare(`INSERT INTO items (
  source_slug, source_type, type_code, name, base_type, group_name, tier_or_variant,
  requirements_json, stats_json, socket_count, limit_per_item, apply_text, image_url,
  source_url, raw_text, search_text, content_hash, updated_at
) VALUES (
  @source_slug, @source_type, @type_code, @name, @base_type, @group_name, @tier_or_variant,
  @requirements_json, @stats_json, @socket_count, @limit_per_item, @apply_text, @image_url,
  @source_url, @raw_text, @search_text, @content_hash, @updated_at
)`);

function serializeItem(item) {
  return {
    ...item,
    base_type: item.base_type ?? null,
    group_name: item.group_name ?? null,
    tier_or_variant: item.tier_or_variant ?? null,
    requirements_json: JSON.stringify(item.requirements || {}),
    stats_json: JSON.stringify(item.stats || []),
    socket_count: item.socket_count ?? null,
    limit_per_item: item.limit_per_item ?? null,
    apply_text: item.apply_text ?? null,
    image_url: item.image_url ?? null,
  };
}

function hydrateItem(row) {
  if (!row) return null;
  let requirements = {};
  let stats = [];
  try { requirements = JSON.parse(row.requirements_json || '{}'); } catch { requirements = {}; }
  try { stats = JSON.parse(row.stats_json || '[]'); } catch { stats = []; }
  return { ...row, requirements, stats };
}

const replaceSourceTx = db.transaction((sourceSlug, items) => {
  db.prepare('DELETE FROM items WHERE source_slug = ?').run(String(sourceSlug));
  for (const item of items) insertItemStatement.run(serializeItem(item));
  return items.length;
});

function replaceSource(sourceSlug, items) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  return replaceSourceTx(String(sourceSlug), items);
}

function countItems() {
  return db.prepare('SELECT type_code, COUNT(*) AS count FROM items GROUP BY type_code ORDER BY type_code').all();
}

function countSource(sourceSlug) {
  return db.prepare('SELECT COUNT(*) AS count FROM items WHERE source_slug = ?').get(String(sourceSlug)).count;
}

function searchItems({ query = '', type = 'ALL', limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 10_000));
  const normalizedType = String(type || 'ALL').toUpperCase();
  const normalizedQuery = String(query || '').trim();
  const pattern = `%${normalizedQuery}%`;
  const rows = normalizedType === 'ALL'
    ? db.prepare('SELECT * FROM items WHERE search_text LIKE ? ORDER BY name COLLATE NOCASE, id LIMIT ?').all(pattern, safeLimit)
    : db.prepare('SELECT * FROM items WHERE type_code = ? AND search_text LIKE ? ORDER BY name COLLATE NOCASE, id LIMIT ?').all(normalizedType, pattern, safeLimit);
  return rows.map(hydrateItem);
}

function getItemById(id) {
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return hydrateItem(db.prepare('SELECT * FROM items WHERE id = ?').get(value));
}

module.exports = { db, dbPath, replaceSource, countItems, countSource, searchItems, getItemById };

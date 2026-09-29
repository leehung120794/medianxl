const { db } = require('../db');

const REWARD_GAMES = Object.freeze(['noitu', 'vuatiengviet', 'doanitem']);

function envReward(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000 ? value : fallback;
}

const DEFAULT_REWARDS = Object.freeze({
  noitu: envReward('NOITU_REWARD', 20),
  vuatiengviet: envReward('VUATIENGVIET_REWARD', 25),
  doanitem: envReward('DOANITEM_REWARD', 50),
});

db.transaction(() => {
  const legacy = db.prepare("SELECT guild_id, reward FROM game_rewards WHERE game = 'doanruneword'").all();
  const existing = db.prepare("SELECT 1 FROM game_rewards WHERE guild_id = ? AND game = 'doanitem'");
  const insert = db.prepare("INSERT OR IGNORE INTO game_rewards (guild_id, game, reward, updated_at) VALUES (?, 'doanitem', ?, ?)");
  for (const row of legacy) if (!existing.get(row.guild_id)) insert.run(row.guild_id, row.reward, Date.now());
  db.prepare("DELETE FROM game_rewards WHERE game = 'doanruneword'").run();
})();

function getGameReward(guildId, game) {
  if (!REWARD_GAMES.includes(game)) throw new Error('INVALID_REWARD_GAME');
  const row = db.prepare('SELECT reward FROM game_rewards WHERE guild_id = ? AND game = ?').get(String(guildId), game);
  return row ? row.reward : DEFAULT_REWARDS[game];
}

function setGameReward(guildId, game, reward) {
  if (!REWARD_GAMES.includes(game)) throw new Error('INVALID_REWARD_GAME');
  const value = Number(reward);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) throw new Error('INVALID_REWARD');
  db.prepare(`INSERT INTO game_rewards (guild_id, game, reward, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, game) DO UPDATE SET reward = excluded.reward, updated_at = excluded.updated_at`)
    .run(String(guildId), game, value, Date.now());
  return value;
}

function listGameRewards(guildId) {
  return REWARD_GAMES.map(game => ({ game, reward: getGameReward(guildId, game) }));
}

module.exports = { REWARD_GAMES, DEFAULT_REWARDS, getGameReward, setGameReward, listGameRewards };

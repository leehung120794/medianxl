const { db } = require('../db');

const GAMES = Object.freeze(['noitu', 'baucua', 'oantuti', 'taixiu', 'blackjack', 'duangua', 'mines', 'hardcore', 'vuatiengviet', 'doanitem']);

db.transaction(() => {
  const legacy = db.prepare("SELECT guild_id, channel_id FROM game_channels WHERE game = 'doanruneword'").all();
  db.prepare("DELETE FROM game_channels WHERE game = 'doanruneword'").run();
  db.prepare("DELETE FROM game_sessions WHERE game = 'doanruneword'").run();
  const existing = db.prepare("SELECT 1 FROM game_channels WHERE guild_id = ? AND game = 'doanitem'");
  const insert = db.prepare("INSERT OR IGNORE INTO game_channels (guild_id, game, channel_id, updated_at) VALUES (?, 'doanitem', ?, ?)");
  for (const row of legacy) if (!existing.get(row.guild_id)) insert.run(row.guild_id, row.channel_id, Date.now());
})();

function setGameChannel(guildId, game, channelId) {
  if (!GAMES.includes(game)) throw new Error('INVALID_GAME');
  const conflict = db.prepare('SELECT game FROM game_channels WHERE guild_id = ? AND channel_id = ? AND game <> ?')
    .get(String(guildId), String(channelId), game);
  if (conflict) {
    const error = new Error('CHANNEL_IN_USE');
    error.game = conflict.game;
    throw error;
  }
  db.prepare(`INSERT INTO game_channels (guild_id, game, channel_id, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, game) DO UPDATE SET channel_id = excluded.channel_id, updated_at = excluded.updated_at`)
    .run(String(guildId), game, String(channelId), Date.now());
  return getGameChannel(guildId, game);
}

function getGameChannel(guildId, game) {
  return db.prepare('SELECT * FROM game_channels WHERE guild_id = ? AND game = ?').get(String(guildId), game) || null;
}

function listGameChannels(guildId) {
  return db.prepare('SELECT * FROM game_channels WHERE guild_id = ? ORDER BY game').all(String(guildId));
}

function getGameByChannel(guildId, channelId) {
  return db.prepare('SELECT * FROM game_channels WHERE guild_id = ? AND channel_id = ?').get(String(guildId), String(channelId)) || null;
}

module.exports = { GAMES, setGameChannel, getGameChannel, listGameChannels, getGameByChannel };

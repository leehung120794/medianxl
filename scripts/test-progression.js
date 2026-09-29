const assert = require('node:assert/strict');
const { db } = require('../src/db');
const economy = require('../src/services/economyService');
const progression = require('../src/services/progressionService');
const shop = require('../src/services/shopService');
const effects = require('../src/services/itemEffectService');
const effectState = require('../src/services/effectStateService');

const guildId = `test-progression-${Date.now()}`;
const buyer = 'buyer'; const streakUser = 'streak-user';
try {
  economy.getAccount(guildId, buyer);
  db.prepare('UPDATE economy_accounts SET balance=1000000 WHERE guild_id=? AND user_id=?').run(guildId, buyer);

  for (let i = 0; i < 3; i += 1) economy.rewardGame({ guildId, userId: buyer, amount: 100, game: 'doanitem', outcome: 'win' });
  const progress = progression.getProgress(guildId, buyer);
  assert(progress.daily.every(mission => mission.complete), 'three quiz wins should complete all daily missions');
  const rewards = progression.claimMissions(guildId, buyer);
  assert.equal(rewards.length, 3);
  assert.equal(progression.claimMissions(guildId, buyer).length, 0, 'mission rewards must only be claimed once');

  const checkin = progression.checkIn(guildId, buyer);
  assert(checkin.ok && checkin.streak === 1 && checkin.coins === 20000);
  assert.equal(progression.checkIn(guildId, buyer).ok, false, 'daily check-in must only work once');

  const firstDay = Date.UTC(2026, 0, 1, 5);
  const streakResults = Array.from({ length: 8 }, (_, index) => progression.checkIn(guildId, streakUser, firstDay + index * 86_400_000));
  assert.deepEqual(streakResults.map(result => result.streak), [1, 2, 3, 4, 5, 6, 7, 1], 'check-in rewards must restart after day seven');
  assert.equal(shop.getInventoryQuantity(guildId, streakUser, 'common_chest'), 1, 'seven-day chest must not repeat every following day');

  shop.addInventory(guildId, buyer, 'boss_fury', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'boss_fury' });
  assert.equal(effectState.getActiveEffect(guildId, buyer, 'boss_damage_boost').charges, 3);
  const before = progression.getBoss(guildId, buyer);
  economy.rewardGame({ guildId, userId: buyer, amount: 1000, game: 'doanitem', outcome: 'win' });
  const after = progression.getBoss(guildId, buyer);
  assert(before.hp - after.hp >= 40, 'boss boost should double damage for the next win');
  assert.equal(effectState.getActiveEffect(guildId, buyer, 'boss_damage_boost').charges, 2);

  const season = progression.getSeasonLeaderboard(guildId);
  assert.equal(season[0].user_id, buyer);
  const [year, month] = progression.seasonKey().split('-').map(Number);
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousSeason = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, '0')}`;
  db.prepare('INSERT INTO season_scores (guild_id,season_key,user_id,points,games,wins,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(guildId, previousSeason, buyer, 999, 50, 40, Date.now());
  const seasonReward = progression.claimSeasonReward(guildId, buyer);
  assert.equal(seasonReward.rank, 1);
  assert.throws(() => progression.claimSeasonReward(guildId, buyer), /ALREADY_CLAIMED/);
  assert.equal(economy.getEconomyStats(guildId).users, 2);
  console.log(JSON.stringify({ ok: true, missions: rewards.length, seasonPoints: season[0].points, bossHp: after.hp }));
} finally {
  for (const table of ['server_event_contributions','server_events','season_claims','season_scores','player_progress','game_player_stats','user_item_effects','user_inventory','economy_transactions','economy_accounts']) {
    db.prepare(`DELETE FROM ${table} WHERE guild_id=?`).run(guildId);
  }
}

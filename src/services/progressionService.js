const { db } = require('../db');

const DAY_MS = 86_400_000;
const TIME_ZONE = process.env.ECONOMY_TIME_ZONE || 'Asia/Bangkok';
const BOSS_HP = 10_000;
const BOSSES = ['Baal', 'Belial', 'Lucion', 'Astrogha', 'Deimoss'];

const DAILY_MISSIONS = Object.freeze([
  { id: 'play3', label: 'Chơi 3 ván', field: 'games', target: 3, coins: 30_000 },
  { id: 'win2', label: 'Thắng 2 ván', field: 'wins', target: 2, coins: 50_000 },
  { id: 'quiz2', label: 'Trả lời đúng 2 câu đố', field: 'quizWins', target: 2, item: 'hint_charm', quantity: 1 },
]);
const WEEKLY_MISSIONS = Object.freeze([
  { id: 'play20', label: 'Chơi 20 ván', field: 'games', target: 20, coins: 150_000 },
  { id: 'win10', label: 'Thắng 10 ván', field: 'wins', target: 10, coins: 250_000 },
  { id: 'quiz10', label: 'Trả lời đúng 10 câu đố', field: 'quizWins', target: 10, item: 'common_chest', quantity: 1 },
]);

function localParts(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date(now));
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
function dayKey(now = Date.now()) {
  const p = localParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}
function weekKey(now = Date.now()) {
  const p = localParts(now);
  const date = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}
function seasonKey(now = Date.now()) { return dayKey(now).slice(0, 7); }
function json(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function emptyCounters() { return { games: 0, wins: 0, quizWins: 0, wagered: 0 }; }

function ensureProgress(guildId, userId, now = Date.now()) {
  const guild = String(guildId); const user = String(userId); const daily = dayKey(now); const weekly = weekKey(now);
  db.prepare(`INSERT OR IGNORE INTO player_progress
    (guild_id,user_id,daily_key,daily_json,daily_claimed_json,weekly_key,weekly_json,weekly_claimed_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(guild, user, daily, JSON.stringify(emptyCounters()), '[]', weekly, JSON.stringify(emptyCounters()), '[]', now);
  let row = db.prepare('SELECT * FROM player_progress WHERE guild_id=? AND user_id=?').get(guild, user);
  if (row.daily_key !== daily) {
    db.prepare("UPDATE player_progress SET daily_key=?,daily_json='{}',daily_claimed_json='[]',updated_at=? WHERE guild_id=? AND user_id=?")
      .run(daily, now, guild, user);
  }
  if (row.weekly_key !== weekly) {
    db.prepare("UPDATE player_progress SET weekly_key=?,weekly_json='{}',weekly_claimed_json='[]',updated_at=? WHERE guild_id=? AND user_id=?")
      .run(weekly, now, guild, user);
  }
  row = db.prepare('SELECT * FROM player_progress WHERE guild_id=? AND user_id=?').get(guild, user);
  return { ...row, daily: { ...emptyCounters(), ...json(row.daily_json, {}) }, weekly: { ...emptyCounters(), ...json(row.weekly_json, {}) },
    dailyClaimed: json(row.daily_claimed_json, []), weeklyClaimed: json(row.weekly_claimed_json, []) };
}

function ensureBoss(guildId, now = Date.now()) {
  const key = weekKey(now); const guild = String(guildId);
  const index = Math.abs([...key].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % BOSSES.length;
  db.prepare(`INSERT OR IGNORE INTO server_events (guild_id,event_key,boss_name,max_hp,hp,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(guild, key, BOSSES[index], BOSS_HP, BOSS_HP, now, now);
  return db.prepare('SELECT * FROM server_events WHERE guild_id=? AND event_key=?').get(guild, key);
}

function recordGameEvent({ guildId, userId, game, outcome, amount = 0, stake = 0, now = Date.now() }) {
  if (!guildId || !userId || !['win', 'loss', 'draw'].includes(outcome)) return null;
  const progress = ensureProgress(guildId, userId, now);
  const quizWin = outcome === 'win' && ['noitu', 'vuatiengviet', 'doanitem'].includes(String(game));
  for (const counters of [progress.daily, progress.weekly]) {
    counters.games += 1;
    if (outcome === 'win') counters.wins += 1;
    if (quizWin) counters.quizWins += 1;
    counters.wagered += Math.max(0, Math.floor(Number(stake) || 0));
  }
  db.prepare('UPDATE player_progress SET daily_json=?,weekly_json=?,updated_at=? WHERE guild_id=? AND user_id=?')
    .run(JSON.stringify(progress.daily), JSON.stringify(progress.weekly), now, String(guildId), String(userId));

  const seasonBoosted = require('./effectStateService').consumeActiveEffect(guildId, userId, 'season_points_boost');
  const points = (3 + (outcome === 'win' ? 12 : 0)) * (seasonBoosted ? 2 : 1);
  db.prepare(`INSERT INTO season_scores (guild_id,season_key,user_id,points,games,wins,updated_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(guild_id,season_key,user_id) DO UPDATE SET points=points+excluded.points,games=games+1,wins=wins+excluded.wins,updated_at=excluded.updated_at`)
    .run(String(guildId), seasonKey(now), String(userId), points, 1, outcome === 'win' ? 1 : 0, now);

  db.prepare(`INSERT INTO game_player_stats(guild_id,game,user_id,played,wins,losses,draws,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(guild_id,game,user_id) DO UPDATE SET
    played=played+1,wins=wins+excluded.wins,losses=losses+excluded.losses,draws=draws+excluded.draws,updated_at=excluded.updated_at`)
    .run(String(guildId), String(game), String(userId), 1, outcome === 'win' ? 1 : 0,
      outcome === 'loss' ? 1 : 0, outcome === 'draw' ? 1 : 0, now);

  if (outcome === 'win') {
    const boss = ensureBoss(guildId, now);
    if (!boss.defeated_at) {
      const bossBoosted = require('./effectStateService').consumeActiveEffect(guildId, userId, 'boss_damage_boost');
      const damage = Math.max(10, Math.min(1000, (10 + Math.floor(Math.max(0, Number(amount) || 0) / 100)) * (bossBoosted ? 2 : 1)));
      const hp = Math.max(0, boss.hp - damage);
      db.prepare('UPDATE server_events SET hp=?,defeated_at=?,updated_at=? WHERE guild_id=? AND event_key=?')
        .run(hp, hp === 0 ? now : null, now, String(guildId), boss.event_key);
      db.prepare(`INSERT INTO server_event_contributions (guild_id,event_key,user_id,damage,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(guild_id,event_key,user_id) DO UPDATE SET damage=damage+excluded.damage,updated_at=excluded.updated_at`)
        .run(String(guildId), boss.event_key, String(userId), damage, now);
    }
  }
  return getProgress(guildId, userId, now);
}

function missionRows(missions, counters, claimed) {
  return missions.map(mission => ({ ...mission, progress: Math.min(mission.target, counters[mission.field] || 0),
    complete: (counters[mission.field] || 0) >= mission.target, claimed: claimed.includes(mission.id) }));
}
function getProgress(guildId, userId, now = Date.now()) {
  const row = ensureProgress(guildId, userId, now);
  return { streak: row.streak, lastCheckinKey: row.last_checkin_key, dailyKey: row.daily_key, weeklyKey: row.weekly_key,
    daily: missionRows(DAILY_MISSIONS, row.daily, row.dailyClaimed), weekly: missionRows(WEEKLY_MISSIONS, row.weekly, row.weeklyClaimed) };
}

function grantReward(guildId, userId, mission, reason) {
  if (mission.coins) require('./economyService').creditCoins({ guildId, userId, amount: mission.coins, reason });
  if (mission.item) require('./shopService').addInventory(guildId, userId, mission.item, mission.quantity || 1);
}
function claimMissions(guildId, userId, scope = 'all', now = Date.now()) {
  return db.transaction(() => {
    const row = ensureProgress(guildId, userId, now); const rewards = [];
    const claimScope = (missions, counters, claimed, column, label) => {
      for (const mission of missions) {
        if ((counters[mission.field] || 0) < mission.target || claimed.includes(mission.id)) continue;
        grantReward(guildId, userId, mission, `mission:${label}:${mission.id}`); claimed.push(mission.id); rewards.push({ ...mission, scope: label });
      }
      db.prepare(`UPDATE player_progress SET ${column}=?,updated_at=? WHERE guild_id=? AND user_id=?`)
        .run(JSON.stringify(claimed), now, String(guildId), String(userId));
    };
    if (scope === 'all' || scope === 'daily') claimScope(DAILY_MISSIONS, row.daily, row.dailyClaimed, 'daily_claimed_json', 'daily');
    if (scope === 'all' || scope === 'weekly') claimScope(WEEKLY_MISSIONS, row.weekly, row.weeklyClaimed, 'weekly_claimed_json', 'weekly');
    return rewards;
  })();
}

function checkIn(guildId, userId, now = Date.now()) {
  return db.transaction(() => {
    const row = ensureProgress(guildId, userId, now); const today = dayKey(now);
    if (row.last_checkin_key === today) return { ok: false, streak: row.streak };
    const yesterday = dayKey(now - DAY_MS);
    const missedOneDay = row.last_checkin_key === dayKey(now - 2 * DAY_MS);
    const guarded = missedOneDay && require('./effectStateService').consumeActiveEffect(guildId, userId, 'checkin_streak_guard');
    const continued = row.last_checkin_key === yesterday || guarded;
    const streak = continued ? (row.streak >= 7 ? 1 : row.streak + 1) : 1;
    const coins = 20_000 + (streak - 1) * 5_000;
    require('./economyService').creditCoins({ guildId, userId, amount: coins, reason: `checkin:${today}` });
    let item = null;
    if (streak === 7) { item = 'common_chest'; require('./shopService').addInventory(guildId, userId, item, 1); }
    db.prepare('UPDATE player_progress SET streak=?,last_checkin_key=?,updated_at=? WHERE guild_id=? AND user_id=?')
      .run(streak, today, now, String(guildId), String(userId));
    return { ok: true, streak, coins, item, guarded };
  })();
}

function getSeasonLeaderboard(guildId, limit = 10, now = Date.now()) {
  return db.prepare('SELECT * FROM season_scores WHERE guild_id=? AND season_key=? ORDER BY points DESC,wins DESC,updated_at ASC LIMIT ?')
    .all(String(guildId), seasonKey(now), Math.max(1, Math.min(25, Number(limit) || 10)));
}
function getGameLeaderboard(guildId, game, limit = 10) {
  return db.prepare(`SELECT * FROM game_player_stats WHERE guild_id=? AND game=?
    ORDER BY wins DESC,CASE WHEN played>0 THEN wins*1.0/played ELSE 0 END DESC,played ASC,updated_at ASC LIMIT ?`)
    .all(String(guildId), String(game), Math.max(1, Math.min(25, Number(limit) || 10)));
}
function previousSeasonKey(now = Date.now()) {
  const current = seasonKey(now); const [year, month] = current.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function claimSeasonReward(guildId, userId, now = Date.now()) {
  const previous = previousSeasonKey(now); const guild = String(guildId); const user = String(userId);
  if (db.prepare('SELECT 1 FROM season_claims WHERE guild_id=? AND season_key=? AND user_id=?').get(guild, previous, user)) throw new Error('ALREADY_CLAIMED');
  const ranked = db.prepare(`SELECT user_id,ROW_NUMBER() OVER (ORDER BY points DESC,wins DESC,updated_at ASC) rank
    FROM season_scores WHERE guild_id=? AND season_key=? ORDER BY points DESC,wins DESC,updated_at ASC LIMIT 10`).all(guild, previous);
  const own = ranked.find(row => row.user_id === user);
  if (!own) throw new Error('NOT_TOP_TEN');
  const coins = own.rank === 1 ? 1_000_000 : own.rank <= 3 ? 500_000 : 200_000;
  const item = own.rank <= 3 ? 'premium_chest' : 'common_chest';
  db.transaction(() => {
    db.prepare('INSERT INTO season_claims (guild_id,season_key,user_id,rank,claimed_at) VALUES (?,?,?,?,?)').run(guild, previous, user, own.rank, now);
    require('./economyService').creditCoins({ guildId, userId, amount: coins, reason: `season:${previous}:rank:${own.rank}` });
    require('./shopService').addInventory(guildId, userId, item, 1);
  })();
  return { season: previous, rank: own.rank, coins, item };
}
function getBoss(guildId, userId = null, now = Date.now()) {
  const boss = ensureBoss(guildId, now);
  const leaders = db.prepare('SELECT * FROM server_event_contributions WHERE guild_id=? AND event_key=? ORDER BY damage DESC LIMIT 10')
    .all(String(guildId), boss.event_key);
  const own = userId ? db.prepare('SELECT * FROM server_event_contributions WHERE guild_id=? AND event_key=? AND user_id=?').get(String(guildId), boss.event_key, String(userId)) : null;
  return { ...boss, leaders, own };
}
function claimBossReward(guildId, userId, now = Date.now()) {
  const boss = ensureBoss(guildId, now);
  if (!boss.defeated_at) throw new Error('BOSS_ALIVE');
  const contribution = db.prepare('SELECT * FROM server_event_contributions WHERE guild_id=? AND event_key=? AND user_id=?')
    .get(String(guildId), boss.event_key, String(userId));
  if (!contribution?.damage) throw new Error('NO_CONTRIBUTION');
  if (contribution.claimed) throw new Error('ALREADY_CLAIMED');
  db.transaction(() => {
    db.prepare('UPDATE server_event_contributions SET claimed=1,updated_at=? WHERE guild_id=? AND event_key=? AND user_id=?')
      .run(now, String(guildId), boss.event_key, String(userId));
    require('./economyService').creditCoins({ guildId, userId, amount: 100_000, reason: `boss:${boss.event_key}` });
    require('./shopService').addInventory(guildId, userId, 'common_chest', 1);
  })();
  return { coins: 100_000, item: 'common_chest', damage: contribution.damage };
}

function cleanupProgressionData(now = Date.now()) {
  const seasonCutoff = now - 400 * DAY_MS; const eventCutoff = now - 90 * DAY_MS; const inactiveCutoff = now - 365 * DAY_MS;
  return db.transaction(() => ({
    seasonScores: db.prepare('DELETE FROM season_scores WHERE updated_at<?').run(seasonCutoff).changes,
    seasonClaims: db.prepare('DELETE FROM season_claims WHERE claimed_at<?').run(seasonCutoff).changes,
    contributions: db.prepare('DELETE FROM server_event_contributions WHERE updated_at<?').run(eventCutoff).changes,
    events: db.prepare('DELETE FROM server_events WHERE updated_at<?').run(eventCutoff).changes,
    inactiveProgress: db.prepare('DELETE FROM player_progress WHERE updated_at<?').run(inactiveCutoff).changes,
  }))();
}

module.exports = { DAILY_MISSIONS, WEEKLY_MISSIONS, dayKey, weekKey, seasonKey, getProgress, recordGameEvent,
  claimMissions, checkIn, getSeasonLeaderboard, getGameLeaderboard, claimSeasonReward, getBoss, claimBossReward, cleanupProgressionData };

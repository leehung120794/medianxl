const { db } = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;
function integerEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}

const STARTING_COINS = integerEnv('ECONOMY_STARTING_COINS', 1000, 0, 1_000_000);
const DAILY_COINS = integerEnv('ECONOMY_DAILY_COINS', 500, 1, 1_000_000);
const TRANSACTION_RETENTION_DAYS = integerEnv('ECONOMY_LOG_RETENTION_DAYS', 30, 1, 365);
const SHOP_SPEND_MAX = 100_000_000;

const ensureStatement = db.prepare(`
  INSERT OR IGNORE INTO economy_accounts
  (guild_id, user_id, balance, last_daily_at, games_played, wins, losses, draws, created_at, updated_at)
  VALUES (?, ?, ?, 0, 0, 0, 0, 0, ?, ?)
`);
const accountStatement = db.prepare('SELECT * FROM economy_accounts WHERE guild_id = ? AND user_id = ?');
const updateBalanceStatement = db.prepare('UPDATE economy_accounts SET balance = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?');
const updateStatsStatement = db.prepare(`
  UPDATE economy_accounts SET games_played = games_played + 1,
    wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = ?
  WHERE guild_id = ? AND user_id = ?
`);
const transactionStatement = db.prepare(`
  INSERT INTO economy_transactions (guild_id, user_id, amount, balance_after, reason, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function ensureAccount(guildId, userId, now = Date.now()) {
  ensureStatement.run(String(guildId), String(userId), STARTING_COINS, now, now);
  return accountStatement.get(String(guildId), String(userId));
}

function getAccount(guildId, userId) {
  return ensureAccount(guildId, userId);
}

function validAmount(amount, maximum = 100_000) {
  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error('INVALID_AMOUNT');
  return value;
}

const changeBalanceTx = db.transaction(({ guildId, userId, amount, reason, outcome = null }) => {
  const now = Date.now();
  const account = ensureAccount(guildId, userId, now);
  const nextBalance = account.balance + amount;
  if (nextBalance < 0) {
    const error = new Error('INSUFFICIENT_FUNDS');
    error.code = 'INSUFFICIENT_FUNDS';
    error.balance = account.balance;
    throw error;
  }
  updateBalanceStatement.run(nextBalance, now, String(guildId), String(userId));
  if (outcome) updateStatsStatement.run(outcome === 'win' ? 1 : 0, outcome === 'loss' ? 1 : 0, outcome === 'draw' ? 1 : 0, now, String(guildId), String(userId));
  transactionStatement.run(String(guildId), String(userId), amount, nextBalance, String(reason).slice(0, 100), now);
  return { ...account, balance: nextBalance, amount };
});

function settleWithProgress(balanceArgs, progressArgs) {
  return db.transaction(() => {
    const result = changeBalanceTx(balanceArgs);
    require('./progressionService').recordGameEvent(progressArgs);
    return result;
  })();
}

function settleBet({ guildId, userId, stake, payout, game, outcome }) {
  const normalizedStake = Math.floor(Number(stake));
  const normalizedPayout = Math.floor(Number(payout));
  if (!Number.isInteger(normalizedStake) || normalizedStake < 10 || normalizedStake > 100_000) throw new Error('INVALID_BET');
  if (!Number.isInteger(normalizedPayout) || normalizedPayout < 0) throw new Error('INVALID_PAYOUT');
  return settleWithProgress(
    { guildId, userId, amount: normalizedPayout - normalizedStake, reason: `${game}:${outcome}`, outcome },
    { guildId, userId, game, outcome, amount: normalizedPayout, stake: normalizedStake },
  );
}

function spendCoins({ guildId, userId, amount, reason }) {
  const value = validAmount(amount, SHOP_SPEND_MAX);
  return changeBalanceTx({ guildId, userId, amount: -value, reason });
}

const transferCoinsTx = db.transaction(({ guildId, fromUserId, toUserId, amount }) => {
  const value = validAmount(amount);
  if (String(fromUserId) === String(toUserId)) throw new Error('SELF_TRANSFER');
  const now = Date.now();
  const sender = ensureAccount(guildId, fromUserId, now);
  const receiver = ensureAccount(guildId, toUserId, now);
  if (sender.balance < value) {
    const error = new Error('INSUFFICIENT_FUNDS');
    error.code = 'INSUFFICIENT_FUNDS';
    error.balance = sender.balance;
    throw error;
  }
  const senderBalance = sender.balance - value;
  const receiverBalance = receiver.balance + value;
  updateBalanceStatement.run(senderBalance, now, String(guildId), String(fromUserId));
  updateBalanceStatement.run(receiverBalance, now, String(guildId), String(toUserId));
  transactionStatement.run(String(guildId), String(fromUserId), -value, senderBalance, `transfer:to:${toUserId}`.slice(0, 100), now);
  transactionStatement.run(String(guildId), String(toUserId), value, receiverBalance, `transfer:from:${fromUserId}`.slice(0, 100), now);
  return { amount: value, senderBalance, receiverBalance };
});

function transferCoins({ guildId, fromUserId, toUserId, amount }) {
  return transferCoinsTx({ guildId: String(guildId), fromUserId: String(fromUserId), toUserId: String(toUserId), amount });
}

function addCoinsByAdmin({ guildId, userId, amount, adminId, reason = 'manual' }) {
  const admins = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  if (!admins.includes(String(adminId))) throw new Error('NOT_ADMIN');
  const value = validAmount(amount, 10_000_000);
  return changeBalanceTx({ guildId: String(guildId), userId: String(userId), amount: value, reason: `admin:${adminId}:${reason}` });
}

function removeCoinsByAdmin({ guildId, userId, amount, adminId, reason = 'violation' }) {
  const admins = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  if (!admins.includes(String(adminId))) throw new Error('NOT_ADMIN');
  const requested = validAmount(amount, 10_000_000);
  const account = ensureAccount(guildId, userId);
  const deducted = Math.min(requested, account.balance);
  const updated = changeBalanceTx({ guildId: String(guildId), userId: String(userId), amount: -deducted, reason: `admin-remove:${adminId}:${reason}` });
  return { ...updated, requested, deducted };
}

function rewardGame({ guildId, userId, amount, game, outcome = 'win' }) {
  const value = Math.floor(Number(amount));
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) throw new Error('INVALID_AMOUNT');
  return settleWithProgress(
    { guildId, userId, amount: value, reason: `${game}:${outcome}`, outcome },
    { guildId, userId, game, outcome, amount: value },
  );
}

function settleReservedGame({ guildId, userId, payout, game, outcome }) {
  const value = Number(payout);
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000_000) throw new Error('INVALID_PAYOUT');
  return settleWithProgress(
    { guildId, userId, amount: value, reason: `${game}:${outcome}`, outcome },
    { guildId, userId, game, outcome, amount: value },
  );
}

function recordGameResult({ guildId, userId, game, outcome }) {
  return settleWithProgress(
    { guildId, userId, amount: 0, reason: `${game}:${outcome}`, outcome },
    { guildId, userId, game, outcome },
  );
}

function creditCoins({ guildId, userId, amount, reason = 'reward' }) {
  const value = validAmount(amount, 100_000_000);
  return changeBalanceTx({ guildId: String(guildId), userId: String(userId), amount: value, reason: String(reason) });
}

const claimDailyTx = db.transaction((guildId, userId, now = Date.now()) => {
  const account = ensureAccount(guildId, userId, now);
  const remaining = Math.max(0, account.last_daily_at + DAY_MS - now);
  if (remaining > 0) return { ok: false, remaining, account };
  const balance = account.balance + DAILY_COINS;
  db.prepare('UPDATE economy_accounts SET balance = ?, last_daily_at = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?')
    .run(balance, now, now, String(guildId), String(userId));
  transactionStatement.run(String(guildId), String(userId), DAILY_COINS, balance, 'daily', now);
  return { ok: true, amount: DAILY_COINS, account: { ...account, balance, last_daily_at: now } };
});

function claimDaily(guildId, userId, now = Date.now()) {
  return claimDailyTx(String(guildId), String(userId), now);
}

function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM economy_accounts WHERE guild_id = ? ORDER BY balance DESC, wins DESC LIMIT ?')
    .all(String(guildId), Math.max(1, Math.min(25, Number(limit) || 10)));
}

function getTransactionHistory(guildId, userId, limit = 10) {
  return db.prepare('SELECT * FROM economy_transactions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT ?')
    .all(String(guildId), String(userId), Math.max(1, Math.min(25, Number(limit) || 10)));
}

function getRank(guildId, userId) {
  const account = ensureAccount(guildId, userId);
  return db.prepare('SELECT 1 + COUNT(*) AS rank FROM economy_accounts WHERE guild_id = ? AND balance > ?')
    .get(String(guildId), account.balance).rank;
}

function getEconomyStats(guildId, now = Date.now()) {
  const guild = String(guildId); const since = now - DAY_MS;
  const accounts = db.prepare('SELECT COUNT(*) users,COALESCE(SUM(balance),0) supply,COALESCE(AVG(balance),0) average,COALESCE(MAX(balance),0) richest FROM economy_accounts WHERE guild_id=?').get(guild);
  const flow = db.prepare(`SELECT COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) minted,
    COALESCE(-SUM(CASE WHEN amount<0 THEN amount ELSE 0 END),0) spent,COUNT(*) transactions
    FROM economy_transactions WHERE guild_id=? AND created_at>=?`).get(guild, since);
  return { ...accounts, average: Math.floor(accounts.average || 0), ...flow };
}

function cleanupEconomyTransactions(now = Date.now()) {
  const cutoff = now - TRANSACTION_RETENTION_DAYS * DAY_MS;
  return db.prepare('DELETE FROM economy_transactions WHERE created_at < ?').run(cutoff).changes;
}

function startEconomyMaintenance(logger = console) {
  const run = () => {
    const deleted = cleanupEconomyTransactions();
    logger.info?.({ deleted, retentionDays: TRANSACTION_RETENTION_DAYS }, 'economy maintenance completed');
  };
  run();
  const timer = setInterval(() => { try { run(); } catch (error) { logger.error?.({ err: error }, 'economy maintenance failed'); } }, DAY_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  DAY_MS,
  SHOP_SPEND_MAX,
  STARTING_COINS,
  DAILY_COINS,
  ensureAccount,
  getAccount,
  settleBet,
  spendCoins,
  transferCoins,
  addCoinsByAdmin,
  removeCoinsByAdmin,
  rewardGame,
  settleReservedGame,
  recordGameResult,
  creditCoins,
  claimDaily,
  getLeaderboard,
  getTransactionHistory,
  getRank,
  getEconomyStats,
  cleanupEconomyTransactions,
  startEconomyMaintenance,
};

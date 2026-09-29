const crypto = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { db } = require('../db');
const { spendCoins, settleReservedGame } = require('./economyService');
const { formatCoins } = require('../utils/economy');
const { randomLossTaunt } = require('./lossTauntService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { insuredRefund } = require('./effectStateService');

const ROUND_MS = 30_000;
const MIN_BET = 10;
const MAX_BET_PER_HORSE = 100_000;
const MAX_BET_PER_ROUND = 500_000;
const timers = new Map();

// Weight controls win chance. Multiplier includes the returned stake and is
// intentionally a little below the fair inverse probability.
const HORSES = Object.freeze({
  sao_bang: { emoji: '🐎', name: 'Sao Băng', weight: 32, multiplier: 2.8 },
  bao_den: { emoji: '🏇', name: 'Bão Đen', weight: 25, multiplier: 3.6 },
  lua_do: { emoji: '🐴', name: 'Lửa Đỏ', weight: 19, multiplier: 4.7 },
  nguyet_anh: { emoji: '🦄', name: 'Nguyệt Ảnh', weight: 14, multiplier: 6.3 },
  set_trang: { emoji: '🐎', name: 'Sét Trắng', weight: 10, multiplier: 8.5 },
});

function horseLabel(key) {
  const horse = HORSES[key];
  return horse ? `${horse.emoji} ${horse.name} · x${horse.multiplier}` : key;
}

function getRound(id) {
  return db.prepare("SELECT * FROM multiplayer_rounds WHERE id = ? AND game = 'duangua'").get(String(id)) || null;
}

function getOpenHorseRace(guildId) {
  return db.prepare("SELECT * FROM multiplayer_rounds WHERE guild_id = ? AND game = 'duangua' AND status = 'open' ORDER BY created_at DESC LIMIT 1")
    .get(String(guildId)) || null;
}

function raceStats(roundId) {
  return db.prepare('SELECT COUNT(DISTINCT user_id) AS players, COALESCE(SUM(amount), 0) AS pool FROM multiplayer_bets WHERE round_id = ?').get(roundId);
}

function raceButtons(round, disabled = false) {
  return [new ActionRowBuilder().addComponents(...Object.entries(HORSES).map(([key, horse]) => new ButtonBuilder()
    .setCustomId(`horserace:${round.id}:${key}`).setLabel(`${horse.name} x${horse.multiplier}`)
    .setEmoji(horse.emoji).setStyle(ButtonStyle.Primary).setDisabled(disabled)))];
}

function raceEmbed(round) {
  const stats = raceStats(round.id);
  const maxBet = getGameBetLimit(round.guild_id, 'duangua');
  const closes = Math.floor(round.closes_at / 1000);
  const odds = Object.entries(HORSES).map(([key, horse]) => `**${horse.emoji} ${horse.name}** — ${horse.weight}% • x${horse.multiplier}`).join('\n');
  return new EmbedBuilder().setColor(0x2ECC71).setTitle('🏇 ĐUA NGỰA · ĐANG NHẬN CƯỢC')
    .setDescription(`Nhiều người có thể cược cùng ván và cược nhiều ngựa. Bấm ngựa để nhập tiền cược.\n\n${odds}\n\nKhóa cược <t:${closes}:R> lúc <t:${closes}:T>.`)
    .addFields(
      { name: 'Người đã cược', value: String(stats.players), inline: true },
      { name: 'Tổng pot', value: `${formatCoins(stats.pool)} xu`, inline: true },
      { name: 'Giới hạn mỗi người/ván', value: `${formatCoins(MIN_BET)}–${formatCoins(maxBet)} xu`, inline: true },
    )
    .setFooter({ text: `Mã ván: ${round.id} • Multiplier gồm cả tiền cược hoàn lại` });
}

async function fetchRaceMessage(round, client) {
  if (!round.message_id || !client) return null;
  const channel = await client.channels.fetch(round.channel_id).catch(() => null);
  return channel?.messages?.fetch(round.message_id).catch(() => null);
}

async function refreshRace(round, client) {
  const message = await fetchRaceMessage(round, client);
  if (message) await message.edit({ embeds: [raceEmbed(round)], components: raceButtons(round) }).catch(() => {});
}

const placeHorseBetTx = db.transaction(({ roundId, userId, horse, amount }) => {
  const round = getRound(roundId);
  if (!round || round.status !== 'open' || round.closes_at <= Date.now()) throw new Error('ROUND_CLOSED');
  if (!HORSES[horse]) throw new Error('INVALID_HORSE');
  if (!Number.isSafeInteger(amount) || amount < MIN_BET || amount > MAX_BET_PER_HORSE) throw new Error('INVALID_BET');
  const maxBet = getGameBetLimit(round.guild_id, 'duangua');
  const current = db.prepare('SELECT amount FROM multiplayer_bets WHERE round_id = ? AND user_id = ? AND choice = ?').get(roundId, String(userId), horse)?.amount || 0;
  const total = db.prepare('SELECT COALESCE(SUM(amount), 0) AS amount FROM multiplayer_bets WHERE round_id = ? AND user_id = ?').get(roundId, String(userId)).amount;
  if (current + amount > maxBet || total + amount > maxBet) { const error = new Error('BET_LIMIT'); error.maxBet = maxBet; throw error; }
  const account = spendCoins({ guildId: round.guild_id, userId, amount, reason: `duangua:reserve:${roundId}` });
  const now = Date.now();
  db.prepare(`INSERT INTO multiplayer_bets (round_id, user_id, choice, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(round_id, user_id, choice) DO UPDATE SET amount = amount + excluded.amount, updated_at = excluded.updated_at`)
    .run(roundId, String(userId), horse, amount, now, now);
  return { round, account, horseAmount: current + amount, totalAmount: total + amount };
});

function weightedWinner(randomValue = null) {
  const total = Object.values(HORSES).reduce((sum, horse) => sum + horse.weight, 0);
  let roll = randomValue === null ? crypto.randomInt(total) : Math.max(0, Math.min(total - 1, Math.floor(randomValue)));
  for (const [key, horse] of Object.entries(HORSES)) {
    if (roll < horse.weight) return key;
    roll -= horse.weight;
  }
  return Object.keys(HORSES)[0];
}

function finishOrder(winner) {
  const rest = Object.keys(HORSES).filter(key => key !== winner);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const target = crypto.randomInt(i + 1);
    [rest[i], rest[target]] = [rest[target], rest[i]];
  }
  return [winner, ...rest];
}

const settleHorseTx = db.transaction((roundId, forcedWinner = null) => {
  const round = getRound(roundId);
  if (!round || round.status !== 'open') return null;
  const winner = forcedWinner && HORSES[forcedWinner] ? forcedWinner : weightedWinner();
  const order = finishOrder(winner);
  const bets = db.prepare('SELECT * FROM multiplayer_bets WHERE round_id = ?').all(roundId);
  const users = new Map();
  for (const bet of bets) {
    const summary = users.get(bet.user_id) || { stake: 0, payout: 0 };
    summary.stake += bet.amount;
    if (bet.choice === winner) summary.payout += Math.floor(bet.amount * HORSES[winner].multiplier);
    users.set(bet.user_id, summary);
  }
  const settlements = [];
  for (const [userId, summary] of users) {
    const insurance = summary.payout === 0 ? insuredRefund(round.guild_id, userId, summary.stake) : 0;
    summary.payout += insurance;
    const outcome = summary.payout > summary.stake ? 'win' : summary.payout === summary.stake ? 'draw' : 'loss';
    const account = settleReservedGame({ guildId: round.guild_id, userId, payout: summary.payout, game: 'duangua', outcome });
    settlements.push({ userId, ...summary, insurance, outcome, balance: account.balance, taunt: summary.payout === 0 ? randomLossTaunt() : null });
  }
  db.prepare("UPDATE multiplayer_rounds SET status = 'closed', result_json = ? WHERE id = ?")
    .run(JSON.stringify({ winner, order, settlements }), roundId);
  return { round: { ...round, status: 'closed' }, winner, order, settlements };
});

function resultEmbed(settled) {
  const podium = settled.order.map((key, index) => `${index + 1}. ${horseLabel(key)}`).join('\n');
  const paid = settled.settlements.filter(item => item.outcome !== 'loss').sort((a, b) => b.payout - a.payout);
  const payments = paid.length ? paid.slice(0, 15).map(item => `<@${item.userId}>: cược ${formatCoins(item.stake)} → nhận ${formatCoins(item.payout)} xu`).join('\n') : 'Không có người chơi nào cược đúng ngựa thắng.';
  const empty = settled.settlements.filter(item => item.payout === 0);
  const taunts = empty.slice(0, 8).map(item => `<@${item.userId}> — ${item.taunt}`).join('\n');
  const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🏁 ĐUA NGỰA · KẾT QUẢ')
    .setDescription(`## Vô địch: ${horseLabel(settled.winner)}\n\n${podium}`)
    .addFields({ name: 'Thanh toán', value: payments })
    .setFooter({ text: `Mã ván: ${settled.round.id} • ${settled.settlements.length} người tham gia` }).setTimestamp();
  if (taunts) embed.addFields({ name: '😏 Góc khịa tay trắng', value: `${taunts}${empty.length > 8 ? `\n…và ${empty.length - 8} người khác.` : ''}` });
  const insured = settled.settlements.filter(item => item.insurance > 0);
  if (insured.length) embed.addFields({ name: '🛡️ Bảo hiểm cược', value: insured.map(item => `<@${item.userId}> được hoàn ${formatCoins(item.insurance)} xu`).join('\n') });
  return embed;
}

async function settleHorseRace(roundId, client, logger = console, forcedWinner = null) {
  clearTimeout(timers.get(roundId)); timers.delete(roundId);
  let settled;
  try { settled = settleHorseTx(roundId, forcedWinner); }
  catch (error) { logger.error?.({ err: error, roundId }, 'horse race settlement failed'); throw error; }
  if (!settled) return null;
  const message = await fetchRaceMessage(settled.round, client);
  if (message) await message.edit({ embeds: [resultEmbed(settled)], components: raceButtons(settled.round, true), allowedMentions: { parse: [] } }).catch(() => {});
  return settled;
}

function scheduleRace(round, client, logger = console) {
  clearTimeout(timers.get(round.id));
  const timer = setTimeout(() => settleHorseRace(round.id, client, logger).catch(() => {}), Math.max(0, round.closes_at - Date.now()));
  timer.unref?.(); timers.set(round.id, timer);
}

async function createHorseRace(interaction, logger = console) {
  const existing = getOpenHorseRace(interaction.guildId);
  if (existing) {
    if (existing.closes_at <= Date.now()) await settleHorseRace(existing.id, interaction.client, logger);
    else return interaction.reply({ content: `Ván đua hiện tại vẫn nhận cược đến <t:${Math.floor(existing.closes_at / 1000)}:T>.`, flags: MessageFlags.Ephemeral });
  }
  const now = Date.now();
  const round = { id: crypto.randomBytes(4).toString('hex'), guild_id: String(interaction.guildId), game: 'duangua', channel_id: String(interaction.channelId), message_id: null, status: 'open', closes_at: now + ROUND_MS, created_at: now };
  db.prepare('INSERT INTO multiplayer_rounds (id, guild_id, game, channel_id, message_id, status, closes_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)')
    .run(round.id, round.guild_id, round.game, round.channel_id, round.status, round.closes_at, round.created_at);
  const response = await interaction.reply({ embeds: [raceEmbed(round)], components: raceButtons(round), withResponse: true });
  const message = response?.resource?.message;
  if (message?.id) { round.message_id = message.id; db.prepare('UPDATE multiplayer_rounds SET message_id = ? WHERE id = ?').run(message.id, round.id); }
  scheduleRace(round, interaction.client, logger);
  return round;
}

async function handleHorseButton(interaction) {
  const [, roundId, horse] = interaction.customId.split(':');
  const round = getRound(roundId);
  if (!round || round.guild_id !== interaction.guildId || round.channel_id !== interaction.channelId || round.status !== 'open' || round.closes_at <= Date.now()) return interaction.reply({ content: 'Ván đua đã khóa cược.', flags: MessageFlags.Ephemeral });
  if (!HORSES[horse]) return interaction.reply({ content: 'Ngựa cược không hợp lệ.', flags: MessageFlags.Ephemeral });
  const maxBet = getGameBetLimit(round.guild_id, 'duangua');
  const modal = new ModalBuilder().setCustomId(`horserace-modal:${roundId}:${horse}`).setTitle(`Cược ${HORSES[horse].name} x${HORSES[horse].multiplier}`)
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel(`Số xu (${MIN_BET}–${maxBet})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6)));
  return interaction.showModal(modal);
}

async function handleHorseModal(interaction) {
  const [, roundId, horse] = interaction.customId.split(':');
  const amountText = interaction.fields.getTextInputValue('amount').trim();
  const amount = Number(amountText);
  if (!/^\d+$/.test(amountText) || !Number.isSafeInteger(amount)) return interaction.reply({ content: 'Số xu cược không hợp lệ.', flags: MessageFlags.Ephemeral });
  try {
    const placed = placeHorseBetTx({ roundId, userId: interaction.user.id, horse, amount });
    await interaction.reply({ content: `✅ Đã cược **${formatCoins(amount)} xu** vào **${horseLabel(horse)}**. Tổng cược ván: **${formatCoins(placed.totalAmount)} xu**. Số dư: **${formatCoins(placed.account.balance)} xu**.`, flags: MessageFlags.Ephemeral });
    await refreshRace(placed.round, interaction.client);
  } catch (error) {
    const content = error.code === 'INSUFFICIENT_FUNDS' ? `Bạn không đủ xu. Số dư: **${formatCoins(error.balance)} xu**.`
      : error.message === 'ROUND_CLOSED' ? 'Ván đua đã khóa cược.'
        : error.message === 'BET_LIMIT' ? `Tổng cược tối đa của bạn trong ván này là ${formatCoins(error.maxBet)} xu.`
          : `Mức cược phải từ ${formatCoins(MIN_BET)} đến ${formatCoins(MAX_BET_PER_HORSE)} xu.`;
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
  return null;
}

function resumeHorseRaces(client, logger = console) {
  const rounds = db.prepare("SELECT * FROM multiplayer_rounds WHERE game = 'duangua' AND status = 'open'").all();
  for (const round of rounds) scheduleRace(round, client, logger);
  return rounds.length;
}

module.exports = {
  ROUND_MS, MIN_BET, MAX_BET_PER_HORSE, HORSES, horseLabel, weightedWinner,
  getOpenHorseRace, createHorseRace, handleHorseButton, handleHorseModal,
  settleHorseRace, resumeHorseRaces, resultEmbed,
};

const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { spendCoins, settleReservedGame } = require('./economyService');
const { formatCoins } = require('../utils/economy');
const { randomLossTaunt } = require('./lossTauntService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { insuredRefund } = require('./effectStateService');

const CELL_COUNT = 20;
const MIN_MINES = 1;
const MAX_MINES = 7;
const MIN_BET = 10;
const MAX_BET = 100_000;
const MAX_PAYOUT = 10_000_000;
const HOUSE_FACTOR = 0.97;

function combination(n, r) {
  if (r < 0 || r > n) return 0;
  const k = Math.min(r, n - r);
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = value * (n - k + i) / i;
  return value;
}

function multiplierFor(opened, mineCount, stake = MIN_BET) {
  if (opened <= 0) return 1;
  const remaining = CELL_COUNT - opened;
  if (remaining < mineCount) return Math.floor((MAX_PAYOUT / stake) * 100) / 100;
  const fair = combination(CELL_COUNT, mineCount) / combination(remaining, mineCount);
  const capped = Math.min(fair * HOUSE_FACTOR, MAX_PAYOUT / stake);
  return Math.max(1.01, Math.floor(capped * 100) / 100);
}

function payoutFor(state) {
  return Math.min(MAX_PAYOUT, Math.floor(state.stake * multiplierFor(state.opened.length, state.mineCount, state.stake)));
}

function createMinePositions(count) {
  const cells = Array.from({ length: CELL_COUNT }, (_, index) => index);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const target = crypto.randomInt(index + 1);
    [cells[index], cells[target]] = [cells[target], cells[index]];
  }
  return cells.slice(0, count).sort((a, b) => a - b);
}

function getSession(id) { return db.prepare('SELECT * FROM mines_sessions WHERE id = ?').get(String(id)) || null; }
function getMinesByUser(guildId, userId) { return db.prepare('SELECT * FROM mines_sessions WHERE guild_id = ? AND user_id = ?').get(String(guildId), String(userId)) || null; }
function parseState(session) { return JSON.parse(session.state_json); }
function saveState(session, state) { db.prepare('UPDATE mines_sessions SET state_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), Date.now(), session.id); }
function setMessageId(id, messageId) { db.prepare('UPDATE mines_sessions SET message_id = ?, updated_at = ? WHERE id = ?').run(String(messageId), Date.now(), String(id)); }

const startTx = db.transaction(({ guildId, userId, channelId, stake, mineCount, forcedMines = null }) => {
  const maxBet = getGameBetLimit(guildId, 'mines');
  if (!Number.isSafeInteger(stake) || stake < MIN_BET || stake > MAX_BET) throw new Error('INVALID_BET');
  if (stake > maxBet) { const error = new Error('BET_LIMIT'); error.maxBet = maxBet; throw error; }
  if (!Number.isSafeInteger(mineCount) || mineCount < MIN_MINES || mineCount > MAX_MINES) throw new Error('INVALID_MINES');
  if (getMinesByUser(guildId, userId)) throw new Error('ACTIVE_SESSION');
  const account = spendCoins({ guildId, userId, amount: stake, reason: 'mines:reserve' });
  const mines = forcedMines ? [...new Set(forcedMines)] : createMinePositions(mineCount);
  if (mines.length !== mineCount || mines.some(index => !Number.isInteger(index) || index < 0 || index >= CELL_COUNT)) throw new Error('INVALID_MINES');
  const state = { stake, mineCount, mines, opened: [], status: 'playing' };
  const now = Date.now();
  const session = { id: crypto.randomBytes(6).toString('hex'), guild_id: String(guildId), user_id: String(userId), channel_id: String(channelId), message_id: null, created_at: now, updated_at: now };
  db.prepare('INSERT INTO mines_sessions (id, guild_id, user_id, channel_id, message_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)')
    .run(session.id, session.guild_id, session.user_id, session.channel_id, JSON.stringify(state), now, now);
  return { session, state, account };
});

function startMines(args) { return startTx(args); }

function settle(session, state, reason) {
  const won = reason === 'cashout' || reason === 'cleared';
  let payout = won ? payoutFor(state) : 0;
  const insurance = reason === 'mine' ? insuredRefund(session.guild_id, session.user_id, state.stake) : 0;
  payout += insurance;
  const outcome = won ? (payout > state.stake ? 'win' : 'draw') : 'loss';
  const account = settleReservedGame({ guildId: session.guild_id, userId: session.user_id, payout, game: 'mines', outcome });
  db.prepare('DELETE FROM mines_sessions WHERE id = ?').run(session.id);
  state.status = reason;
  return { reason, outcome, payout, insurance, balance: account.balance, taunt: reason === 'mine' ? randomLossTaunt() : null };
}

const playTx = db.transaction(({ sessionId, userId, action, cell = null }) => {
  const session = getSession(sessionId);
  if (!session || session.user_id !== String(userId)) throw new Error('INVALID_SESSION');
  const state = parseState(session);
  if (action === 'forfeit') return { settled: true, session, state, result: settle(session, state, 'forfeit') };
  if (action === 'cashout') {
    if (!state.opened.length) throw new Error('CANNOT_CASHOUT');
    return { settled: true, session, state, result: settle(session, state, 'cashout') };
  }
  if (action !== 'open' || !Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT || state.opened.includes(cell)) throw new Error('INVALID_CELL');
  if (state.mines.includes(cell)) return { settled: true, session, state, exploded: cell, result: settle(session, state, 'mine') };
  state.opened.push(cell);
  state.opened.sort((a, b) => a - b);
  if (state.opened.length === CELL_COUNT - state.mineCount) return { settled: true, session, state, result: settle(session, state, 'cleared') };
  saveState(session, state);
  return { settled: false, session, state, result: null };
});

function playMines(args) { return playTx(args); }

function minesRows(sessionId, state, result = null) {
  const rows = [];
  const finished = Boolean(result);
  for (let start = 0; start < CELL_COUNT; start += 5) {
    const row = new ActionRowBuilder();
    for (let index = start; index < start + 5; index += 1) {
      const opened = state.opened.includes(index);
      const mine = finished && state.mines.includes(index);
      const exploded = result?.reason === 'mine' && result.exploded === index;
      row.addComponents(new ButtonBuilder().setCustomId(`mines:${sessionId}:open:${index}`)
        .setLabel(mine ? '💣' : opened ? '💎' : '·')
        .setStyle(exploded ? ButtonStyle.Danger : mine ? ButtonStyle.Secondary : opened ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(finished || opened));
    }
    rows.push(row);
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines:${sessionId}:cashout`).setLabel(`Rút x${multiplierFor(state.opened.length, state.mineCount, state.stake).toFixed(2)}`).setEmoji('💰').setStyle(ButtonStyle.Success).setDisabled(finished || !state.opened.length),
    new ButtonBuilder().setCustomId(`mines:${sessionId}:forfeit`).setLabel('Bỏ ván').setEmoji('🏳️').setStyle(ButtonStyle.Danger).setDisabled(finished),
  ));
  return rows;
}

function minesEmbed(state, userId, result = null) {
  const multiplier = multiplierFor(state.opened.length, state.mineCount, state.stake);
  const potential = payoutFor(state);
  const embed = new EmbedBuilder().setColor(result ? (result.outcome === 'win' ? 0x2ECC71 : 0xE74C3C) : 0x3498DB)
    .setTitle('💣 MINES')
    .setDescription(`**Người chơi:** <@${userId}>\nChọn ô an toàn để tăng multiplier, rồi rút trước khi trúng mìn.`)
    .addFields(
      { name: 'Tiền cược', value: `${formatCoins(state.stake)} xu`, inline: true },
      { name: 'Số mìn', value: String(state.mineCount), inline: true },
      { name: 'Ô an toàn đã mở', value: `${state.opened.length}/${CELL_COUNT - state.mineCount}`, inline: true },
      { name: 'Multiplier hiện tại', value: `x${multiplier.toFixed(2)}`, inline: true },
      { name: 'Có thể nhận', value: state.opened.length ? `${formatCoins(potential)} xu` : 'Mở ít nhất 1 ô', inline: true },
    );
  if (result) {
    const text = result.reason === 'mine' ? `💥 Trúng mìn, mất **${formatCoins(state.stake)} xu**.${result.insurance ? `\n🛡️ Bảo hiểm hoàn **${formatCoins(result.insurance)} xu**.` : ''}\n😏 ${result.taunt}`
      : result.reason === 'forfeit' ? `🏳️ Đã bỏ ván và mất **${formatCoins(state.stake)} xu**.`
        : `💰 Đã rút **${formatCoins(result.payout)} xu** ở x${multiplier.toFixed(2)}.`;
    embed.addFields({ name: 'Kết quả', value: text }).setFooter({ text: `Số dư: ${formatCoins(result.balance)} xu` });
  } else embed.setFooter({ text: 'Bảng 20 ô • Tiền cược được giữ ngay khi mở ván • Không có phí mở ván riêng' });
  return embed;
}

async function handleMinesButton(interaction) {
  const [, sessionId, action, rawCell] = interaction.customId.split(':');
  const session = getSession(sessionId);
  if (!session || session.guild_id !== interaction.guildId || session.channel_id !== interaction.channelId) return interaction.reply({ content: 'Ván Mines đã kết thúc hoặc nút không còn hợp lệ.', flags: MessageFlags.Ephemeral });
  if (session.user_id !== interaction.user.id) return interaction.reply({ content: 'Đây là ván Mines của người chơi khác.', flags: MessageFlags.Ephemeral });
  try {
    const played = playMines({ sessionId, userId: interaction.user.id, action, cell: rawCell === undefined ? null : Number(rawCell) });
    if (played.result) played.result.exploded = played.exploded;
    return interaction.update({ embeds: [minesEmbed(played.state, interaction.user.id, played.result)], components: minesRows(sessionId, played.state, played.result), allowedMentions: { parse: [] } });
  } catch (error) {
    const content = error.message === 'CANNOT_CASHOUT' ? 'Bạn phải mở ít nhất một ô an toàn trước khi rút.'
      : error.message === 'INVALID_CELL' ? 'Ô này đã mở hoặc không hợp lệ.' : 'Không thể thực hiện thao tác này.';
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  CELL_COUNT, MIN_MINES, MAX_MINES, MIN_BET, MAX_BET, MAX_PAYOUT,
  combination, multiplierFor, payoutFor, createMinePositions, getMinesByUser,
  startMines, playMines, setMessageId, minesRows, minesEmbed, handleMinesButton,
};

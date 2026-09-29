const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { spendCoins, settleReservedGame } = require('./economyService');
const { formatCoins } = require('../utils/economy');
const { randomLossTaunt } = require('./lossTauntService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { insuredRefund } = require('./effectStateService');

const MIN_BET = 10;
const MAX_BET = 100_000;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function rank(card) { return card.slice(0, -1); }

function handScore(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = rank(card);
    if (value === 'A') { total += 11; aces += 1; }
    else total += ['J', 'Q', 'K'].includes(value) ? 10 : Number(value);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}

function isBlackjack(cards) { return cards.length === 2 && handScore(cards).total === 21; }

function createShoe(decks = 6) {
  const cards = [];
  for (let deck = 0; deck < decks; deck += 1) {
    for (const suit of SUITS) for (const value of RANKS) cards.push(`${value}${suit}`);
  }
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const target = crypto.randomInt(index + 1);
    [cards[index], cards[target]] = [cards[target], cards[index]];
  }
  return cards;
}

function draw(state) {
  if (!state.deck.length) state.deck = createShoe();
  return state.deck.pop();
}

function totalBet(state) { return state.hands.reduce((sum, hand) => sum + hand.bet, 0); }
function getSessionByUser(guildId, userId) {
  return db.prepare('SELECT * FROM blackjack_sessions WHERE guild_id = ? AND user_id = ?').get(String(guildId), String(userId)) || null;
}
function getSession(id) { return db.prepare('SELECT * FROM blackjack_sessions WHERE id = ?').get(String(id)) || null; }
function parseState(session) { return JSON.parse(session.state_json); }

function saveState(session, state) {
  db.prepare('UPDATE blackjack_sessions SET state_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), Date.now(), session.id);
}

function setMessageId(id, messageId) {
  db.prepare('UPDATE blackjack_sessions SET message_id = ?, updated_at = ? WHERE id = ?').run(String(messageId), Date.now(), String(id));
}

function initialResult(state) {
  const playerBlackjack = isBlackjack(state.hands[0].cards);
  const dealerBlackjack = isBlackjack(state.dealer);
  if (!playerBlackjack && !dealerBlackjack) return null;
  if (playerBlackjack && dealerBlackjack) return { outcome: 'draw', payout: state.hands[0].bet, reason: 'Cả hai cùng Blackjack' };
  if (playerBlackjack) return { outcome: 'win', payout: Math.floor(state.hands[0].bet * 2.5), reason: 'Blackjack tự nhiên trả 3:2' };
  return { outcome: 'loss', payout: 0, reason: 'Dealer có Blackjack', taunt: randomLossTaunt() };
}

const startTx = db.transaction(({ guildId, userId, channelId, stake, forcedDeck = null }) => {
  const maxBet = getGameBetLimit(guildId, 'blackjack');
  if (!Number.isSafeInteger(stake) || stake < MIN_BET || stake > MAX_BET) throw new Error('INVALID_BET');
  if (stake > maxBet) { const error = new Error('BET_LIMIT'); error.maxBet = maxBet; throw error; }
  if (getSessionByUser(guildId, userId)) throw new Error('ACTIVE_SESSION');
  const account = spendCoins({ guildId, userId, amount: stake, reason: 'blackjack:reserve' });
  const state = { deck: forcedDeck ? [...forcedDeck] : createShoe(), dealer: [], hands: [{ cards: [], bet: stake, status: 'playing' }], active: 0, split: false, maxBet };
  state.hands[0].cards.push(draw(state)); state.dealer.push(draw(state));
  state.hands[0].cards.push(draw(state)); state.dealer.push(draw(state));
  const natural = initialResult(state);
  if (natural) {
    const insurance = natural.outcome === 'loss' ? insuredRefund(guildId, userId, stake) : 0;
    natural.payout += insurance;
    natural.insurance = insurance;
    const settled = settleReservedGame({ guildId, userId, payout: natural.payout, game: 'blackjack', outcome: natural.outcome });
    return { immediate: true, state, result: { ...natural, balance: settled.balance, stake, totalStake: stake } };
  }
  const now = Date.now();
  const session = { id: crypto.randomBytes(6).toString('hex'), guild_id: String(guildId), user_id: String(userId), channel_id: String(channelId), message_id: null, created_at: now, updated_at: now };
  db.prepare('INSERT INTO blackjack_sessions (id, guild_id, user_id, channel_id, message_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)')
    .run(session.id, session.guild_id, session.user_id, session.channel_id, JSON.stringify(state), now, now);
  return { immediate: false, session, state, account };
});

function startBlackjack(args) { return startTx(args); }

function dealerPlay(state) {
  while (handScore(state.dealer).total < 17) state.dealer.push(draw(state));
}

function settleState(session, state, reason = null) {
  dealerPlay(state);
  const dealer = handScore(state.dealer).total;
  let payout = 0;
  const results = state.hands.map(hand => {
    const score = handScore(hand.cards).total;
    let handPayout = 0;
    let label;
    if (score > 21) label = 'Bust';
    else if (dealer > 21 || score > dealer) { label = 'Thắng'; handPayout = hand.bet * 2; }
    else if (score === dealer) { label = 'Hòa'; handPayout = hand.bet; }
    else label = 'Thua';
    payout += handPayout;
    return { score, payout: handPayout, label };
  });
  const stake = totalBet(state);
  if (reason === 'forfeit') payout = 0;
  const insurance = payout === 0 && reason !== 'forfeit' ? insuredRefund(session.guild_id, session.user_id, stake) : 0;
  payout += insurance;
  const outcome = payout > stake ? 'win' : payout === stake ? 'draw' : 'loss';
  const account = settleReservedGame({ guildId: session.guild_id, userId: session.user_id, payout, game: 'blackjack', outcome });
  db.prepare('DELETE FROM blackjack_sessions WHERE id = ?').run(session.id);
  const taunt = outcome === 'loss' && payout === 0 && reason !== 'forfeit' ? randomLossTaunt() : null;
  return { outcome, payout, stake, insurance, balance: account.balance, dealer, results, reason, taunt };
}

function advanceOrSettle(session, state) {
  const next = state.hands.findIndex((hand, index) => index > state.active && hand.status === 'playing');
  if (next >= 0) { state.active = next; saveState(session, state); return { settled: false, state }; }
  return { settled: true, state, result: settleState(session, state) };
}

const actionTx = db.transaction(({ sessionId, userId, action }) => {
  const session = getSession(sessionId);
  if (!session || session.user_id !== String(userId)) throw new Error('INVALID_SESSION');
  const state = parseState(session);
  const hand = state.hands[state.active];
  if (!hand || hand.status !== 'playing') throw new Error('INVALID_ACTION');
  if (action === 'forfeit') return { settled: true, state, result: settleState(session, state, 'forfeit') };
  if (action === 'hit') {
    hand.cards.push(draw(state));
    const score = handScore(hand.cards).total;
    if (score >= 21) hand.status = score > 21 ? 'bust' : 'stand';
  } else if (action === 'stand') hand.status = 'stand';
  else if (action === 'double') {
    if (hand.cards.length !== 2) throw new Error('CANNOT_DOUBLE');
    if (totalBet(state) + hand.bet > (state.maxBet || MAX_BET)) { const error = new Error('BET_LIMIT'); error.maxBet = state.maxBet || MAX_BET; throw error; }
    spendCoins({ guildId: session.guild_id, userId, amount: hand.bet, reason: `blackjack:double:${session.id}` });
    hand.bet *= 2;
    hand.cards.push(draw(state));
    hand.status = handScore(hand.cards).total > 21 ? 'bust' : 'stand';
  } else if (action === 'split') {
    if (state.split || state.hands.length !== 1 || hand.cards.length !== 2 || rank(hand.cards[0]) !== rank(hand.cards[1])) throw new Error('CANNOT_SPLIT');
    if (totalBet(state) + hand.bet > (state.maxBet || MAX_BET)) { const error = new Error('BET_LIMIT'); error.maxBet = state.maxBet || MAX_BET; throw error; }
    spendCoins({ guildId: session.guild_id, userId, amount: hand.bet, reason: `blackjack:split:${session.id}` });
    const [first, second] = hand.cards;
    state.hands = [
      { cards: [first, draw(state)], bet: hand.bet, status: 'playing' },
      { cards: [second, draw(state)], bet: hand.bet, status: 'playing' },
    ];
    state.active = 0;
    state.split = true;
    if (rank(first) === 'A') for (const splitHand of state.hands) splitHand.status = 'stand';
  } else throw new Error('INVALID_ACTION');
  if (state.hands[state.active]?.status === 'playing') { saveState(session, state); return { settled: false, state }; }
  return advanceOrSettle(session, state);
});

function playAction(args) { return actionTx(args); }

function cardText(cards) { return cards.map(card => `\`${card}\``).join(' '); }
function handText(hand, index, active, result = null) {
  const score = handScore(hand.cards).total;
  const marker = active === index && !result ? '👉 ' : '';
  const outcome = result ? ` • **${result.label}**` : hand.status === 'bust' ? ' • **BUST**' : '';
  return `${marker}**Tay ${index + 1}:** ${cardText(hand.cards)} — **${score} điểm** • Cược ${formatCoins(hand.bet)} xu${outcome}`;
}

function blackjackEmbed(state, userId, result = null) {
  const dealerCards = result ? cardText(state.dealer) : `${cardText([state.dealer[0]])} \`??\``;
  const dealerScore = result ? ` — **${handScore(state.dealer).total} điểm**` : '';
  const hands = state.hands.map((hand, index) => handText(hand, index, state.active, result?.results?.[index])).join('\n');
  const embed = new EmbedBuilder().setColor(result ? (result.outcome === 'win' ? 0x2ECC71 : result.outcome === 'draw' ? 0xF1C40F : 0xE74C3C) : 0x34495E)
    .setTitle('🃏 BLACKJACK')
    .setDescription(`**Người chơi:** <@${userId}>\n\n**Dealer:** ${dealerCards}${dealerScore}\n\n${hands}`);
  if (result) {
    const summary = result.reason === 'forfeit' ? 'Bạn đã bỏ ván và mất toàn bộ tiền cược.'
      : result.outcome === 'win' ? `🎉 Thắng! Nhận lại **${formatCoins(result.payout)} xu**.`
        : result.outcome === 'draw' ? `🤝 Hòa! Nhận lại **${formatCoins(result.payout)} xu**.`
          : `💥 Dealer thắng.${result.insurance ? `\n🛡️ Bảo hiểm hoàn **${formatCoins(result.insurance)} xu**.` : ''}${result.taunt ? `\n😏 ${result.taunt}` : ''}`;
    embed.addFields({ name: 'Kết quả', value: `${summary}\nTổng cược: ${formatCoins(result.stake)} xu` })
      .setFooter({ text: `Số dư: ${formatCoins(result.balance)} xu` });
  } else embed.setFooter({ text: 'Dealer đứng ở soft 17 • Blackjack tự nhiên trả 3:2 • Không thu phí mở ván' });
  return embed;
}

function actionRows(sessionId, state, disabled = false) {
  const hand = state.hands[state.active];
  const withinLimit = hand ? totalBet(state) + hand.bet <= (state.maxBet || MAX_BET) : false;
  const canDouble = !disabled && hand?.status === 'playing' && hand.cards.length === 2 && withinLimit;
  const canSplit = canDouble && !state.split && state.hands.length === 1 && rank(hand.cards[0]) === rank(hand.cards[1]);
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`blackjack:${sessionId}:hit`).setLabel('Rút bài').setEmoji('➕').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`blackjack:${sessionId}:stand`).setLabel('Dừng').setEmoji('✋').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`blackjack:${sessionId}:double`).setLabel('Gấp đôi').setEmoji('⏫').setStyle(ButtonStyle.Secondary).setDisabled(!canDouble),
    new ButtonBuilder().setCustomId(`blackjack:${sessionId}:split`).setLabel('Tách bài').setEmoji('✂️').setStyle(ButtonStyle.Secondary).setDisabled(!canSplit),
    new ButtonBuilder().setCustomId(`blackjack:${sessionId}:forfeit`).setLabel('Bỏ ván').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  )];
}

async function handleBlackjackButton(interaction) {
  const [, sessionId, action] = interaction.customId.split(':');
  const session = getSession(sessionId);
  if (!session || session.guild_id !== interaction.guildId || session.channel_id !== interaction.channelId) return interaction.reply({ content: 'Ván Blackjack đã kết thúc hoặc nút không còn hợp lệ.', flags: MessageFlags.Ephemeral });
  if (session.user_id !== interaction.user.id) return interaction.reply({ content: 'Đây là ván Blackjack của người chơi khác.', flags: MessageFlags.Ephemeral });
  try {
    const played = playAction({ sessionId, userId: interaction.user.id, action });
    return interaction.update({ embeds: [blackjackEmbed(played.state, interaction.user.id, played.result)], components: actionRows(sessionId, played.state, played.settled), allowedMentions: { parse: [] } });
  } catch (error) {
    const content = error.code === 'INSUFFICIENT_FUNDS' ? `Bạn không đủ xu để thực hiện. Số dư: **${formatCoins(error.balance)} xu**.`
      : error.message === 'BET_LIMIT' ? `Thao tác này vượt giới hạn cược **${formatCoins(error.maxBet)} xu/người/ván**.`
      : error.message === 'CANNOT_DOUBLE' ? 'Chỉ được gấp đôi khi tay bài có đúng hai lá.'
        : error.message === 'CANNOT_SPLIT' ? 'Chỉ được tách một lần khi hai lá đầu cùng hạng.' : 'Không thể thực hiện thao tác này.';
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  MIN_BET, MAX_BET, handScore, isBlackjack, createShoe, startBlackjack, playAction,
  getSessionByUser, setMessageId, blackjackEmbed, actionRows, handleBlackjackButton,
};

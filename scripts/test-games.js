const assert = require('node:assert/strict');
const { db } = require('../src/db');
const economy = require('../src/services/economyService');
const games = require('../src/services/funGameService');
const channels = require('../src/services/gameChannelService');
const { parseAddGold, parseRemoveGold } = require('../src/services/prefixCommandService');
const rewards = require('../src/services/gameRewardService');
const blackjack = require('../src/services/blackjackService');
const horseRace = require('../src/services/horseRaceService');
const mines = require('../src/services/minesService');
const hardcore = require('../src/services/hardcoreService');
const medianQuiz = require('../src/services/medianQuizService');
const { ITEM_QUIZ_TYPES, HARD_ITEM_QUIZ_TYPES, QUESTION_MODES_BY_TYPE } = medianQuiz;
const { normalizeVietnamese } = require('../src/utils/text');
const { LOSS_TAUNTS } = require('../src/services/lossTauntService');
const betLimits = require('../src/services/gameBetLimitService');
const wordSuggestions = require('../src/services/wordSuggestionService');
const progression = require('../src/services/progressionService');

const commands = [
  require('../src/commands/xu'), require('../src/commands/hoso'), require('../src/commands/noitu'),
  require('../src/commands/baucua'), require('../src/commands/oantuti'), require('../src/commands/taixiu'),
  require('../src/commands/blackjack'),
  require('../src/commands/duangua'), require('../src/commands/mines'),
  require('../src/commands/hardcore'),
  require('../src/commands/vuatiengviet'),
  require('../src/commands/game'),
  require('../src/commands/doanitem'),
  require('../src/commands/trochoi'),
  require('../src/commands/shop'), require('../src/commands/buy'), require('../src/commands/inventory'),
  require('../src/commands/use'), require('../src/commands/collection'), require('../src/commands/craft'),
  require('../src/commands/giftitem'), require('../src/commands/anxin'),
  require('../src/commands/nhiemvu'), require('../src/commands/sukien'), require('../src/commands/xephang'),
];
const guildId = `test-games-${Date.now()}`;
const userId = 'test-user';

try {
  assert(games.WORDS.length >= 25_000, 'word-chain dictionary should contain tens of thousands of normalized phrases');
  assert(games.VUA_QUESTIONS.length >= 20_000, 'Vietnamese scramble game should contain a large word pool');
  const account = economy.getAccount(guildId, userId);
  assert.equal(account.balance, economy.STARTING_COINS);
  const testBalance = 1000;
  db.prepare('UPDATE economy_accounts SET balance = ? WHERE guild_id = ? AND user_id = ?').run(testBalance, guildId, userId);

  const afterLoss = economy.settleBet({ guildId, userId, stake: 100, payout: 0, game: 'test', outcome: 'loss' });
  assert.equal(afterLoss.balance, testBalance - 100);
  assert.equal(economy.getTransactionHistory(guildId, userId, 10)[0].reason, 'test:loss', 'coin history must return the newest transaction');
  const afterDraw = economy.settleBet({ guildId, userId, stake: 100, payout: 100, game: 'test', outcome: 'draw' });
  assert.equal(afterDraw.balance, afterLoss.balance);
  const afterWin = economy.settleBet({ guildId, userId, stake: 100, payout: 200, game: 'test', outcome: 'win' });
  assert.equal(afterWin.balance, testBalance);
  const stats = economy.getAccount(guildId, userId);
  assert.deepEqual([stats.games_played, stats.wins, stats.losses, stats.draws], [3, 1, 1, 1]);

  const dailyAt = Date.now();
  assert.equal(economy.claimDaily(guildId, userId, dailyAt).ok, true);
  assert.equal(economy.claimDaily(guildId, userId, dailyAt + 1000).ok, false);

  const receiverId = 'test-receiver';
  const beforeTransfer = economy.getAccount(guildId, userId).balance;
  const transfer = economy.transferCoins({ guildId, fromUserId: userId, toUserId: receiverId, amount: 125 });
  assert.equal(transfer.senderBalance, beforeTransfer - 125);
  assert.equal(transfer.receiverBalance, economy.STARTING_COINS + 125);
  assert.equal(economy.getAccount(guildId, userId).balance + economy.getAccount(guildId, receiverId).balance, beforeTransfer + economy.STARTING_COINS);

  const oldAdmins = process.env.ADMIN_USER_ID;
  process.env.ADMIN_USER_ID = '111111111111111';
  const afterAdminAdd = economy.addCoinsByAdmin({ guildId, userId, amount: 75, adminId: '111111111111111', reason: 'test' });
  assert.equal(afterAdminAdd.balance, transfer.senderBalance + 75);
  assert.throws(() => economy.addCoinsByAdmin({ guildId, userId, amount: 75, adminId: '222222222222222' }), /NOT_ADMIN/);
  const afterAdminRemove = economy.removeCoinsByAdmin({ guildId, userId, amount: 50, adminId: '111111111111111', reason: 'violation test' });
  assert.equal(afterAdminRemove.deducted, 50);
  assert.equal(afterAdminRemove.balance, afterAdminAdd.balance - 50);
  const penaltyUserId = 'test-penalty-user';
  economy.getAccount(guildId, penaltyUserId);
  db.prepare('UPDATE economy_accounts SET balance = 40 WHERE guild_id = ? AND user_id = ?').run(guildId, penaltyUserId);
  const clampedPenalty = economy.removeCoinsByAdmin({ guildId, userId: penaltyUserId, amount: 100, adminId: '111111111111111' });
  assert.equal(clampedPenalty.deducted, 40);
  assert.equal(clampedPenalty.balance, 0);
  assert.throws(() => economy.removeCoinsByAdmin({ guildId, userId, amount: 1, adminId: '222222222222222' }), /NOT_ADMIN/);
  if (oldAdmins === undefined) delete process.env.ADMIN_USER_ID; else process.env.ADMIN_USER_ID = oldAdmins;

  channels.setGameChannel(guildId, 'noitu', 'channel-noitu');
  channels.setGameChannel(guildId, 'baucua', 'channel-baucua');
  assert.equal(channels.getGameChannel(guildId, 'noitu').channel_id, 'channel-noitu');
  assert.throws(() => channels.setGameChannel(guildId, 'taixiu', 'channel-noitu'), /CHANNEL_IN_USE/);

  const wordSession = games.startWordSession(guildId, { forceHard: false });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM game_sessions WHERE guild_id = ? AND game = 'noitu'").get(guildId).count, 1);
  const answer = games.WORDS.find(word => {
    const words = normalizeVietnamese(word).split(' ');
    return words[0] === wordSession.required && !wordSession.used.has(normalizeVietnamese(word)) && games.continuationCount(word) > 2;
  });
  assert(answer, 'word game should always start with a playable chain');
  assert.equal(games.playWord(guildId, answer, 'word-player-a').ok, true);
  const nextAnswer = games.WORDS.find(word => normalizeVietnamese(word).split(' ')[0] === wordSession.required && !wordSession.used.has(normalizeVietnamese(word)));
  assert(nextAnswer, 'an accepted phrase must allow another player to continue');
  assert.equal(games.playWord(guildId, nextAnswer, 'word-player-a').error, 'WAIT_TURN', 'the same player must wait for another player');
  assert.equal(games.playWord(guildId, nextAnswer, 'word-player-b').ok, true, 'a different player may continue the chain');
  assert(games.skipWordSession(guildId), 'word game should support skipping without ending');
  assert.equal(games.getWordSession(guildId), wordSession, 'word session should remain shared and active');
  games.endWordSession(guildId);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM game_sessions WHERE guild_id = ? AND game = 'noitu'").get(guildId).count, 0);
  const terminalSession = games.startWordSession(guildId, { forceHard: false });
  const terminalWord = games.WORDS.find(word => games.continuationCount(word) === 0);
  assert(terminalWord, 'dictionary must contain terminal words that can win a chain');
  terminalSession.required = normalizeVietnamese(terminalWord).split(' ')[0];
  terminalSession.used.clear();
  const terminalResult = games.playWord(guildId, terminalWord, 'terminal-player');
  assert(terminalResult.chainWon && !terminalResult.nextHard, 'terminal word must win and open a normal chain');
  games.endWordSession(guildId);
  const accentWord = games.startWordSession(guildId, { forceHard: false });
  accentWord.required = 'sức';
  accentWord.used.clear();
  assert.equal(games.playWord(guildId, 'suc khoe', 'accent-player').ok, false, 'word-chain answers without Vietnamese accents must be rejected');
  assert.equal(games.playWord(guildId, 'sức khỏe', 'accent-player').ok, true, 'accented word-chain answer must be accepted');
  games.endWordSession(guildId);
  const noHardWord = games.startWordSession(guildId, { forceHard: true, now: 1_000 });
  assert.equal(noHardWord.hard, false, 'word chain must ignore hard-question options');
  assert.equal(noHardWord.expiresAt, null, 'word chain must never have a time limit');
  assert.equal(games.expireWordChallenge(guildId, 31_000), null, 'word chain must not expire');
  games.endWordSession(guildId);
  const suggestedPhrase = 'codex kiểm thử';
  assert.equal(games.knownWord(guildId, suggestedPhrase), null);
  const suggestion = wordSuggestions.submitSuggestion(guildId, userId, suggestedPhrase);
  assert.equal(wordSuggestions.listPendingSuggestions(guildId)[0].id, suggestion.id);
  wordSuggestions.reviewSuggestion(guildId, suggestion.id, 'admin', true);
  assert.equal(games.knownWord(guildId, suggestedPhrase), suggestedPhrase, 'an approved word must work immediately');

  const vua = games.startVuaSession(guildId, { forceHard: false });
  assert.notEqual(vua.question.mixed.replace(/[ ·]/g, ''), vua.question.answer.replace(/\s/g, ''), 'letters should be shuffled');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM game_sessions WHERE guild_id = ? AND game = 'vuatiengviet'").get(guildId).count, 1);
  assert.equal(games.getVuaSession(guildId), vua);
  vua.question.answer = 'hạnh phúc';
  assert.equal(games.answerVuaSession(guildId, 'hanh phuc').correct, false, 'Vietnamese scramble answers without accents must be rejected');
  assert.equal(games.getVuaSession(guildId).question, vua.question, 'wrong answer should keep the shared question');
  assert.equal(games.answerVuaSession(guildId, vua.question.answer).correct, true);
  assert(games.getVuaSession(guildId), 'correct answer should automatically open the next question');
  assert(games.skipVuaSession(guildId), 'Vietnamese game should support skipping');
  games.endVuaSession(guildId);
  const hardVua = games.startVuaSession(guildId, { forceHard: true, now: 2_000 });
  assert.equal(hardVua.question.expiresAt, 32_000);
  const expiredVua = games.expireVuaChallenge(guildId, 32_000);
  assert(expiredVua && !expiredVua.nextQuestion.hard, 'expired hard Vietnamese question must become a normal question');
  games.endVuaSession(guildId);

  assert.deepEqual(parseAddGold('!addgold <@111111111111111> 500 event reward'), { userId: '111111111111111', amount: 500, reason: 'event reward' });
  assert.deepEqual(parseAddGold('!addgold 111111111111111 25'), { userId: '111111111111111', amount: 25, reason: 'prefix' });
  assert.equal(parseAddGold('!addgold invalid'), null);
  assert.deepEqual(parseRemoveGold('!removegold <@!111111111111111> 500 spam game'), { userId: '111111111111111', amount: 500, reason: 'spam game' });
  assert.deepEqual(parseRemoveGold('!removegold 111111111111111 25'), { userId: '111111111111111', amount: 25, reason: 'violation' });
  assert.equal(parseRemoveGold('!removegold invalid'), null);
  assert.equal(rewards.setGameReward(guildId, 'noitu', 321), 321);
  assert.equal(rewards.getGameReward(guildId, 'noitu'), 321);
  assert.throws(() => rewards.setGameReward(guildId, 'taixiu', 10), /INVALID_REWARD_GAME/);
  assert.equal(betLimits.getGameBetLimit(guildId, 'blackjack'), 100_000);
  assert.equal(betLimits.setGameBetLimit(guildId, 'blackjack', 100), 100);
  assert.equal(betLimits.getGameBetLimit(guildId, 'blackjack'), 100);
  assert.throws(() => betLimits.setGameBetLimit(guildId, 'blackjack', 9), /INVALID_MAX_BET/);
  const limitedBlackjackUser = 'blackjack-limit';
  economy.getAccount(guildId, limitedBlackjackUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, limitedBlackjackUser);
  assert.throws(() => blackjack.startBlackjack({ guildId, userId: limitedBlackjackUser, channelId: 'channel-blackjack', stake: 101 }), /BET_LIMIT/);
  const limitedBlackjack = blackjack.startBlackjack({ guildId, userId: limitedBlackjackUser, channelId: 'channel-blackjack', stake: 60, forcedDeck: ['K♠', '5♣', '7♦', '6♣', '9♥', '10♠'] });
  assert.throws(() => blackjack.playAction({ sessionId: limitedBlackjack.session.id, userId: limitedBlackjackUser, action: 'double' }), /BET_LIMIT/, 'double must respect total server bet limit');
  blackjack.playAction({ sessionId: limitedBlackjack.session.id, userId: limitedBlackjackUser, action: 'forfeit' });
  betLimits.setGameBetLimit(guildId, 'blackjack', 100_000);

  assert.deepEqual(blackjack.handScore(['A♠', 'A♥', '9♦']), { total: 21, soft: true });
  assert.equal(blackjack.handScore(['K♠', 'Q♥', '2♦']).total, 22);
  assert.equal(horseRace.weightedWinner(0), 'sao_bang');
  assert.equal(horseRace.weightedWinner(32), 'bao_den');
  assert.equal(horseRace.weightedWinner(99), 'set_trang');
  assert.equal(Object.values(horseRace.HORSES).reduce((sum, horse) => sum + horse.weight, 0), 100);
  assert(mines.multiplierFor(1, 3, 100) > 1, 'one safe Mines cell must increase the multiplier');
  const minesUser = 'mines-safe';
  economy.getAccount(guildId, minesUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, minesUser);
  const minesGame = mines.startMines({ guildId, userId: minesUser, channelId: 'channel-mines', stake: 100, mineCount: 3, forcedMines: [0, 1, 2] });
  const safeCell = mines.playMines({ sessionId: minesGame.session.id, userId: minesUser, action: 'open', cell: 3 });
  assert(!safeCell.settled && safeCell.state.opened.includes(3));
  const cashed = mines.playMines({ sessionId: minesGame.session.id, userId: minesUser, action: 'cashout' });
  assert(cashed.settled && cashed.result.outcome === 'win' && cashed.result.payout > 100);
  const minesLossUser = 'mines-loss';
  economy.getAccount(guildId, minesLossUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, minesLossUser);
  const doomed = mines.startMines({ guildId, userId: minesLossUser, channelId: 'channel-mines', stake: 100, mineCount: 1, forcedMines: [0] });
  const exploded = mines.playMines({ sessionId: doomed.session.id, userId: minesLossUser, action: 'open', cell: 0 });
  assert(exploded.settled && exploded.result.outcome === 'loss' && LOSS_TAUNTS.includes(exploded.result.taunt));
  assert.equal(hardcore.hitChance(100, 0), 0.95);
  assert.equal(hardcore.hitChance(0, 200), 0.2);
  assert(hardcore.defenseReduction(100, 10) > 0 && hardcore.defenseReduction(100, 10) < 0.75);
  assert.equal(hardcore.magicAfterResistance(100, 25), 75);
  assert(hardcore.enemyScale(60).hp > hardcore.enemyScale(50).hp, 'enemy scaling must accelerate after floor 50');
  const calmChaos = { floor: 20, rngesusDry: 0 };
  assert.equal(hardcore.rollRngesus(calmChaos, { volatilityRoll: 0, spikeRoll: 1, severityRoll: 0, encounterRoll: 0.003 }), false);
  assert.equal(calmChaos.lastChaosChance, 0.0025);
  const spikingChaos = { floor: 20, rngesusDry: 50 };
  assert.equal(hardcore.rollRngesus(spikingChaos, { volatilityRoll: 1, spikeRoll: 0, severityRoll: 1, encounterRoll: 0.11 }), true);
  assert.equal(spikingChaos.lastChaosChance, 0.12);
  assert.equal(spikingChaos.lastChaosSpike, true);
  assert.match(hardcore.chaosLabel(spikingChaos), /NGUY HIỂM/);
  const hardcoreUser = 'hardcore-safe';
  economy.getAccount(guildId, hardcoreUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, hardcoreUser);
  const dummy = { type: 'combat', rank: 'normal', name: 'Training Dummy', hp: 1, maxHp: 1, damageMin: 1, damageMax: 1, defense: 0, accuracy: 0, evasion: 0, critChance: 0, critDamage: 1.5, critResistance: 0, resistance: 0, rewardMultiplier: 1 };
  const hardcoreRun = hardcore.startHardcore({ guildId, userId: hardcoreUser, channelId: 'channel-hardcore', stake: 100, classKey: 'sorceress', forcedEncounter: dummy });
  const cleared = hardcore.playHardcore({ sessionId: hardcoreRun.session.id, userId: hardcoreUser, expectedTurn: 0, action: 'skill' });
  assert(!cleared.settled && cleared.state.cleared === 1 && hardcore.potentialPayout(cleared.state) > 100);
  assert.throws(() => hardcore.playHardcore({ sessionId: hardcoreRun.session.id, userId: hardcoreUser, expectedTurn: 0, action: 'retreat' }), /STALE_ACTION/);
  const escaped = hardcore.playHardcore({ sessionId: hardcoreRun.session.id, userId: hardcoreUser, expectedTurn: 1, action: 'retreat' });
  assert(escaped.settled && escaped.result.outcome === 'win');
  assert.equal(hardcore.getHardcoreRecord(guildId, hardcoreUser).best_floor, 1);
  const doomedHardcoreUser = 'hardcore-doomed';
  economy.getAccount(guildId, doomedHardcoreUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, doomedHardcoreUser);
  const doomedRun = hardcore.startHardcore({ guildId, userId: doomedHardcoreUser, channelId: 'channel-hardcore', stake: 100, classKey: 'barbarian', forcedEncounter: { type: 'rngesus', name: 'RNGesus', fleeSuccess: false, prayerSuccess: false } });
  const cursed = hardcore.playHardcore({ sessionId: doomedRun.session.id, userId: doomedHardcoreUser, expectedTurn: 0, action: 'fight' });
  assert(cursed.settled && cursed.result.outcome === 'loss' && LOSS_TAUNTS.some(taunt => cursed.result.taunt.includes(taunt)));
  const naturalUser = 'blackjack-natural';
  economy.getAccount(guildId, naturalUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, naturalUser);
  const natural = blackjack.startBlackjack({ guildId, userId: naturalUser, channelId: 'channel-blackjack', stake: 100, forcedDeck: ['9♦', 'K♣', '7♥', 'A♠'] });
  assert(natural.immediate && natural.result.outcome === 'win');
  assert.equal(economy.getAccount(guildId, naturalUser).balance, 1150, 'natural blackjack must pay 3:2 profit');
  const playUser = 'blackjack-play';
  economy.getAccount(guildId, playUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, playUser);
  const activeBlackjack = blackjack.startBlackjack({ guildId, userId: playUser, channelId: 'channel-blackjack', stake: 100, forcedDeck: ['K♠', '5♣', '7♦', '6♣', '9♥', '10♠'] });
  assert(!activeBlackjack.immediate);
  const blackjackWin = blackjack.playAction({ sessionId: activeBlackjack.session.id, userId: playUser, action: 'hit' });
  assert(blackjackWin.settled && blackjackWin.result.outcome === 'win');
  assert.equal(economy.getAccount(guildId, playUser).balance, 1100);
  const splitUser = 'blackjack-split';
  economy.getAccount(guildId, splitUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, splitUser);
  const splitGame = blackjack.startBlackjack({ guildId, userId: splitUser, channelId: 'channel-blackjack', stake: 100, forcedDeck: ['K♦', '3♠', '7♦', '8♥', '10♣', '8♠'] });
  const split = blackjack.playAction({ sessionId: splitGame.session.id, userId: splitUser, action: 'split' });
  assert.equal(split.state.hands.length, 2);
  assert.equal(economy.getAccount(guildId, splitUser).balance, 800, 'split must reserve a second stake');
  blackjack.playAction({ sessionId: splitGame.session.id, userId: splitUser, action: 'forfeit' });
  for (const excludedType of ['CYCLE', 'RELIC', 'TROPHY', 'UMO']) {
    assert(!ITEM_QUIZ_TYPES.includes(excludedType), `item quiz source types must exclude ${excludedType}`);
  }
  assert(ITEM_QUIZ_TYPES.includes('RW'), 'runewords must be merged into the item quiz');
  assert.deepEqual(HARD_ITEM_QUIZ_TYPES, ['TU', 'SU', 'SET', 'RW']);
  assert.deepEqual([...new Set(QUESTION_MODES_BY_TYPE.TU)].sort(), ['base', 'requiredLevel'], 'TU must ask only base and Required Level');
  assert(QUESTION_MODES_BY_TYPE.TU.filter(mode => mode === 'base').length > QUESTION_MODES_BY_TYPE.TU.filter(mode => mode === 'requiredLevel').length, 'TU must favor base questions');
  for (const type of ['SU', 'SET']) assert.deepEqual([...QUESTION_MODES_BY_TYPE[type]].sort(), ['base', 'itemLevel', 'requiredLevel'], `${type} must support base and level questions`);
  assert.deepEqual(QUESTION_MODES_BY_TYPE.RW, ['base'], 'runewords must ask only their equipment base');
  const hardItem = medianQuiz.startMedianQuiz(guildId, 'doanitem', { forceHard: true, now: 3_000 });
  assert(hardItem.question.hard && ['base', 'requiredLevel', 'itemLevel'].includes(hardItem.question.answerMode) && hardItem.question.expiresAt === 33_000);
  const hardItemText = medianQuiz.quizText(hardItem.question);
  assert(!/\*\*Loại:\*\*|\*\*Base\/nhóm:\*\*|\*\*Rune\/Tier:\*\*|\*\*(?:Required|Item) Level:\*\*/.test(hardItemText), 'hard item question must hide easy metadata clues');
  const expiredItem = medianQuiz.expireMedianQuiz(guildId, 'doanitem', 33_000);
  assert(expiredItem && !expiredItem.nextQuestion.hard, 'expired hard item question must become a normal question');
  medianQuiz.endMedianQuiz(guildId, 'doanitem');

  const schemas = commands.map(command => command.data.toJSON());
  assert.deepEqual(schemas.map(schema => schema.name), ['xu', 'hoso', 'noitu', 'baucua', 'oantuti', 'taixiu', 'blackjack', 'duangua', 'mines', 'hardcore', 'vuatiengviet', 'game', 'doanitem', 'trochoi', 'shop', 'buy', 'inventory', 'use', 'collection', 'craft', 'giftitem', 'anxin', 'nhiemvu', 'sukien', 'xephang']);
  assert(schemas.every(schema => schema.description), 'every game command needs a description');
  for (const name of ['noitu', 'vuatiengviet']) {
    const schema = schemas.find(item => item.name === name);
    const start = schema.options.find(option => option.name === 'batdau');
    assert.equal(start.options?.length || 0, 0, `/${name} batdau must not accept a fee or wager`);
  }
  assert(!schemas.find(item => item.name === 'noitu').options.some(option => option.name === 'noi'), 'word answers should be normal messages');
  assert(!schemas.find(item => item.name === 'vuatiengviet').options.some(option => option.name === 'traloi'), 'Vietnamese answers should be normal messages');
  const help = commands.find(command => command.data.toJSON().name === 'trochoi').helpEmbed('!').toJSON();
  assert(!/\/game setup|\/game reward|!setreward|!addgold|!removegold|ketthuc/i.test(JSON.stringify(help)), 'player help must exclude admin commands');
  assert.throws(() => economy.settleBet({ guildId, userId, stake: 1, payout: 0, game: 'test', outcome: 'loss' }), /INVALID_BET/);
  assert(LOSS_TAUNTS.length >= 10, 'wager games need a varied loss-taunt pool');

  const dealerNaturalUser = 'blackjack-dealer-natural';
  economy.getAccount(guildId, dealerNaturalUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, dealerNaturalUser);
  const dealerNatural = blackjack.startBlackjack({
    guildId,
    userId: dealerNaturalUser,
    channelId: 'channel-blackjack',
    stake: 100,
    forcedDeck: ['K♣', '7♥', 'A♠', '9♦'],
  });
  assert(dealerNatural.immediate && dealerNatural.result.outcome === 'loss');
  assert.equal(economy.getAccount(guildId, dealerNaturalUser).balance, 900, 'dealer natural blackjack must take the stake');

  const bothNaturalUser = 'blackjack-both-natural';
  economy.getAccount(guildId, bothNaturalUser);
  db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, bothNaturalUser);
  const bothNatural = blackjack.startBlackjack({
    guildId,
    userId: bothNaturalUser,
    channelId: 'channel-blackjack',
    stake: 100,
    forcedDeck: ['K♣', 'A♥', 'A♠', 'K♦'],
  });
  assert(bothNatural.immediate && bothNatural.result.outcome === 'draw');
  assert.equal(economy.getAccount(guildId, bothNaturalUser).balance, 1000, 'two natural blackjacks must push');
  assert(progression.getGameLeaderboard(guildId, 'blackjack').length >= 1, 'each game must have its own leaderboard');

  console.log(JSON.stringify({
    ok: true,
    commands: schemas.map(schema => schema.name),
    balance: economy.getAccount(guildId, userId).balance,
  }));
} finally {
  db.prepare('DELETE FROM server_event_contributions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM server_events WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM season_claims WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM season_scores WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM player_progress WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM game_player_stats WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM word_suggestions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM multiplayer_bets WHERE round_id IN (SELECT id FROM multiplayer_rounds WHERE guild_id = ?)').run(guildId);
  db.prepare('DELETE FROM multiplayer_rounds WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM blackjack_sessions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM mines_sessions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM hardcore_sessions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM hardcore_records WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM game_sessions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM game_rewards WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM game_bet_limits WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM game_channels WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM economy_transactions WHERE guild_id = ?').run(guildId);
  db.prepare('DELETE FROM economy_accounts WHERE guild_id = ?').run(guildId);
}

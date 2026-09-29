const assert = require('node:assert/strict');
const { db } = require('../src/db');
const { setGameChannel } = require('../src/services/gameChannelService');
const { getAccount, STARTING_COINS } = require('../src/services/economyService');
const games = require('../src/services/funGameService');
const { normalizeVietnamese } = require('../src/utils/text');
const { handleGameMessage } = require('../src/services/gameMessageService');
const { handleGamePrefix } = require('../src/services/gamePrefixService');
const { getMedianQuiz, startMedianQuiz, endMedianQuiz } = require('../src/services/medianQuizService');
const { setGameReward, getGameReward } = require('../src/services/gameRewardService');
const { getOpenRound, handleBetButton, handleBetModal, settleRound, calculatePayout } = require('../src/services/multiplayerGameService');
const { getOpenHorseRace, handleHorseButton, handleHorseModal, settleHorseRace, HORSES } = require('../src/services/horseRaceService');
const { setGameBetLimit, getGameBetLimit } = require('../src/services/gameBetLimitService');
const xuCommand = require('../src/commands/xu');
const xephangCommand = require('../src/commands/xephang');

const commandCases = [
  { name: 'baucua', command: require('../src/commands/baucua') },
  { name: 'oantuti', command: require('../src/commands/oantuti'), strings: { chon: 'bua' }, integers: { xu: 10 } },
  { name: 'taixiu', command: require('../src/commands/taixiu') },
  { name: 'blackjack', command: require('../src/commands/blackjack'), integers: { xu: 10 } },
  { name: 'duangua', command: require('../src/commands/duangua') },
  { name: 'mines', command: require('../src/commands/mines'), integers: { xu: 10, min: 3 } },
  { name: 'hardcore', command: require('../src/commands/hardcore'), subcommand: 'batdau', integers: { xu: 10 }, strings: { class: 'barbarian' } },
  { name: 'noitu', command: require('../src/commands/noitu'), subcommand: 'batdau' },
  { name: 'vuatiengviet', command: require('../src/commands/vuatiengviet'), subcommand: 'batdau' },
  { name: 'doanitem', command: require('../src/commands/doanitem'), subcommand: 'batdau' },
];

const guildId = `test-command-${Date.now()}`;
const userIds = [];

function mockInteraction(testCase, userId, channelId) {
  const responses = [];
  return {
    guildId,
    channelId,
    user: { id: userId, bot: false },
    options: {
      getSubcommand: () => testCase.subcommand,
      getString: name => testCase.strings?.[name] ?? null,
      getInteger: name => testCase.integers?.[name] ?? null,
    },
    replied: false,
    deferred: false,
    client: null,
    responses,
    async reply(payload) { this.replied = true; responses.push(payload); return payload; },
    async followUp(payload) { responses.push(payload); return payload; },
  };
}

function mockBetModal(game, roundId, choice, userId, amount, target = null) {
  const responses = [];
  return {
    customId: `gamebet-modal:${game}:${roundId}:${choice}`,
    guildId,
    channelId: `channel-${game}`,
    user: { id: userId },
    client: null,
    fields: { getTextInputValue: name => name === 'amount' ? String(amount) : String(target) },
    responses,
    async reply(payload) { responses.push(payload); return payload; },
  };
}

function mockBetButton(game, roundId, choice, userId) {
  return {
    customId: `gamebet:${game}:${roundId}:${choice}`,
    guildId,
    channelId: `channel-${game}`,
    user: { id: userId },
    shownModal: null,
    async showModal(modal) { this.shownModal = modal; return modal; },
    async reply(payload) { this.response = payload; return payload; },
  };
}

function mockMessage(content, userId, channelId) {
  const responses = [];
  const reactions = [];
  return {
    guildId,
    channelId,
    content,
    author: { id: userId, bot: false },
    client: null,
    guild: null,
    member: null,
    responses,
    reactions,
    async reply(payload) { responses.push(payload); return payload; },
    async react(emoji) { reactions.push(emoji); return emoji; },
  };
}

(async () => {
  try {
    setGameBetLimit(guildId, 'baucua', 100);
    setGameBetLimit(guildId, 'duangua', 100);
    for (const [index, testCase] of commandCases.entries()) {
      const channelId = `channel-${testCase.name}`;
      const userId = `user-${index}`;
      userIds.push(userId);
      setGameChannel(guildId, testCase.name, channelId);
      const freeGame = ['noitu', 'vuatiengviet', 'doanitem', 'baucua', 'taixiu', 'duangua'].includes(testCase.name);
      getAccount(guildId, userId);
      if (!freeGame) db.prepare('UPDATE economy_accounts SET balance = 100 WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
      const balanceBefore = getAccount(guildId, userId).balance;
      const interaction = mockInteraction(testCase, userId, channelId);
      await testCase.command.execute(interaction);
      assert.equal(interaction.responses.length, 1, `/${testCase.name} should send one response`);
      const balance = getAccount(guildId, userId).balance;
      if (freeGame) {
        assert.equal(balance, balanceBefore, `/${testCase.name} must not charge an opening fee`);
      } else if (['blackjack', 'mines', 'hardcore'].includes(testCase.name)) {
        assert(balance >= balanceBefore - 10, `/${testCase.name} must reserve only the selected initial stake before settlement`);
      } else {
        assert.equal(getAccount(guildId, userId).games_played, 1, `/${testCase.name} should settle the selected wager`);
      }
    }


    assert.equal(calculatePayout('taixiu', 'tai', 100, { dice: [4, 4, 3], total: 11, triple: false }), 200);
    assert.equal(calculatePayout('taixiu', 'tai', 100, { dice: [4, 4, 4], total: 12, triple: true }), 0);
    assert.equal(calculatePayout('taixiu', 'bo_ba', 100, { dice: [4, 4, 4], total: 12, triple: true }), 3200);
    assert.equal(calculatePayout('taixiu', 'tong:4', 100, { dice: [1, 1, 2], total: 4, triple: false }), 6300);

    const multiCases = [
      { game: 'baucua', choice: 'bau', dice: ['bau', 'cua', 'bau'], expected: 1200 },
      { game: 'taixiu', choice: 'tai', dice: [4, 4, 3], expected: 1100 },
    ];
    for (const item of multiCases) {
      const round = getOpenRound(guildId, item.game);
      const player = `multi-${item.game}`;
      getAccount(guildId, player);
      db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, player);
      const button = mockBetButton(item.game, round.id, item.choice, player);
      await handleBetButton(button);
      assert(button.shownModal, `${item.game} button should open a bet modal`);
      const modal = mockBetModal(item.game, round.id, item.choice, player, 100);
      await handleBetModal(modal);
      assert.match(modal.responses[0].content, /Đã cược/);
      if (item.game === 'baucua') {
        const overLimit = mockBetModal(item.game, round.id, 'cua', player, 10);
        await handleBetModal(overLimit);
        assert.match(overLimit.responses[0].content, /Tổng cược tối đa/);
      }
      assert.equal(getAccount(guildId, player).balance, 900);
      await settleRound(round.id, null, console, item.dice);
      assert.equal(getAccount(guildId, player).balance, item.expected);
      assert.equal(getAccount(guildId, player).games_played, 1);
    }

    const horseRound = getOpenHorseRace(guildId);
    assert(horseRound, '/duangua must open one shared race');
    const horsePlayers = [
      { id: 'horse-winner', horse: 'sao_bang', expected: 1180 },
      { id: 'horse-loser', horse: 'set_trang', expected: 900 },
    ];
    for (const player of horsePlayers) {
      getAccount(guildId, player.id);
      db.prepare('UPDATE economy_accounts SET balance = 1000 WHERE guild_id = ? AND user_id = ?').run(guildId, player.id);
      const button = { customId: `horserace:${horseRound.id}:${player.horse}`, guildId, channelId: 'channel-duangua', user: { id: player.id }, async showModal(modal) { this.modal = modal; }, async reply(payload) { this.response = payload; } };
      await handleHorseButton(button);
      assert(button.modal, 'horse button must open a bet modal');
      const modal = { customId: `horserace-modal:${horseRound.id}:${player.horse}`, guildId, channelId: 'channel-duangua', user: { id: player.id }, client: null, fields: { getTextInputValue: () => '100' }, responses: [], async reply(payload) { this.responses.push(payload); } };
      await handleHorseModal(modal);
      assert.match(modal.responses[0].content, /Đã cược/);
      if (player.id === 'horse-winner') {
        const overLimit = { customId: `horserace-modal:${horseRound.id}:bao_den`, guildId, channelId: 'channel-duangua', user: { id: player.id }, client: null, fields: { getTextInputValue: () => '10' }, responses: [], async reply(payload) { this.responses.push(payload); } };
        await handleHorseModal(overLimit);
        assert.match(overLimit.responses[0].content, /Tổng cược tối đa/);
      }
    }
    const horseSettled = await settleHorseRace(horseRound.id, null, console, 'sao_bang');
    assert.equal(horseSettled.settlements.length, 2, 'horse race must settle all players together');
    for (const player of horsePlayers) assert.equal(getAccount(guildId, player.id).balance, player.expected);
    assert.equal(HORSES.sao_bang.multiplier, 2.8);

    const wordSession = games.getWordSession(guildId);
    const wordAnswer = games.WORDS.find(word => games.continuationCount(word) > 2);
    wordSession.required = normalizeVietnamese(wordAnswer).split(' ')[0];
    wordSession.used.clear();
    const wordPlayer = 'shared-word-player';
    userIds.push(wordPlayer);
    setGameReward(guildId, 'noitu', 123);
    const wrongWord = mockMessage('đáp án chắc chắn sai', wordPlayer, 'channel-noitu');
    assert.equal(await handleGameMessage(wrongWord), true);
    assert.equal(wrongWord.responses.length, 0, 'wrong word answers must stay silent');
    const wordTurn = mockMessage(wordAnswer, wordPlayer, 'channel-noitu');
    assert.equal(await handleGameMessage(wordTurn), true);
    assert(wordTurn.reactions.includes('✅'), 'a valid word must receive a check reaction');
    assert.equal(wordTurn.responses.length, 0, 'an ordinary valid word must not create a bot message');
    assert.equal(getAccount(guildId, wordPlayer).balance, STARTING_COINS + 123);
    const historyInteraction = mockInteraction({ subcommand: 'lichsu' }, wordPlayer, 'channel-noitu');
    await xuCommand.execute(historyInteraction);
    assert.match(historyInteraction.responses[0].embeds[0].data.title, /LỊCH SỬ XU/);
    assert.match(historyInteraction.responses[0].embeds[0].data.description, /Nối từ · thắng/);
    const gameRankInteraction = mockInteraction({ subcommand: 'game', strings: { trochoi: 'noitu' } }, wordPlayer, 'channel-noitu');
    await xephangCommand.execute(gameRankInteraction);
    assert.match(gameRankInteraction.responses[0].embeds[0].data.title, /Nối từ/i);

    const reportInteraction = mockInteraction({ subcommand: 'baotu', strings: { tu: 'codex lệnh thử' } }, 'suggest-player', 'channel-noitu');
    await commandCases.find(item => item.name === 'noitu').command.execute(reportInteraction);
    assert.match(reportInteraction.responses[0].content, /Đã gửi/);
    const suggestionId = db.prepare("SELECT id FROM word_suggestions WHERE guild_id=? AND phrase='codex lệnh thử'").get(guildId).id;
    const approveInteraction = mockInteraction({ subcommand: 'duyet', integers: { id: suggestionId } }, 'suggest-admin', 'channel-noitu');
    approveInteraction.memberPermissions = { has: () => true };
    await commandCases.find(item => item.name === 'noitu').command.execute(approveInteraction);
    assert.match(approveInteraction.responses[0].content, /Đã duyệt/);
    assert.equal(games.knownWord(guildId, 'codex lệnh thử'), 'codex lệnh thử');
    const prefixReport = mockMessage('!noitu baotu codex prefix thử', 'prefix-suggest-player', 'channel-noitu');
    assert.equal(await handleGamePrefix(prefixReport), true);
    assert.match(prefixReport.responses[0].content, /Đã gửi/);
    const prefixSuggestionId = db.prepare("SELECT id FROM word_suggestions WHERE guild_id=? AND phrase='codex prefix thử'").get(guildId).id;
    const prefixApprove = mockMessage(`!noitu duyet ${prefixSuggestionId}`, 'prefix-suggest-admin', 'channel-noitu');
    prefixApprove.member = { permissions: { has: () => true } };
    assert.equal(await handleGamePrefix(prefixApprove), true);
    assert.match(prefixApprove.responses[0].content, /Đã duyệt/);
    const directAdd = mockMessage('!noitu themtu codex admin thêm', 'prefix-suggest-admin', 'channel-noitu');
    directAdd.member = { permissions: { has: () => true } };
    assert.equal(await handleGamePrefix(directAdd), true);
    assert.match(directAdd.responses[0].content, /Đã thêm trực tiếp/);
    assert.equal(games.knownWord(guildId, 'codex admin thêm'), 'codex admin thêm');
    const customDictionary = mockMessage('!noitu tudien', 'prefix-suggest-player', 'channel-noitu');
    assert.equal(await handleGamePrefix(customDictionary), true);
    assert.match(customDictionary.responses[0].embeds[0].data.description, /codex admin thêm/);
    const directRemove = mockMessage('!noitu xoatu codex admin thêm', 'prefix-suggest-admin', 'channel-noitu');
    directRemove.member = { permissions: { has: () => true } };
    assert.equal(await handleGamePrefix(directRemove), true);
    assert.match(directRemove.responses[0].content, /Đã xóa/);
    assert.equal(games.knownWord(guildId, 'codex admin thêm'), null, 'a removed custom word must stop working immediately');
    const blockedDirectAdd = mockMessage('!noitu themtu codex không quyền', 'prefix-suggest-player', 'channel-noitu');
    assert.equal(await handleGamePrefix(blockedDirectAdd), true);
    assert.match(blockedDirectAdd.responses[0].content, /Chỉ admin/);
    const nextWordAnswer = games.WORDS.find(word => normalizeVietnamese(word).split(' ')[0] === games.getWordSession(guildId).required && !games.getWordSession(guildId).used.has(normalizeVietnamese(word)));
    const repeatedTurn = mockMessage(nextWordAnswer, wordPlayer, 'channel-noitu');
    assert.equal(await handleGameMessage(repeatedTurn), true);
    assert.equal(repeatedTurn.reactions.length, 0, 'the previous player must wait silently for another player');
    assert.equal(getAccount(guildId, wordPlayer).balance, STARTING_COINS + 123, 'a blocked repeat turn must not receive gold');
    const wordSkip = mockInteraction({ subcommand: 'boqua' }, 'skip-user', 'channel-noitu');
    await commandCases.find(item => item.name === 'noitu').command.execute(wordSkip);
    assert.match(wordSkip.responses[0].content, /Đã bỏ qua/);
    games.endWordSession(guildId);
    const terminalSession = games.startWordSession(guildId, { forceHard: false });
    const terminalWord = games.WORDS.find(word => games.continuationCount(word) === 0);
    terminalSession.required = normalizeVietnamese(terminalWord).split(' ')[0];
    terminalSession.used.clear();
    const terminalPlayer = 'terminal-word-player';
    const terminalTurn = mockMessage(terminalWord, terminalPlayer, 'channel-noitu');
    await handleGameMessage(terminalTurn);
    assert.match(terminalTurn.responses[0].content, /chiến thắng chuỗi/);
    assert.equal(getAccount(guildId, terminalPlayer).balance, STARTING_COINS + 1230, 'last valid word must pay x10');
    games.endWordSession(guildId);
    const forcedNormalWord = games.startWordSession(guildId, { forceHard: true });
    const normalWordAnswer = games.WORDS.find(word => normalizeVietnamese(word).split(' ')[0] === forcedNormalWord.required && !forcedNormalWord.used.has(normalizeVietnamese(word)) && games.continuationCount(word) > 2);
    const normalWordPlayer = 'normal-word-player';
    const normalWordTurn = mockMessage(normalWordAnswer, normalWordPlayer, 'channel-noitu');
    await handleGameMessage(normalWordTurn);
    assert(normalWordTurn.reactions.includes('✅'), 'a correct word must receive a check reaction');
    assert.equal(getAccount(guildId, normalWordPlayer).balance, STARTING_COINS + 123, 'word chain must not pay hard-question x10 rewards');

    const vuaPlayer = 'shared-vua-player';
    userIds.push(vuaPlayer);
    setGameReward(guildId, 'vuatiengviet', 234);
    const vuaQuestion = games.getVuaSession(guildId).question;
    const answer = vuaQuestion.answer;
    const wrongVua = mockMessage('đáp án chắc chắn sai', vuaPlayer, 'channel-vuatiengviet');
    assert.equal(await handleGameMessage(wrongVua), true);
    assert.equal(wrongVua.responses.length, 0, 'wrong Vietnamese answers must stay silent');
    const vuaTurn = mockMessage(answer, vuaPlayer, 'channel-vuatiengviet');
    assert.equal(await handleGameMessage(vuaTurn), true);
    assert.match(vuaTurn.responses[0].content, /nhận \*\*[\d.]+ xu\*\*/);
    assert.equal(getAccount(guildId, vuaPlayer).balance, STARTING_COINS + 234 * (vuaQuestion.hard ? 10 : 1));
    const vuaSkip = mockInteraction({ subcommand: 'boqua' }, 'skip-user', 'channel-vuatiengviet');
    await commandCases.find(item => item.name === 'vuatiengviet').command.execute(vuaSkip);
    assert.match(vuaSkip.responses[0].content, /Đáp án vừa bỏ qua/);
    games.endVuaSession(guildId);
    const forcedHardVua = games.startVuaSession(guildId, { forceHard: true });
    const hardVuaPlayer = 'hard-vua-player';
    const hardVuaTurn = mockMessage(forcedHardVua.question.answer, hardVuaPlayer, 'channel-vuatiengviet');
    await handleGameMessage(hardVuaTurn);
    assert.equal(getAccount(guildId, hardVuaPlayer).balance, STARTING_COINS + 2340, 'hard Vietnamese answer must pay x10');

    for (const game of ['doanitem']) {
      const player = `quiz-${game}`;
      const configuredReward = 345;
      setGameReward(guildId, game, configuredReward);
      const question = getMedianQuiz(guildId, game).question;
      assert(!['CYCLE', 'RELIC', 'TROPHY', 'UMO'].includes(question.type), 'item quiz must exclude non-equipment entries');
      assert(question.itemName, `${game} must reveal the item or runeword name`);
      assert(['base', 'requiredLevel', 'itemLevel'].includes(question.answerMode), `${game} must ask base or level metadata`);
      assert(question.acceptedAnswers.includes(question.answer), `${game} must accept its canonical answer`);
      const wrongQuiz = mockMessage('đáp án chắc chắn sai', player, `channel-${game}`);
      assert.equal(await handleGameMessage(wrongQuiz), true);
      assert.equal(wrongQuiz.responses.length, 0, `${game} wrong answers must stay silent`);
      const quizMessage = mockMessage(question.answer, player, `channel-${game}`);
      assert.equal(await handleGameMessage(quizMessage), true);
      assert.match(quizMessage.responses[0].content, /đoán đúng/);
      assert.equal(getAccount(guildId, player).balance, STARTING_COINS + configuredReward * (question.hard ? 10 : 1));
      const prefixSkip = mockMessage(`!${game} boqua`, 'prefix-player', `channel-${game}`);
      assert.equal(await handleGamePrefix(prefixSkip), true);
      assert.match(prefixSkip.responses[0].content, /Đáp án vừa bỏ qua/);
      endMedianQuiz(guildId, game);
      const forcedHardItem = startMedianQuiz(guildId, game, { forceHard: true });
      const hardItemPlayer = 'hard-item-player';
      const hardItemTurn = mockMessage(forcedHardItem.question.answer, hardItemPlayer, `channel-${game}`);
      await handleGameMessage(hardItemTurn);
      assert.equal(getAccount(guildId, hardItemPlayer).balance, STARTING_COINS + configuredReward * 10, 'hard item answer must pay x10');
    }

    const wordPrefix = mockMessage('!noitu boqua', 'prefix-player', 'channel-noitu');
    assert.equal(await handleGamePrefix(wordPrefix), true);
    assert.match(wordPrefix.responses[0].content, /Đã bỏ qua/);
    const vuaPrefix = mockMessage('!vuatiengviet boqua', 'prefix-player', 'channel-vuatiengviet');
    assert.equal(await handleGamePrefix(vuaPrefix), true);
    assert.match(vuaPrefix.responses[0].content, /Đáp án vừa bỏ qua/);

    for (const game of ['baucua', 'taixiu']) {
      const prefixRound = mockMessage(`!${game}`, 'prefix-player', `channel-${game}`);
      assert.equal(await handleGamePrefix(prefixRound), true);
      assert(prefixRound.responses[0].embeds, `!${game} should open a multiplayer round`);
    }
    const rpsPlayer = 'prefix-rps-player';
    getAccount(guildId, rpsPlayer);
    db.prepare('UPDATE economy_accounts SET balance = 100 WHERE guild_id = ? AND user_id = ?').run(guildId, rpsPlayer);
    const rpsPrefix = mockMessage('!oantuti bua 10', rpsPlayer, 'channel-oantuti');
    assert.equal(await handleGamePrefix(rpsPrefix), true);
    assert(rpsPrefix.responses[0].embeds, '!oantuti should execute the wager');
    const blackjackPrefixPlayer = 'prefix-blackjack-player';
    getAccount(guildId, blackjackPrefixPlayer);
    db.prepare('UPDATE economy_accounts SET balance = 100 WHERE guild_id = ? AND user_id = ?').run(guildId, blackjackPrefixPlayer);
    const blackjackPrefix = mockMessage('!blackjack 10', blackjackPrefixPlayer, 'channel-blackjack');
    assert.equal(await handleGamePrefix(blackjackPrefix), true);
    assert(blackjackPrefix.responses[0].embeds, '!blackjack should start an interactive hand');
    const horsePrefix = mockMessage('!duangua', 'prefix-horse-player', 'channel-duangua');
    assert.equal(await handleGamePrefix(horsePrefix), true);
    assert(horsePrefix.responses[0].embeds, '!duangua should open a shared race');
    const minesPrefixPlayer = 'prefix-mines-player';
    getAccount(guildId, minesPrefixPlayer);
    db.prepare('UPDATE economy_accounts SET balance = 100 WHERE guild_id = ? AND user_id = ?').run(guildId, minesPrefixPlayer);
    const minesPrefix = mockMessage('!mines 10 3', minesPrefixPlayer, 'channel-mines');
    assert.equal(await handleGamePrefix(minesPrefix), true);
    assert(minesPrefix.responses[0].embeds, '!mines should start an interactive board');
    const hardcorePrefixPlayer = 'prefix-hardcore-player';
    getAccount(guildId, hardcorePrefixPlayer);
    db.prepare('UPDATE economy_accounts SET balance = 100 WHERE guild_id = ? AND user_id = ?').run(guildId, hardcorePrefixPlayer);
    const hardcorePrefix = mockMessage('!hardcore 10 assassin', hardcorePrefixPlayer, 'channel-hardcore');
    assert.equal(await handleGamePrefix(hardcorePrefix), true);
    assert(hardcorePrefix.responses[0].embeds, '!hardcore should start an interactive run');
    const hardcoreProfile = mockMessage('!hardcore hoso', hardcorePrefixPlayer, 'any-channel');
    assert.equal(await handleGamePrefix(hardcoreProfile), true);
    assert(hardcoreProfile.responses[0].embeds, '!hardcore hoso should show a profile');
    const rewardPrefix = mockMessage('!setreward doanitem 777', 'prefix-admin', 'channel-doanitem');
    rewardPrefix.member = { permissions: { has: () => true } };
    assert.equal(await handleGamePrefix(rewardPrefix), true);
    assert.equal(getGameReward(guildId, 'doanitem'), 777);
    const maxBetPrefix = mockMessage('!setmaxbet mines 250', 'prefix-admin', 'channel-mines');
    maxBetPrefix.member = { permissions: { has: () => true } };
    assert.equal(await handleGamePrefix(maxBetPrefix), true);
    assert.equal(getGameBetLimit(guildId, 'mines'), 250);
    const maxBetsPrefix = mockMessage('!maxbets', 'prefix-player', 'any-channel');
    assert.equal(await handleGamePrefix(maxBetsPrefix), true);
    assert.match(maxBetsPrefix.responses[0].content, /Mines.*250/s);
    const helpPrefix = mockMessage('!trochoi', 'help-player', 'any-channel');
    assert.equal(await handleGamePrefix(helpPrefix), true);
    assert(helpPrefix.responses[0].embeds, '!trochoi should show the player game guide');

    const itemPrefix = mockMessage('!item SU Ophiophagus', 'item-prefix-player', 'any-channel');
    assert.equal(await handleGamePrefix(itemPrefix), true);
    assert.equal(itemPrefix.responses[0].embeds[0].data.title, 'Ophiophagus', '!item should reuse the detailed item embed');
    const itemPrefixHelp = mockMessage('!item', 'item-prefix-player', 'any-channel');
    assert.equal(await handleGamePrefix(itemPrefixHelp), true);
    assert.match(itemPrefixHelp.responses[0].content, /Cách dùng/);
    const ignoredChat = mockMessage('học sinh', 'wrong-channel-user', 'wrong-channel');
    assert.equal(await handleGameMessage(ignoredChat), false);
    assert.equal(ignoredChat.responses.length, 0);
    games.endWordSession(guildId);
    games.endVuaSession(guildId);

    const blockedUser = 'wrong-channel-user';
    userIds.push(blockedUser);
    const blocked = mockInteraction(commandCases[0], blockedUser, 'wrong-channel');
    await commandCases[0].command.execute(blocked);
    assert.match(blocked.responses[0].content, /chỉ được chơi tại/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM economy_accounts WHERE guild_id = ? AND user_id = ?').get(guildId, blockedUser).count, 0);
    console.log(JSON.stringify({ ok: true, executed: commandCases.map(item => item.name), prefixCommands: true, sharedAnswers: true, skipCommands: true, wrongChannelBlocked: true }));
  } finally {
    db.prepare('DELETE FROM server_event_contributions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM server_events WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM season_claims WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM season_scores WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM player_progress WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM game_player_stats WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM word_suggestions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM economy_transactions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM economy_accounts WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM game_channels WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM game_sessions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM game_rewards WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM multiplayer_bets WHERE round_id IN (SELECT id FROM multiplayer_rounds WHERE guild_id = ?)').run(guildId);
    db.prepare('DELETE FROM multiplayer_rounds WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM blackjack_sessions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM mines_sessions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM hardcore_sessions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM hardcore_records WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM game_bet_limits WHERE guild_id = ?').run(guildId);
    db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

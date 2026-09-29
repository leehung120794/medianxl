const { getGameByChannel } = require('./gameChannelService');
const { getWordSession, playWord, getVuaSession, answerVuaSession, vuaQuestionText } = require('./funGameService');
const { rewardGame } = require('./economyService');
const { formatCoins } = require('../utils/economy');
const { answerMedianQuiz, getMedianQuiz, quizText } = require('./medianQuizService');
const { getGameReward } = require('./gameRewardService');
const { boostedQuizReward } = require('./effectStateService');

async function reply(message, content) {
  return message.reply({ content, allowedMentions: { users: [], repliedUser: false } });
}

async function react(message, emoji) {
  try { if (typeof message.react === 'function') await message.react(emoji); } catch {}
}

async function handleWordMessage(message, answer) {
  if (!getWordSession(message.guildId)) return false;
  const result = playWord(message.guildId, answer, message.author.id);
  if (!result.ok) return true;
  const rewardResult = boostedQuizReward(message.guildId, message.author.id, getGameReward(message.guildId, 'noitu') * (result.chainWon ? 10 : 1));
  const reward = rewardResult.amount;
  const boostText = rewardResult.boosted ? ' ✨ **Bùa x2 đã kích hoạt!**' : '';
  const account = rewardGame({ guildId: message.guildId, userId: message.author.id, amount: reward, game: 'noitu', outcome: 'win' });
  await react(message, '✅');
  if (result.chainWon) {
    await reply(message, `🏆 <@${message.author.id}> đã nối từ cuối cùng **${result.answer}**, chiến thắng chuỗi và nhận **${formatCoins(reward)} xu**!${boostText}\n\n🤖 Chuỗi mới: **${result.botPhrase}**\nHãy bắt đầu bằng **${result.required}**.\nSố dư: **${formatCoins(account.balance)} xu**.`);
    return true;
  }
  return true;
}

async function handleVuaMessage(message, answer) {
  if (!getVuaSession(message.guildId)) return false;
  const result = answerVuaSession(message.guildId, answer);
  if (result.error === 'EXPIRED') {
    await reply(message, `⌛ Câu khó đã hết 30 giây và không còn hiệu lực.\n\nCâu thường mới:\n${vuaQuestionText(result.expiration.nextQuestion)}`);
    return true;
  }
  if (!result.correct) return true;
  const rewardResult = boostedQuizReward(message.guildId, message.author.id, getGameReward(message.guildId, 'vuatiengviet') * (result.question.hard ? 10 : 1));
  const reward = rewardResult.amount;
  const account = rewardGame({ guildId: message.guildId, userId: message.author.id, amount: reward, game: 'vuatiengviet', outcome: 'win' });
  await reply(message, `🎉 <@${message.author.id}> trả lời đúng **${result.question.answer}** và nhận **${formatCoins(reward)} xu**!${rewardResult.boosted ? ' ✨ **Bùa x2 đã kích hoạt!**' : ''}\n\nCâu tiếp theo:\n${vuaQuestionText(result.nextQuestion)}\nSố dư: **${formatCoins(account.balance)} xu**.`);
  return true;
}

async function handleMedianQuizMessage(message, game, answer) {
  if (!getMedianQuiz(message.guildId, game)) return false;
  const result = answerMedianQuiz(message.guildId, game, answer);
  if (result.error === 'EXPIRED') {
    await reply(message, `⌛ Câu khó đã hết 30 giây và không còn hiệu lực.\n\nCâu thường mới:\n${quizText(result.expiration.nextQuestion)}`);
    return true;
  }
  if (!result.correct) return true;
  const rewardResult = boostedQuizReward(message.guildId, message.author.id, getGameReward(message.guildId, game) * (result.question.hard ? 10 : 1));
  const reward = rewardResult.amount;
  const account = rewardGame({ guildId: message.guildId, userId: message.author.id, amount: reward, game, outcome: 'win' });
  await reply(message, `🎉 <@${message.author.id}> đoán đúng **${result.question.answer}** cho **${result.question.itemName}** và nhận **${formatCoins(reward)} xu**!${rewardResult.boosted ? ' ✨ **Bùa x2 đã kích hoạt!**' : ''}\n\nCâu tiếp theo:\n${quizText(result.nextQuestion)}\nSố dư: **${formatCoins(account.balance)} xu**.`);
  return true;
}

async function handleGameMessage(message) {
  if (!message.guildId || message.author?.bot) return false;
  const answer = String(message.content || '').trim();
  if (!answer || answer.length > 50 || answer.startsWith('/') || answer.startsWith(process.env.COMMAND_PREFIX || '!')) return false;
  const setting = getGameByChannel(message.guildId, message.channelId);
  if (setting?.game === 'noitu') return handleWordMessage(message, answer);
  if (setting?.game === 'vuatiengviet') return handleVuaMessage(message, answer);
  if (setting?.game === 'doanitem') return handleMedianQuizMessage(message, setting.game, answer);
  return false;
}

module.exports = { handleGameMessage };

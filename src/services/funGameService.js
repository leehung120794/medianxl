const crypto = require('node:crypto');
const { normalizeVietnamese } = require('../utils/text');
const { db } = require('../db');
const { getApprovedWords } = require('./wordSuggestionService');
const gameWordData = require('../../data/games/vietnamese-game-words.json');

const commandCooldowns = new Map();
const wordSessions = new Map();
const vuaSessions = new Map();
const HARD_DURATION_MS = 30_000;
const configuredHardChance = Number(process.env.HARD_QUESTION_CHANCE);
const HARD_QUESTION_CHANCE = Number.isFinite(configuredHardChance) ? Math.max(0, Math.min(1, configuredHardChance)) : 0.1;

const CORE_WORDS = [
  'học sinh', 'sinh viên', 'viên mãn', 'mãn nguyện', 'nguyện vọng', 'vọng cổ', 'cổ tích', 'tích cực', 'cực khổ', 'khổ đau',
  'đau lòng', 'lòng tốt', 'tốt bụng', 'bụng đói', 'đói khát', 'khát nước', 'nước mắt', 'mắt kính', 'kính trọng', 'trọng tài',
  'tài năng', 'năng động', 'động vật', 'vật lý', 'lý tưởng', 'tưởng tượng', 'tượng đá', 'đá quý', 'quý giá', 'giá trị',
  'trị bệnh', 'bệnh viện', 'viện trợ', 'trợ giúp', 'giúp đỡ', 'đỡ đầu', 'đầu tiên', 'tiên phong', 'phong cảnh', 'cảnh đẹp',
  'đẹp mắt', 'mắt sáng', 'sáng tạo', 'tạo hình', 'hình ảnh', 'ảnh hưởng', 'hưởng thụ', 'thụ động', 'động lực', 'lực lượng',
  'lượng sức', 'sức khỏe', 'khỏe mạnh', 'mạnh mẽ', 'ngoài trời', 'trời xanh', 'xanh lá', 'lá cây', 'cây cảnh',
  'cảnh giác', 'giác quan', 'quan trọng', 'trọng lượng', 'lượng giác', 'giác ngộ', 'ngộ nhận', 'nhận thức', 'thức ăn', 'ăn uống',
  'uống nước', 'nước hoa', 'hoa hồng', 'hồng hào', 'hào hứng', 'hứng thú', 'thú vị', 'vị trí', 'trí tuệ', 'tuệ giác',
];

const CURATED_VUA_QUESTIONS = [
  { answer: 'học sinh', hint: 'Người đang theo học' },
  { answer: 'tích cực', hint: 'Thái độ chủ động, tốt đẹp' },
  { answer: 'tưởng tượng', hint: 'Hình dung điều chưa có trước mắt' },
  { answer: 'quan trọng', hint: 'Có ý nghĩa lớn' },
  { answer: 'khỏe mạnh', hint: 'Có sức khỏe tốt' },
  { answer: 'động lực', hint: 'Điều thúc đẩy hành động' },
  { answer: 'nhận thức', hint: 'Sự hiểu biết' },
  { answer: 'tình nguyện', hint: 'Tự giác làm việc vì cộng đồng' },
  { answer: 'kinh nghiệm', hint: 'Điều tích lũy qua thực tế' },
  { answer: 'trách nhiệm', hint: 'Điều phải đảm nhận' },
  { answer: 'kiên nhẫn', hint: 'Bền bỉ chờ đợi' },
  { answer: 'tự tin', hint: 'Tin vào khả năng của mình' },
  { answer: 'đoàn kết', hint: 'Cùng chung sức' },
  { answer: 'sáng tạo', hint: 'Tạo ra điều mới' },
  { answer: 'hạnh phúc', hint: 'Trạng thái vui vẻ, mãn nguyện' },
];

const CURATED_HARD_VUA_QUESTIONS = [
  { answer: 'bất khả kháng', hint: 'Tình huống không thể lường trước hoặc kiểm soát' },
  { answer: 'chính trực', hint: 'Ngay thẳng và giữ nguyên tắc đạo đức' },
  { answer: 'khoan dung', hint: 'Biết tha thứ và cảm thông' },
  { answer: 'nghị lực', hint: 'Sức mạnh tinh thần giúp vượt khó' },
  { answer: 'thấu đáo', hint: 'Hiểu kỹ và đầy đủ mọi khía cạnh' },
  { answer: 'uyên bác', hint: 'Có kiến thức sâu rộng' },
  { answer: 'kiên định', hint: 'Vững vàng với lựa chọn của mình' },
  { answer: 'tương trợ', hint: 'Giúp đỡ lẫn nhau' },
];

const EXTRA_CHAIN_WORDS = gameWordData.vuaWords.filter(word => String(word).trim().split(/\s+/).length >= 2);
const WORDS = [...new Map([...CORE_WORDS, ...gameWordData.wordChains, ...EXTRA_CHAIN_WORDS].map(word => [normalizeVietnamese(word), word])).values()];
const generatedVuaQuestions = gameWordData.vuaWords.map(answer => {
  const syllables = answer.split(/\s+/).length;
  const letters = Array.from(answer.replace(/\s+/g, '')).length;
  return { answer, hint: `${syllables} tiếng • ${letters} chữ cái` };
});
const VUA_QUESTIONS = [...new Map([...generatedVuaQuestions, ...CURATED_VUA_QUESTIONS]
  .map(question => [normalizeVietnamese(question.answer), question])).values()];
const HARD_VUA_QUESTIONS = [...new Map([...VUA_QUESTIONS.filter(question => {
  const letters = Array.from(question.answer.replace(/\s+/g, '')).length;
  return question.answer.split(/\s+/).length >= 3 || letters >= 13;
}), ...CURATED_HARD_VUA_QUESTIONS].map(question => [normalizeVietnamese(question.answer), question])).values()];
const RECENT_WORD_LIMIT = 2_000;
const normalizedWords = new Map(WORDS.map(word => [normalizeVietnamese(word), word]));
let wordsByFirst;
let playableWords;

function saveSession(guildId, game, state) {
  const serializable = game === 'noitu' ? { ...state, used: [...state.used] } : state;
  db.prepare(`INSERT INTO game_sessions (guild_id, game, state_json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, game) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`)
    .run(String(guildId), game, JSON.stringify(serializable), Date.now());
}

function loadSession(guildId, game) {
  const row = db.prepare('SELECT state_json FROM game_sessions WHERE guild_id = ? AND game = ?').get(String(guildId), game);
  if (!row) return null;
  try {
    const state = JSON.parse(row.state_json);
    if (game === 'noitu') state.used = new Set(state.used || []);
    return state;
  } catch {
    db.prepare('DELETE FROM game_sessions WHERE guild_id = ? AND game = ?').run(String(guildId), game);
    return null;
  }
}

function deleteSession(guildId, game) {
  db.prepare('DELETE FROM game_sessions WHERE guild_id = ? AND game = ?').run(String(guildId), game);
}

function randomItem(items) {
  return items[crypto.randomInt(items.length)];
}

function shouldBeHard(options = {}) {
  if (options.forceHard === true) return true;
  if (options.forceHard === false) return false;
  return Math.random() < HARD_QUESTION_CHANCE;
}

function challengeMeta(hard, now = Date.now()) {
  return { hard, expiresAt: hard ? now + HARD_DURATION_MS : null };
}

function isExpiredChallenge(value, now = Date.now()) {
  return Boolean(value?.hard && value.expiresAt && now >= value.expiresAt);
}

function firstWord(phrase) {
  return normalizeVietnamese(phrase).split(' ')[0] || '';
}

function lastWord(phrase) {
  return normalizeVietnamese(phrase).split(' ').at(-1) || '';
}

wordsByFirst = new Map();
for (const word of WORDS) {
  const first = firstWord(word);
  if (!wordsByFirst.has(first)) wordsByFirst.set(first, []);
  wordsByFirst.get(first).push(word);
}
function playableContinuationCount(phrase) {
  const normalized = normalizeVietnamese(phrase);
  return (wordsByFirst.get(lastWord(phrase)) || []).filter(next => normalizeVietnamese(next) !== normalized).length;
}

playableWords = WORDS.filter(word => playableContinuationCount(word) > 0);

function consumeCommandCooldown(guildId, userId, game, milliseconds = 3000, now = Date.now()) {
  const key = `${guildId}:${userId}:${game}`;
  const remaining = Math.max(0, (commandCooldowns.get(key) || 0) - now);
  if (remaining > 0) return remaining;
  commandCooldowns.set(key, now + milliseconds);
  return 0;
}

function continuationCount(phrase) {
  return (wordsByFirst.get(lastWord(phrase)) || []).length;
}

function approvedWordMap(guildId) {
  return new Map(getApprovedWords(guildId).map(word => [normalizeVietnamese(word), word]));
}

function knownWord(guildId, phrase) {
  const normalized = normalizeVietnamese(phrase);
  return normalizedWords.get(normalized) || approvedWordMap(guildId).get(normalized) || null;
}

function continuationsFor(guildId, required) {
  const combined = [...(wordsByFirst.get(required) || []), ...getApprovedWords(guildId).filter(word => firstWord(word) === required)];
  return [...new Map(combined.map(word => [normalizeVietnamese(word), word])).values()];
}

function chooseWordChallenge(hard, recent = []) {
  const recentSet = new Set(recent);
  let candidates = playableWords.filter(word => !recentSet.has(normalizeVietnamese(word)));
  if (!candidates.length) candidates = playableWords;
  if (hard) {
    const minimum = Math.min(...candidates.map(playableContinuationCount));
    candidates = candidates.filter(word => playableContinuationCount(word) === minimum);
  }
  return randomItem(candidates);
}

function applyWordChallenge(session, phrase, hard, now = Date.now()) {
  session.phrase = phrase;
  session.required = lastWord(phrase);
  Object.assign(session, challengeMeta(hard, now));
  session.recent = [...(session.recent || []).filter(item => item !== normalizeVietnamese(phrase)), normalizeVietnamese(phrase)].slice(-RECENT_WORD_LIMIT);
  session.used.add(normalizeVietnamese(phrase));
}

function startWordSession(guildId, options = {}) {
  const phrase = chooseWordChallenge(false);
  const session = { phrase: '', required: '', used: new Set(), recent: [], turns: 0, lastPlayerId: null, hard: false, expiresAt: null, accentSensitive: true };
  applyWordChallenge(session, phrase, false, options.now);
  wordSessions.set(String(guildId), session);
  saveSession(guildId, 'noitu', session);
  return session;
}

function getWordSession(guildId) {
  const key = String(guildId);
  if (!wordSessions.has(key)) {
    const stored = loadSession(guildId, 'noitu');
    if (stored) {
      if (!stored.accentSensitive) {
        // Old sessions stored accent-free keys. Keep the current prompt and
        // restart its used-word history under the new accent-sensitive rules.
        stored.used = new Set([normalizeVietnamese(stored.phrase)]);
        stored.recent = [normalizeVietnamese(stored.phrase)];
        stored.accentSensitive = true;
        saveSession(guildId, 'noitu', stored);
      } else stored.recent ||= [...stored.used];
      stored.required = lastWord(stored.phrase);
      stored.lastPlayerId ||= null;
      // Word chain no longer has timed/hard rounds. Clear legacy sessions on load.
      stored.hard = false;
      stored.expiresAt = null;
      saveSession(guildId, 'noitu', stored);
      wordSessions.set(key, stored);
    }
  }
  return wordSessions.get(key) || null;
}

function playWord(guildId, answer, playerId, now = Date.now()) {
  const session = getWordSession(guildId);
  if (!session) return { ok: false, error: 'NO_SESSION' };
  const normalizedPlayerId = String(playerId || '');
  if (normalizedPlayerId && session.lastPlayerId === normalizedPlayerId) return { ok: false, error: 'WAIT_TURN', session };
  const normalized = normalizeVietnamese(answer);
  const canonical = knownWord(guildId, normalized);
  if (!canonical) return { ok: false, error: 'UNKNOWN_WORD', session };
  if (session.used.has(normalized)) return { ok: false, error: 'USED_WORD', session };
  if (firstWord(canonical) !== session.required) return { ok: false, error: 'WRONG_LINK', session };
  session.used.add(normalized);
  session.turns += 1;
  session.lastPlayerId = normalizedPlayerId || null;
  const replies = continuationsFor(guildId, lastWord(canonical)).filter(word => !session.used.has(normalizeVietnamese(word)));
  if (!replies.length) {
    const botPhrase = chooseWordChallenge(false, session.recent);
    session.used.clear();
    applyWordChallenge(session, botPhrase, false, now);
    saveSession(guildId, 'noitu', session);
    return { ok: true, answer: canonical, botPhrase, required: session.required, turns: session.turns, chainReset: true, chainWon: true, hard: false, nextHard: false, expiresAt: null };
  }
  applyWordChallenge(session, canonical, false, now);
  saveSession(guildId, 'noitu', session);
  return { ok: true, answer: canonical, required: session.required, turns: session.turns, chainReset: false, chainWon: false, hard: false, nextHard: false, expiresAt: null };
}

function skipWordSession(guildId, options = {}) {
  const session = getWordSession(guildId);
  if (!session) return null;
  const phrase = chooseWordChallenge(false, session.recent);
  session.lastPlayerId = null;
  applyWordChallenge(session, phrase, false, options.now);
  saveSession(guildId, 'noitu', session);
  return session;
}

function expireWordChallenge(guildId, now = Date.now()) {
  return null;
}

function endWordSession(guildId) {
  const existed = Boolean(getWordSession(guildId));
  wordSessions.delete(String(guildId));
  deleteSession(guildId, 'noitu');
  return existed;
}

function shuffleLetters(answer) {
  const original = Array.from(answer.replace(/\s+/g, ''));
  let shuffled = [...original];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    shuffled = [...original];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = crypto.randomInt(index + 1);
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    if (shuffled.join('') !== original.join('')) break;
  }
  return shuffled.join(' · ');
}

function makeVuaQuestion(base, hard = false, now = Date.now()) {
  return { ...base, mixed: shuffleLetters(base.answer), ...challengeMeta(hard, now) };
}

function nextVuaQuestion(recent = [], options = {}) {
  const hard = shouldBeHard(options);
  const pool = hard ? HARD_VUA_QUESTIONS : VUA_QUESTIONS;
  const recentSet = new Set(recent.map(normalizeVietnamese));
  const candidates = pool.filter(question => !recentSet.has(normalizeVietnamese(question.answer)));
  return makeVuaQuestion(randomItem(candidates.length ? candidates : pool), hard, options.now);
}

function startVuaSession(guildId, options = {}) {
  const question = nextVuaQuestion([], options);
  const session = { question, recent: [normalizeVietnamese(question.answer)], rounds: 0 };
  vuaSessions.set(String(guildId), session);
  saveSession(guildId, 'vuatiengviet', session);
  return session;
}

function getVuaSession(guildId) {
  const key = String(guildId);
  if (!vuaSessions.has(key)) {
    const stored = loadSession(guildId, 'vuatiengviet');
    if (stored) {
      if (!stored.question?.mixed || stored.question.mixed.includes(' / ')) stored.question = makeVuaQuestion(stored.question);
      stored.question.hard = Boolean(stored.question.hard);
      stored.question.expiresAt ||= null;
      stored.recent ||= [normalizeVietnamese(stored.question.answer)];
      vuaSessions.set(key, stored);
    }
  }
  return vuaSessions.get(key) || null;
}

function answerVuaSession(guildId, answer, now = Date.now()) {
  const session = getVuaSession(guildId);
  if (!session) return { ok: false, error: 'NO_SESSION' };
  if (isExpiredChallenge(session.question, now)) return { ok: false, error: 'EXPIRED', expiration: expireVuaChallenge(guildId, now) };
  const compact = value => normalizeVietnamese(value).replace(/\s+/g, '');
  if (compact(answer) !== compact(session.question.answer)) return { ok: true, correct: false, question: session.question };
  const question = session.question;
  session.question = nextVuaQuestion(session.recent, { now });
  session.recent = [...session.recent.filter(item => item !== normalizeVietnamese(session.question.answer)), normalizeVietnamese(session.question.answer)].slice(-RECENT_WORD_LIMIT);
  session.rounds += 1;
  saveSession(guildId, 'vuatiengviet', session);
  return { ok: true, correct: true, question, nextQuestion: session.question, rounds: session.rounds };
}

function skipVuaSession(guildId, options = {}) {
  const session = getVuaSession(guildId);
  if (!session) return null;
  const skipped = session.question;
  session.question = nextVuaQuestion(session.recent, options);
  session.recent = [...session.recent.filter(item => item !== normalizeVietnamese(session.question.answer)), normalizeVietnamese(session.question.answer)].slice(-RECENT_WORD_LIMIT);
  saveSession(guildId, 'vuatiengviet', session);
  return { skipped, nextQuestion: session.question };
}

function expireVuaChallenge(guildId, now = Date.now()) {
  const session = getVuaSession(guildId);
  if (!isExpiredChallenge(session?.question, now)) return null;
  const expired = session.question;
  session.question = nextVuaQuestion(session.recent, { forceHard: false, now });
  session.recent = [...session.recent, normalizeVietnamese(session.question.answer)].slice(-RECENT_WORD_LIMIT);
  saveSession(guildId, 'vuatiengviet', session);
  return { expired, nextQuestion: session.question };
}

function vuaQuestionText(question) {
  const hard = question.hard ? `🔥 **CÂU KHÓ x10** • Hết hạn <t:${Math.floor(question.expiresAt / 1000)}:R>\n` : '';
  return `${hard}## ${question.mixed}\n💡 Gợi ý: ${question.hint}`;
}

function endVuaSession(guildId) {
  const existed = Boolean(getVuaSession(guildId));
  vuaSessions.delete(String(guildId));
  deleteSession(guildId, 'vuatiengviet');
  return existed;
}

module.exports = {
  WORDS,
  VUA_QUESTIONS,
  HARD_VUA_QUESTIONS,
  HARD_DURATION_MS,
  HARD_QUESTION_CHANCE,
  shouldBeHard,
  challengeMeta,
  isExpiredChallenge,
  continuationCount,
  knownWord,
  shuffleLetters,
  randomItem,
  consumeCommandCooldown,
  startWordSession,
  getWordSession,
  playWord,
  skipWordSession,
  expireWordChallenge,
  endWordSession,
  startVuaSession,
  getVuaSession,
  answerVuaSession,
  skipVuaSession,
  expireVuaChallenge,
  endVuaSession,
  vuaQuestionText,
};

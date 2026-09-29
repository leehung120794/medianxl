const { db } = require('../db');
const { normalizeSearch } = require('../utils/text');
const { shouldBeHard, challengeMeta, isExpiredChallenge } = require('./funGameService');

const TYPE_LABELS = { TU: 'Tiered Unique', SU: 'Sacred Unique', SET: 'Set item', RW: 'Runeword' };
const ITEM_QUIZ_TYPES = Object.freeze(['TU', 'SU', 'SET', 'RW']);
const HARD_ITEM_QUIZ_TYPES = Object.freeze(['TU', 'SU', 'SET', 'RW']);
const TYPE_QUIZ_TYPES = Object.freeze([]);
const QUESTION_MODES_BY_TYPE = Object.freeze({
  // Duplicate entries are intentional weights. TU focuses on base and Required Level.
  TU: Object.freeze(['base', 'base', 'base', 'requiredLevel', 'requiredLevel']),
  SU: Object.freeze(['base', 'requiredLevel', 'itemLevel']),
  SET: Object.freeze(['base', 'requiredLevel', 'itemLevel']),
  RW: Object.freeze(['base']),
});

function sessionRow(guildId, game) {
  return db.prepare('SELECT state_json FROM game_sessions WHERE guild_id = ? AND game = ?').get(String(guildId), game);
}

function save(guildId, game, state) {
  db.prepare(`INSERT INTO game_sessions (guild_id, game, state_json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, game) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`)
    .run(String(guildId), game, JSON.stringify(state), Date.now());
}

function getMedianQuiz(guildId, game) {
  const row = sessionRow(guildId, game);
  if (!row) return null;
  try {
    const session = JSON.parse(row.state_json);
    let changed = false;
    const allowedModes = QUESTION_MODES_BY_TYPE[session.question?.type] || [];
    const invalidQuestion = !ITEM_QUIZ_TYPES.includes(session.question?.type)
      || !allowedModes.includes(session.question?.answerMode)
      || (session.question?.answerMode === 'base' && !isValidBase(session.question.answer))
      || (['requiredLevel', 'itemLevel'].includes(session.question?.answerMode)
        && !Number.isInteger(Number(session.question.answer)));
    if (!session.question?.answerMode || invalidQuestion) {
      session.question = nextQuestion(game, session.question, [], { forceHard: false });
      if (!session.question) return null;
      changed = true;
    }
    if (!Array.isArray(session.recent)) { session.recent = [normalizeSearch(session.question.itemName)]; changed = true; }
    if (typeof session.question.hard !== 'boolean') { session.question.hard = false; changed = true; }
    if (!session.question.hard && session.question.expiresAt) { session.question.expiresAt = null; changed = true; }
    if (changed) save(guildId, game, session);
    return session;
  }
  catch { endMedianQuiz(guildId, game); return null; }
}

function parseRequirements(row) {
  try { return JSON.parse(row.requirements_json || '{}'); } catch { return {}; }
}

function isValidBase(value) {
  const base = String(value || '').trim();
  return base && !base.startsWith('(') && !/^(?:.*damage:|defense:|chance to block:)$/i.test(base);
}

function answerForMode(row, mode) {
  const requirements = parseRequirements(row);
  if (mode === 'base') return isValidBase(row.base_type) ? String(row.base_type).trim() : null;
  const value = mode === 'requiredLevel' ? requirements.requiredLevel : mode === 'itemLevel' ? requirements.itemLevel : null;
  const minimum = mode === 'itemLevel' && row.type_code === 'SET' ? 2 : 1;
  return value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= minimum
    ? Number(value)
    : null;
  return null;
}

function pickItem(type, mode, excludeName = '', recent = []) {
  const rows = db.prepare(`SELECT * FROM items WHERE id IN (
    SELECT MAX(id) FROM items WHERE type_code = ? AND name <> ? GROUP BY lower(name)
  ) ORDER BY RANDOM() LIMIT 250`).all(type, excludeName);
  const recentSet = new Set(recent.map(normalizeSearch));
  const eligible = rows.filter(row => answerForMode(row, mode) !== null);
  return eligible.find(row => !recentSet.has(normalizeSearch(row.name))) || eligible[0] || null;
}

function cleanStats(row) {
  let stats = [];
  try { stats = JSON.parse(row.stats_json || '[]'); } catch {}
  const normalizedName = normalizeSearch(row.name);
  const normalizedVariant = normalizeSearch(row.tier_or_variant || '');
  const normalizedBase = normalizeSearch(row.base_type || '');
  return stats.filter(line => {
    const text = String(line || '').trim();
    const normalized = normalizeSearch(text);
    return text.length >= 4 && normalized !== normalizedName && normalized !== normalizedVariant && normalized !== normalizedBase
      && !/^required|^item level|^runes:|damage bonus/i.test(text);
  }).slice(0, 3);
}

function makeQuestion(game, row, answerMode, hard = false) {
  const requirements = parseRequirements(row);
  const rawRunes = String(row.tier_or_variant || '').replace(/^['"]|['"]$/g, '');
  const answer = String(answerForMode(row, answerMode));
  const baseWithoutSacred = String(row.base_type || '').replace(/\s*\(Sacred\)\s*$/i, '').trim();
  const singularBase = baseWithoutSacred.replace(/s$/i, '');
  const acceptedAnswers = answerMode === 'base'
    ? [...new Set([answer, baseWithoutSacred, singularBase].filter(Boolean))]
    : answerMode === 'itemLevel'
      ? [String(answer), `ilvl ${answer}`, `item level ${answer}`]
      : [String(answer), `level ${answer}`, `lvl ${answer}`, `lv ${answer}`, `cấp ${answer}`];
  return {
    answer,
    acceptedAnswers,
    answerMode,
    itemName: row.name,
    type: row.type_code,
    baseType: row.base_type || row.group_name || 'Không rõ',
    variant: rawRunes || null,
    requiredLevel: requirements.requiredLevel || null,
    itemLevel: requirements.itemLevel ?? null,
    stats: cleanStats(row).slice(0, hard ? 2 : 3),
    sourceUrl: row.source_url,
    game,
  };
}

function nextQuestion(game, previous = null, recent = [], options = {}) {
  const hard = shouldBeHard(options);
  const types = hard ? HARD_ITEM_QUIZ_TYPES : ITEM_QUIZ_TYPES;
  const plans = types.flatMap(type => QUESTION_MODES_BY_TYPE[type].map(answerMode => ({ type, answerMode })));
  for (let index = plans.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [plans[index], plans[swap]] = [plans[swap], plans[index]];
  }
  for (const { type, answerMode } of plans) {
    const row = pickItem(type, answerMode, previous?.itemName || '', recent);
    if (row) return { ...makeQuestion(game, row, answerMode, hard), ...challengeMeta(hard, options.now) };
  }
  return null;
}

function startMedianQuiz(guildId, game, options = {}) {
  const question = nextQuestion(game, null, [], options);
  if (!question) return null;
  const session = { question, recent: [normalizeSearch(question.itemName)], rounds: 0 };
  save(guildId, game, session);
  return session;
}

function answerMedianQuiz(guildId, game, answer, now = Date.now()) {
  const session = getMedianQuiz(guildId, game);
  if (!session) return { ok: false, error: 'NO_SESSION' };
  if (isExpiredChallenge(session.question, now)) return { ok: false, error: 'EXPIRED', expiration: expireMedianQuiz(guildId, game, now) };
  const normalized = normalizeSearch(answer);
  const compact = normalized.replace(/\s+/g, '');
  const accepted = (session.question.acceptedAnswers || [session.question.answer]).some(candidate => {
    const normalizedCandidate = normalizeSearch(candidate);
    return normalized === normalizedCandidate || compact === normalizedCandidate.replace(/\s+/g, '');
  });
  if (!accepted) return { ok: true, correct: false, question: session.question };
  const question = session.question;
  const next = nextQuestion(game, question, session.recent || [], { now });
  session.question = next;
  session.recent = [...(session.recent || []).filter(item => item !== normalizeSearch(next.itemName)), normalizeSearch(next.itemName)].slice(-50);
  session.rounds += 1;
  save(guildId, game, session);
  return { ok: true, correct: true, question, nextQuestion: next, rounds: session.rounds };
}

function skipMedianQuiz(guildId, game, options = {}) {
  const session = getMedianQuiz(guildId, game);
  if (!session) return null;
  const skipped = session.question;
  session.question = nextQuestion(game, skipped, session.recent || [], options);
  session.recent = [...(session.recent || []), normalizeSearch(session.question.itemName)].slice(-50);
  save(guildId, game, session);
  return { skipped, nextQuestion: session.question };
}

function expireMedianQuiz(guildId, game, now = Date.now()) {
  const session = getMedianQuiz(guildId, game);
  if (!session || !isExpiredChallenge(session.question, now)) return null;
  const expired = session.question;
  session.question = nextQuestion(game, expired, session.recent || [], { forceHard: false, now });
  session.recent = [...(session.recent || []), normalizeSearch(session.question.itemName)].slice(-50);
  save(guildId, game, session);
  return { expired, nextQuestion: session.question };
}

function endMedianQuiz(guildId, game) {
  return db.prepare('DELETE FROM game_sessions WHERE guild_id = ? AND game = ?').run(String(guildId), game).changes > 0;
}

function quizText(question) {
  const prompts = {
    base: 'Item này sử dụng **base item/nhóm trang bị** nào?',
    requiredLevel: 'Item này yêu cầu **Required Level** bao nhiêu?',
    itemLevel: 'Item này có **Item Level** bao nhiêu?',
  };
  const hard = question.hard ? `🔥 **CÂU KHÓ x10** • Hết hạn <t:${Math.floor(question.expiresAt / 1000)}:R>\n` : '';
  const lines = [`${hard}## ${question.itemName}`, `🎯 ${prompts[question.answerMode]}`];
  if (!question.hard) lines.push(`**Loại:** ${TYPE_LABELS[question.type] || question.type}`);
  if (question.answerMode !== 'base' && !question.hard) lines.push(`**Base/nhóm:** ${question.baseType}`);
  if (question.variant && question.answerMode === 'base' && !question.hard) lines.push(`**Rune/Tier:** ${question.variant}`);
  if (question.requiredLevel && question.answerMode !== 'requiredLevel' && !question.hard) lines.push(`**Required Level:** ${question.requiredLevel}`);
  if (question.itemLevel !== null && question.answerMode !== 'itemLevel' && !question.hard) lines.push(`**Item Level:** ${question.itemLevel}`);
  if (question.stats.length) lines.push(`**Gợi ý stat:**\n${question.stats.map(stat => `• ${stat}`).join('\n')}`);
  return lines.join('\n');
}

module.exports = { ITEM_QUIZ_TYPES, HARD_ITEM_QUIZ_TYPES, TYPE_QUIZ_TYPES, QUESTION_MODES_BY_TYPE, startMedianQuiz, getMedianQuiz, answerMedianQuiz, skipMedianQuiz, expireMedianQuiz, endMedianQuiz, quizText };

const { db } = require('../db');
const { normalizeVietnamese } = require('../utils/text');
const REJECTED_RETENTION_MS = 30 * 86_400_000;

function cleanupRejectedSuggestions(now = Date.now()) {
  return db.prepare("DELETE FROM word_suggestions WHERE status='rejected' AND reviewed_at<?")
    .run(now - REJECTED_RETENTION_MS).changes;
}

function cleanPhrase(value) {
  const phrase = String(value || '').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const words = phrase.split(' ').filter(Boolean);
  if (phrase.length < 3 || phrase.length > 60 || words.length < 2 || words.length > 5 || !/^[\p{L} ]+$/u.test(phrase)) {
    throw new Error('INVALID_PHRASE');
  }
  return { phrase, normalized: normalizeVietnamese(phrase) };
}

function submitSuggestion(guildId, userId, value) {
  cleanupRejectedSuggestions();
  const guild = String(guildId); const user = String(userId);
  const { phrase, normalized } = cleanPhrase(value);
  const existing = db.prepare('SELECT * FROM word_suggestions WHERE guild_id=? AND normalized_phrase=?').get(guild, normalized);
  if (existing?.status === 'approved') throw new Error('ALREADY_APPROVED');
  if (existing?.status === 'pending') throw new Error('ALREADY_PENDING');
  const pending = db.prepare("SELECT COUNT(*) count FROM word_suggestions WHERE guild_id=? AND submitted_by=? AND status='pending'").get(guild, user).count;
  if (pending >= 10) throw new Error('TOO_MANY_PENDING');
  const now = Date.now();
  if (existing) {
    db.prepare("UPDATE word_suggestions SET phrase=?,submitted_by=?,status='pending',reviewed_by=NULL,created_at=?,reviewed_at=NULL WHERE id=?")
      .run(phrase, user, now, existing.id);
    return { ...existing, phrase, submitted_by: user, status: 'pending', created_at: now };
  }
  const result = db.prepare('INSERT INTO word_suggestions(guild_id,phrase,normalized_phrase,submitted_by,status,created_at) VALUES(?,?,?,?,?,?)')
    .run(guild, phrase, normalized, user, 'pending', now);
  return db.prepare('SELECT * FROM word_suggestions WHERE id=?').get(result.lastInsertRowid);
}

function listPendingSuggestions(guildId, limit = 20) {
  return db.prepare("SELECT * FROM word_suggestions WHERE guild_id=? AND status='pending' ORDER BY created_at ASC LIMIT ?")
    .all(String(guildId), Math.max(1, Math.min(25, Number(limit) || 20)));
}

function reviewSuggestion(guildId, id, adminId, approved) {
  cleanupRejectedSuggestions();
  const row = db.prepare("SELECT * FROM word_suggestions WHERE guild_id=? AND id=? AND status='pending'").get(String(guildId), Number(id));
  if (!row) throw new Error('NOT_PENDING');
  const status = approved ? 'approved' : 'rejected';
  db.prepare('UPDATE word_suggestions SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?')
    .run(status, String(adminId), Date.now(), row.id);
  return { ...row, status, reviewed_by: String(adminId) };
}

function addApprovedWord(guildId, adminId, value) {
  cleanupRejectedSuggestions();
  const guild = String(guildId); const admin = String(adminId);
  const { phrase, normalized } = cleanPhrase(value);
  const existing = db.prepare('SELECT * FROM word_suggestions WHERE guild_id=? AND normalized_phrase=?').get(guild, normalized);
  if (existing?.status === 'approved') throw new Error('ALREADY_APPROVED');
  const now = Date.now();
  if (existing) {
    db.prepare("UPDATE word_suggestions SET phrase=?,submitted_by=?,status='approved',reviewed_by=?,reviewed_at=? WHERE id=?")
      .run(phrase, existing.submitted_by || admin, admin, now, existing.id);
    return { ...existing, phrase, status: 'approved', reviewed_by: admin, reviewed_at: now };
  }
  const result = db.prepare(`INSERT INTO word_suggestions
    (guild_id,phrase,normalized_phrase,submitted_by,status,reviewed_by,created_at,reviewed_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(guild, phrase, normalized, admin, 'approved', admin, now, now);
  return db.prepare('SELECT * FROM word_suggestions WHERE id=?').get(result.lastInsertRowid);
}

function getApprovedWords(guildId) {
  return db.prepare("SELECT phrase FROM word_suggestions WHERE guild_id=? AND status='approved' ORDER BY id")
    .all(String(guildId)).map(row => row.phrase);
}

function listApprovedWords(guildId, page = 1, pageSize = 15) {
  const guild = String(guildId);
  const size = Math.max(1, Math.min(25, Number(pageSize) || 15));
  const total = db.prepare("SELECT COUNT(*) count FROM word_suggestions WHERE guild_id=? AND status='approved'").get(guild).count;
  const pages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.max(1, Math.min(pages, Number(page) || 1));
  const rows = db.prepare("SELECT * FROM word_suggestions WHERE guild_id=? AND status='approved' ORDER BY reviewed_at DESC,id DESC LIMIT ? OFFSET ?")
    .all(guild, size, (currentPage - 1) * size);
  return { rows, total, page: currentPage, pages };
}

function removeApprovedWord(guildId, adminId, value) {
  const guild = String(guildId); const admin = String(adminId);
  const { normalized } = cleanPhrase(value);
  const row = db.prepare("SELECT * FROM word_suggestions WHERE guild_id=? AND normalized_phrase=? AND status='approved'").get(guild, normalized);
  if (!row) throw new Error('NOT_APPROVED');
  const now = Date.now();
  db.prepare("UPDATE word_suggestions SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=?")
    .run(admin, now, row.id);
  return { ...row, status: 'rejected', reviewed_by: admin, reviewed_at: now };
}

module.exports = { cleanPhrase, submitSuggestion, listPendingSuggestions, reviewSuggestion, addApprovedWord, getApprovedWords, listApprovedWords, removeApprovedWord, cleanupRejectedSuggestions };

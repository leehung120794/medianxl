const { db } = require('../db');
function getSession(id) { return db.prepare('SELECT * FROM hardcore_sessions WHERE id = ?').get(String(id)) || null; }
function getActiveSession(id, guildId) { return db.prepare('SELECT * FROM hardcore_sessions WHERE id=? AND guild_id=?').get(String(id), String(guildId)) || null; }
function getByUser(guildId, userId) { return db.prepare('SELECT * FROM hardcore_sessions WHERE guild_id = ? AND user_id = ?').get(String(guildId), String(userId)) || null; }
function parseState(session) { return JSON.parse(session.state_json); }
function saveState(session, state, now = Date.now()) { db.prepare('UPDATE hardcore_sessions SET state_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), now, session.id); }
function setMessageId(id, messageId, now = Date.now()) { db.prepare('UPDATE hardcore_sessions SET message_id = ?, updated_at = ? WHERE id = ?').run(String(messageId), now, String(id)); }
function relocateSession(id, guildId, userId, channelId, messageId, now = Date.now()) {
  return db.prepare('UPDATE hardcore_sessions SET channel_id=?, message_id=?, updated_at=? WHERE id=? AND guild_id=? AND user_id=?')
    .run(String(channelId), String(messageId), now, String(id), String(guildId), String(userId)).changes;
}
function insertSession(session, state) { db.prepare('INSERT INTO hardcore_sessions (id,guild_id,user_id,channel_id,message_id,state_json,created_at,updated_at) VALUES (?,?,?,?,NULL,?,?,?)')
  .run(session.id, session.guild_id, session.user_id, session.channel_id, JSON.stringify(state), session.created_at, session.updated_at); }
function deleteSession(id) { return db.prepare('DELETE FROM hardcore_sessions WHERE id=?').run(String(id)).changes; }
function listStale(cutoff) { return db.prepare('SELECT * FROM hardcore_sessions WHERE updated_at<?').all(cutoff); }
function upsertRecord(guildId, userId, values, now = Date.now()) {
  db.prepare(`INSERT INTO hardcore_records (guild_id,user_id,best_floor,runs,deaths,escapes,completions,updated_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET
    best_floor=MAX(best_floor,excluded.best_floor),runs=runs+excluded.runs,deaths=deaths+excluded.deaths,
    escapes=escapes+excluded.escapes,completions=completions+excluded.completions,updated_at=excluded.updated_at`)
    .run(String(guildId), String(userId), values.bestFloor, values.runs, values.deaths, values.escapes, values.completions, now);
}
function getRecord(guildId, userId) { return db.prepare('SELECT * FROM hardcore_records WHERE guild_id=? AND user_id=?').get(String(guildId), String(userId)) || null; }
function getTop(guildId, limit) { return db.prepare('SELECT * FROM hardcore_records WHERE guild_id=? ORDER BY best_floor DESC,completions DESC,updated_at ASC LIMIT ?').all(String(guildId), limit); }
function createEcho(echo, now = Date.now()) {
  // Chỉ giữ một mộ thường mỗi người; Nemesis đã hình thành không bị thay thế.
  const leased = db.prepare(`SELECT 1 FROM hardcore_grave_echoes WHERE guild_id=? AND owner_user_id=? AND is_nemesis=0
    AND claimed_until>? LIMIT 1`).get(String(echo.guildId), String(echo.ownerUserId), now);
  if (leased) return false;
  db.prepare('DELETE FROM hardcore_grave_echoes WHERE guild_id=? AND owner_user_id=? AND is_nemesis=0').run(String(echo.guildId), String(echo.ownerUserId));
  const count = db.prepare('SELECT COUNT(*) AS count FROM hardcore_grave_echoes WHERE guild_id=?').get(String(echo.guildId)).count;
  if (count >= 10) {
    const removable = db.prepare(`SELECT id FROM hardcore_grave_echoes WHERE guild_id=? AND (claimed_until IS NULL OR claimed_until<=?)
      ORDER BY is_nemesis ASC,kills ASC,created_at ASC LIMIT 1`).get(String(echo.guildId), now);
    if (!removable) return false;
    db.prepare('DELETE FROM hardcore_grave_echoes WHERE id=?').run(removable.id);
  }
  db.prepare(`INSERT INTO hardcore_grave_echoes(id,guild_id,owner_user_id,name,class_key,death_floor,level,kills,is_nemesis,snapshot_json,expires_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,1,0,0,?,?,?,?)`).run(echo.id, String(echo.guildId), String(echo.ownerUserId), echo.name, echo.classKey,
    echo.deathFloor, JSON.stringify(echo.snapshot), echo.expiresAt, now, now);
  return true;
}
function claimEcho(guildId, sessionId, userId, floor, now = Date.now()) {
  db.prepare('DELETE FROM hardcore_grave_echoes WHERE expires_at<=?').run(now);
  const row = db.prepare(`SELECT * FROM hardcore_grave_echoes WHERE guild_id=? AND owner_user_id<>?
    AND death_floor<=? AND (claimed_until IS NULL OR claimed_until<? OR claimed_by=?)
    ORDER BY is_nemesis DESC,kills DESC,ABS(death_floor-?) ASC LIMIT 1`)
    .get(String(guildId), String(userId), Math.max(100, floor * 2), now, String(sessionId), floor);
  if (!row) return null;
  const changed = db.prepare(`UPDATE hardcore_grave_echoes SET claimed_by=?,claimed_until=?,updated_at=?
    WHERE id=? AND (claimed_until IS NULL OR claimed_until<? OR claimed_by=?)`).run(String(sessionId), now + 30 * 60_000, now, row.id, now, String(sessionId)).changes;
  return changed ? { ...row, snapshot: JSON.parse(row.snapshot_json) } : null;
}
function releaseEcho(id, sessionId) { return db.prepare('UPDATE hardcore_grave_echoes SET claimed_by=NULL,claimed_until=NULL WHERE id=? AND claimed_by=?').run(String(id), String(sessionId)).changes; }
function deleteEcho(id) { return db.prepare('DELETE FROM hardcore_grave_echoes WHERE id=?').run(String(id)).changes; }
function strengthenEcho(id, snapshot, now = Date.now()) {
  return db.prepare(`UPDATE hardcore_grave_echoes SET level=level+1,kills=kills+1,is_nemesis=1,snapshot_json=?,claimed_by=NULL,claimed_until=NULL,
    expires_at=?,updated_at=? WHERE id=?`).run(JSON.stringify(snapshot), now + 7 * 86_400_000, now, String(id)).changes;
}
function listEchoes(guildId) { return db.prepare('SELECT * FROM hardcore_grave_echoes WHERE guild_id=? ORDER BY is_nemesis DESC,kills DESC').all(String(guildId)); }
module.exports = { getSession, getActiveSession, getByUser, parseState, saveState, setMessageId, relocateSession, insertSession, deleteSession, listStale, upsertRecord, getRecord, getTop,
  createEcho, claimEcho, releaseEcho, deleteEcho, strengthenEcho, listEchoes };

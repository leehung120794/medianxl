const { db } = require('../db');

function getActiveEffect(guildId, userId, effectId, now = Date.now()) {
  const row = db.prepare('SELECT * FROM user_item_effects WHERE guild_id=? AND user_id=? AND effect_id=?')
    .get(String(guildId), String(userId), String(effectId));
  if (!row || row.charges < 1 || (row.expires_at && row.expires_at <= now)) return null;
  return row;
}
function addEffectCharge(guildId, userId, effectId, { expiresAt = null, charges = 1 } = {}) {
  const now = Date.now();
  db.prepare(`INSERT INTO user_item_effects (guild_id,user_id,effect_id,charges,expires_at,metadata_json,updated_at)
    VALUES (?,?,?,?,?,'{}',?) ON CONFLICT(guild_id,user_id,effect_id) DO UPDATE SET
    charges=CASE WHEN user_item_effects.expires_at IS NOT NULL AND user_item_effects.expires_at<=excluded.updated_at
      THEN excluded.charges ELSE user_item_effects.charges+excluded.charges END,
    expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .run(String(guildId), String(userId), effectId, charges, expiresAt, now);
  return getActiveEffect(guildId, userId, effectId, now);
}
function consumeActiveEffect(guildId, userId, effectId, now = Date.now()) {
  return db.transaction(() => {
    const effect = getActiveEffect(guildId, userId, effectId, now);
    if (!effect) return false;
    db.prepare('UPDATE user_item_effects SET charges=charges-1,updated_at=? WHERE guild_id=? AND user_id=? AND effect_id=?')
      .run(now, String(guildId), String(userId), effectId);
    return true;
  })();
}
function insuredRefund(guildId, userId, stake) {
  if (consumeActiveEffect(guildId, userId, 'bet_insurance_plus')) return Math.max(1, Math.floor(Number(stake) * 0.5));
  return consumeActiveEffect(guildId, userId, 'bet_insurance') ? Math.max(1, Math.floor(Number(stake) * 0.25)) : 0;
}

function boostedQuizReward(guildId, userId, amount) {
  const reward = Math.max(0, Math.floor(Number(amount) || 0));
  const boosted = consumeActiveEffect(guildId, userId, 'quiz_reward_boost');
  return { amount: boosted ? reward * 2 : reward, boosted };
}

function listActiveEffects(guildId, userId, now = Date.now()) {
  return db.prepare(`SELECT * FROM user_item_effects WHERE guild_id=? AND user_id=? AND charges>0
    AND (expires_at IS NULL OR expires_at>?) ORDER BY updated_at DESC`)
    .all(String(guildId), String(userId), now);
}

module.exports = { getActiveEffect, addEffectCharge, consumeActiveEffect, insuredRefund, boostedQuizReward, listActiveEffects };

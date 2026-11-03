const crypto = require("node:crypto");
const { db } = require("../db");
const {
  ROOTS,
  REALMS,
  ACTIVITIES,
  SESSION_OPTIONS,
  ITEMS,
  DAILY_QUESTS,
  requiredCultivation,
  rootById,
} = require("../tuTien/config");

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const nowMs = () => Date.now();
const id = () => crypto.randomUUID();

function dayKey(now = nowMs()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayBounds(now = nowMs()) {
  const key = dayKey(now);
  const start = new Date(`${key}T00:00:00+07:00`).getTime();
  return { start, end: start + 86_400_000, key };
}

function randomRoot(randomInt = crypto.randomInt) {
  const total = ROOTS.reduce((sum, root) => sum + root.chance, 0);
  let roll = randomInt(total);
  for (const root of ROOTS) {
    roll -= root.chance;
    if (roll < 0) return root;
  }
  return ROOTS.at(-1);
}

function getCharacter(guildId, userId) {
  if (!guildId || !userId) return null;
  return db
    .prepare("SELECT * FROM chu_characters WHERE guild_id=? AND user_id=?")
    .get(String(guildId), String(userId)) || null;
}

function createCharacter(guildId, userId, displayName, now = nowMs()) {
  return db.transaction(() => {
    const existing = getCharacter(guildId, userId);
    if (existing) return { created: false, character: existing };
    const root = randomRoot();
    const characterId = id();
    db.prepare(`INSERT INTO chu_characters
      (id,guild_id,user_id,dharma_name,realm_order,realm_stage,cultivation,spirit_stone,merit,dao_heart,spiritual_root_id,created_at,updated_at)
      VALUES(?,?,?,?,1,1,0,500,0,0,?,?,?)`).run(
      characterId,
      String(guildId),
      String(userId),
      String(displayName || "Đạo hữu").slice(0, 50),
      root.id,
      now,
      now,
    );
    addLedger(characterId, "cultivation", 0, "character-created", now);
    addLedger(characterId, "spirit_stone", 500, "character-created", now);
    return { created: true, character: getCharacter(guildId, userId), root };
  })();
}

function addLedger(characterId, resource, amount, reason, now = nowMs(), referenceId = null) {
  const owner = db.prepare("SELECT guild_id FROM chu_characters WHERE id=?").get(characterId);
  if (!owner) throw new Error("CHARACTER_REQUIRED");
  db.prepare(`INSERT INTO chu_transactions
    (id,guild_id,character_id,resource_type,amount,reason,reference_id,created_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(id(), owner.guild_id, characterId, resource, amount, reason, referenceId, now);
}

function getCurrentSession(characterId) {
  return db.prepare(`SELECT * FROM chu_cultivation_sessions
    WHERE character_id=? AND status='running'`).get(String(characterId)) || null;
}

function startCultivation(guildId, userId, type, seconds, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  const option = (SESSION_OPTIONS[type] || []).find((entry) => entry.seconds === Number(seconds));
  if (!option) throw new Error("INVALID_SESSION_OPTION");
  return db.transaction(() => {
    if (getCurrentSession(character.id)) throw new Error("SESSION_ALREADY_RUNNING");
    const sessionId = id();
    db.prepare(`INSERT INTO chu_cultivation_sessions
      (id,guild_id,character_id,session_type,started_at,ends_at,duration_seconds,base_reward,status,created_at)
      VALUES(?,?,?,?,?,?,?,?, 'running',?)`).run(
      sessionId,
      String(guildId),
      character.id,
      type,
      now,
      now + option.seconds * 1000,
      option.seconds,
      option.baseReward,
      now,
    );
    return db.prepare("SELECT * FROM chu_cultivation_sessions WHERE id=?").get(sessionId);
  })();
}

function claimCultivation(guildId, userId, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  return db.transaction(() => {
    const session = getCurrentSession(character.id);
    if (!session) throw new Error("NO_RUNNING_SESSION");
    if (now < session.ends_at) throw new Error("SESSION_NOT_READY");
    const root = rootById(character.spiritual_root_id);
    const amount = Math.floor(session.base_reward * root.multiplier);
    const changed = db.prepare(`UPDATE chu_cultivation_sessions
      SET status='claimed',claimed_at=? WHERE id=? AND status='running'`).run(now, session.id).changes;
    if (!changed) throw new Error("SESSION_ALREADY_CLAIMED");
    db.prepare("UPDATE chu_characters SET cultivation=cultivation+?,updated_at=? WHERE id=?")
      .run(amount, now, character.id);
    addLedger(character.id, "cultivation", amount, `cultivation:${session.session_type}`, now, session.id);
    return { session, amount, character: getCharacter(guildId, userId) };
  })();
}

function claimActivity(guildId, userId, activityId, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  const activity = ACTIVITIES.find((entry) => entry.id === activityId);
  if (!activity) throw new Error("INVALID_ACTIVITY");
  return db.transaction(() => {
    const { start, end } = dayBounds(now);
    const used = db.prepare(`SELECT COUNT(*) AS count FROM chu_activity_logs
      WHERE character_id=? AND activity_id=? AND created_at>=? AND created_at<?`)
      .get(character.id, activity.id, start, end).count;
    if (used >= activity.dailyLimit) throw new Error("ACTIVITY_LIMIT_REACHED");
    const actualCultivation = Math.floor(activity.cultivation * rootById(character.spiritual_root_id).multiplier);
    db.prepare(`INSERT INTO chu_activity_logs
      (id,guild_id,character_id,activity_id,base_cultivation,actual_cultivation,merit_reward,dao_heart_reward,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(
      id(), String(guildId), character.id, activity.id,
      activity.cultivation, actualCultivation, activity.merit, activity.dao, now,
    );
    db.prepare(`UPDATE chu_characters SET cultivation=cultivation+?,merit=merit+?,dao_heart=dao_heart+?,updated_at=? WHERE id=?`)
      .run(actualCultivation, activity.merit, activity.dao, now, character.id);
    addLedger(character.id, "cultivation", actualCultivation, `activity:${activity.id}`, now);
    if (activity.merit) addLedger(character.id, "merit", activity.merit, `activity:${activity.id}`, now);
    if (activity.dao) addLedger(character.id, "dao_heart", activity.dao, `activity:${activity.id}`, now);
    updateDailyQuestProgress(character.id, activity.id, now);
    return { activity, actualCultivation, character: getCharacter(guildId, userId) };
  })();
}

function updateDailyQuestProgress(characterId, activityId, now) {
  const key = dayKey(now);
  const add = (questId) => {
    db.prepare(`INSERT INTO chu_daily_quest_progress(character_id,quest_id,period_key,progress,claimed,updated_at)
      VALUES(?,?,?,1,0,?) ON CONFLICT(character_id,quest_id,period_key)
      DO UPDATE SET progress=progress+1,updated_at=excluded.updated_at`)
      .run(characterId, questId, key, now);
  };
  add("any_activity");
  add("three_activities");
  for (const quest of DAILY_QUESTS)
    if (quest.activityId === activityId) add(quest.id);
}

function getDailyQuests(guildId, userId, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  const key = dayKey(now);
  const rows = db.prepare(`SELECT quest_id,progress,claimed FROM chu_daily_quest_progress
    WHERE character_id=? AND period_key=?`).all(character.id, key);
  const byId = new Map(rows.map((row) => [row.quest_id, row]));
  return DAILY_QUESTS.map((quest) => {
    const row = byId.get(quest.id);
    return { ...quest, progress: Math.min(quest.target, row?.progress || 0), claimed: Boolean(row?.claimed) };
  });
}

function claimDailyQuest(guildId, userId, questId, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  const quest = DAILY_QUESTS.find((entry) => entry.id === questId);
  if (!quest) throw new Error("INVALID_QUEST");
  return db.transaction(() => {
    const key = dayKey(now);
    const row = db.prepare(`SELECT progress,claimed FROM chu_daily_quest_progress
      WHERE character_id=? AND quest_id=? AND period_key=?`).get(character.id, quest.id, key);
    if (!row || row.progress < quest.target) throw new Error("QUEST_NOT_COMPLETE");
    if (row.claimed) throw new Error("QUEST_ALREADY_CLAIMED");
    const claimed = db.prepare(`UPDATE chu_daily_quest_progress SET claimed=1,updated_at=?
      WHERE character_id=? AND quest_id=? AND period_key=? AND claimed=0`).run(now, character.id, quest.id, key).changes;
    if (!claimed) throw new Error("QUEST_ALREADY_CLAIMED");
    const root = rootById(character.spiritual_root_id);
    const cultivation = Math.floor((quest.reward.cultivation || 0) * root.multiplier);
    db.prepare(`UPDATE chu_characters SET cultivation=cultivation+?,spirit_stone=spirit_stone+?,merit=merit+?,dao_heart=dao_heart+?,updated_at=? WHERE id=?`)
      .run(cultivation, quest.reward.spiritStone || 0, quest.reward.merit || 0, quest.reward.daoHeart || 0, now, character.id);
    if (cultivation) addLedger(character.id, "cultivation", cultivation, `quest:${quest.id}`, now);
    for (const [resource, keyName] of [["spirit_stone", "spiritStone"], ["merit", "merit"], ["dao_heart", "daoHeart"]])
      if (quest.reward[keyName]) addLedger(character.id, resource, quest.reward[keyName], `quest:${quest.id}`, now);
    return { quest, cultivation, character: getCharacter(guildId, userId) };
  })();
}

function checkIn(guildId, userId, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  return db.transaction(() => {
    const { start, key } = dayBounds(now);
    const previous = db.prepare(`SELECT checkin_date,streak FROM chu_daily_checkins
      WHERE character_id=? ORDER BY checkin_date DESC LIMIT 1`).get(character.id);
    if (previous?.checkin_date === key) throw new Error("ALREADY_CHECKED_IN");
    const yesterday = dayKey(start - 1000);
    const streak = previous?.checkin_date === yesterday ? previous.streak + 1 : 1;
    const spiritStone = 300 + streak * 50;
    const merit = streak % 7 === 0 ? 10 : 0;
    db.prepare(`INSERT INTO chu_daily_checkins(id,guild_id,character_id,checkin_date,streak,claimed_at)
      VALUES(?,?,?,?,?,?)`).run(id(), String(guildId), character.id, key, streak, now);
    db.prepare(`UPDATE chu_characters SET spirit_stone=spirit_stone+?,merit=merit+?,updated_at=? WHERE id=?`)
      .run(spiritStone, merit, now, character.id);
    addLedger(character.id, "spirit_stone", spiritStone, "daily-checkin", now);
    if (merit) addLedger(character.id, "merit", merit, "daily-checkin-streak", now);
    return { streak, spiritStone, merit, character: getCharacter(guildId, userId) };
  })();
}

function breakthroughPreview(character) {
  if (character.realm_order >= REALMS.length && character.realm_stage >= 9) throw new Error("MAX_REALM_REACHED");
  const major = character.realm_stage === 9;
  const targetRealm = major ? character.realm_order + 1 : character.realm_order;
  const targetStage = major ? 1 : character.realm_stage + 1;
  const required = requiredCultivation(targetRealm, targetStage);
  const spiritStone = Math.max(50, Math.ceil(required * (major ? 0.2 : 0.05)));
  const daoHeart = major ? Math.max(1, (targetRealm - 1) * 2) : 0;
  const successBps = major ? Math.max(3500, Math.min(9500, (11 - targetRealm) * 1000)) : 10000;
  return { major, targetRealm, targetStage, required, spiritStone, daoHeart, successPercent: successBps / 100, failLoss: major ? Math.ceil(required * 0.1) : 0 };
}

function attemptBreakthrough(guildId, userId, now = nowMs(), randomInt = crypto.randomInt) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  return db.transaction(() => {
    if (getCurrentSession(character.id)) throw new Error("SESSION_RUNNING");
    const preview = breakthroughPreview(character);
    if (character.cultivation < preview.required) throw new Error("INSUFFICIENT_CULTIVATION");
    if (character.spirit_stone < preview.spiritStone) throw new Error("INSUFFICIENT_SPIRIT_STONE");
    if (character.dao_heart < preview.daoHeart) throw new Error("INSUFFICIENT_DAO_HEART");
    const success = randomInt(10000) < preview.successPercent * 100;
    const cultivationLoss = success ? preview.required : preview.failLoss;
    db.prepare(`UPDATE chu_characters SET cultivation=cultivation-?,spirit_stone=spirit_stone-?,dao_heart=dao_heart-?,
      realm_order=CASE WHEN ? THEN ? ELSE realm_order END,realm_stage=CASE WHEN ? THEN ? ELSE realm_stage END,
      total_breakthroughs=total_breakthroughs+CASE WHEN ? THEN 1 ELSE 0 END,updated_at=? WHERE id=?`)
      .run(cultivationLoss, preview.spiritStone, preview.daoHeart,
        success ? 1 : 0, preview.targetRealm, success ? 1 : 0, preview.targetStage,
        success ? 1 : 0, now, character.id);
    if (cultivationLoss) addLedger(character.id, "cultivation", -cultivationLoss, success ? "breakthrough-success" : "breakthrough-failed", now);
    if (preview.spiritStone) addLedger(character.id, "spirit_stone", -preview.spiritStone, "breakthrough-attempt", now);
    if (preview.daoHeart) addLedger(character.id, "dao_heart", -preview.daoHeart, "breakthrough-attempt", now);
    db.prepare(`INSERT INTO chu_breakthrough_logs(id,guild_id,character_id,from_realm,from_stage,to_realm,to_stage,success,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(id(), String(guildId), character.id,
      character.realm_order, character.realm_stage, success ? preview.targetRealm : character.realm_order,
      success ? preview.targetStage : character.realm_stage, success ? 1 : 0, now);
    return { success, preview, character: getCharacter(guildId, userId) };
  })();
}

function buyItem(guildId, userId, itemId, quantity = 1, now = nowMs()) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  const item = ITEMS[itemId];
  const count = Math.floor(Number(quantity));
  if (!item || !Number.isSafeInteger(count) || count < 1 || count > 10) throw new Error("INVALID_ITEM");
  return db.transaction(() => {
    const total = item.price * count;
    const fresh = getCharacter(guildId, userId);
    if (fresh.spirit_stone < total) throw new Error("INSUFFICIENT_SPIRIT_STONE");
    db.prepare("UPDATE chu_characters SET spirit_stone=spirit_stone-?,updated_at=? WHERE id=?").run(total, now, fresh.id);
    db.prepare(`INSERT INTO chu_inventory(id,guild_id,character_id,item_id,quantity,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(character_id,item_id)
      DO UPDATE SET quantity=quantity+excluded.quantity,updated_at=excluded.updated_at`)
      .run(id(), String(guildId), fresh.id, item.id, count, now);
    addLedger(fresh.id, "spirit_stone", -total, `shop:${item.id}`, now);
    return { item, quantity: count, total, character: getCharacter(guildId, userId) };
  })();
}

function getInventory(guildId, userId) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  return db.prepare("SELECT item_id,quantity FROM chu_inventory WHERE character_id=? AND quantity>0 ORDER BY item_id")
    .all(character.id).map((row) => ({ ...ITEMS[row.item_id], quantity: row.quantity }));
}

function useItem(guildId, userId, itemId, now = nowMs(), randomInt = crypto.randomInt) {
  const character = getCharacter(guildId, userId);
  if (!character) throw new Error("CHARACTER_REQUIRED");
  if (itemId !== "dan_nghich_thien") throw new Error("INVALID_ITEM");
  return db.transaction(() => {
    const row = db.prepare("SELECT quantity FROM chu_inventory WHERE character_id=? AND item_id=?")
      .get(character.id, itemId);
    if (!row || row.quantity < 1) throw new Error("ITEM_NOT_OWNED");
    const previousRoot = rootById(character.spiritual_root_id);
    const nextRoot = randomRoot(randomInt);
    db.prepare("UPDATE chu_inventory SET quantity=quantity-1,updated_at=? WHERE character_id=? AND item_id=?")
      .run(now, character.id, itemId);
    db.prepare("DELETE FROM chu_inventory WHERE character_id=? AND item_id=? AND quantity<=0")
      .run(character.id, itemId);
    db.prepare("UPDATE chu_characters SET spiritual_root_id=?,root_changed_count=root_changed_count+1,updated_at=? WHERE id=?")
      .run(nextRoot.id, now, character.id);
    db.prepare(`INSERT INTO chu_root_change_logs(id,guild_id,character_id,old_root_id,new_root_id,item_id,created_at)
      VALUES(?,?,?,?,?,?,?)`).run(id(), String(guildId), character.id, previousRoot.id, nextRoot.id, itemId, now);
    return { previousRoot, nextRoot, character: getCharacter(guildId, userId) };
  })();
}

function formatRealm(character) {
  return `${REALMS[character.realm_order - 1] || "Phàm Nhân"} · Tầng ${character.realm_stage}`;
}

module.exports = {
  dayKey,
  dayBounds,
  randomRoot,
  getCharacter,
  createCharacter,
  getCurrentSession,
  startCultivation,
  claimCultivation,
  claimActivity,
  getDailyQuests,
  claimDailyQuest,
  checkIn,
  breakthroughPreview,
  attemptBreakthrough,
  buyItem,
  getInventory,
  useItem,
  formatRealm,
};

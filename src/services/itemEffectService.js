const crypto = require('node:crypto');
const { db } = require('../db');
const { getGameByChannel } = require('./gameChannelService');
const games = require('./funGameService');
const medianQuiz = require('./medianQuizService');
const mines = require('./minesService');
const { getCatalogItem, COLLECTIBLES, RARITY } = require('./itemCatalogService');
const { consumeInventory, addInventory, getInventoryQuantity, equipOwnedCosmetic } = require('./shopService');
const { getActiveEffect, addEffectCharge, consumeActiveEffect, insuredRefund } = require('./effectStateService');
function activateEffect(guildId, userId, itemId, effectId, { expiresAt = null, charges = 1 } = {}) {
  return db.transaction(() => {
    consumeInventory(guildId, userId, itemId, 1);
    return addEffectCharge(guildId, userId, effectId, { expiresAt, charges });
  })();
}

function rollCollectible(premium = false, minimumRarity = null, collectionPool = null) {
  const roll = crypto.randomInt(10_000) / 10_000;
  const rarity = premium
    ? roll < 0.03 ? 'mythic' : roll < 0.18 ? 'legendary' : roll < 0.53 ? 'epic' : roll < 0.85 ? 'rare' : 'common'
    : roll < 0.005 ? 'mythic' : roll < 0.04 ? 'legendary' : roll < 0.16 ? 'epic' : roll < 0.46 ? 'rare' : 'common';
  const finalRarity = minimumRarity && RARITY[rarity] < RARITY[minimumRarity] ? minimumRarity : rarity;
  const collectionItems = collectionPool ? COLLECTIBLES.filter(item => item.collection === collectionPool) : COLLECTIBLES;
  const pool = collectionItems.filter(item => item.rarity === finalRarity);
  const fallback = collectionItems.filter(item => RARITY[item.rarity] <= RARITY[finalRarity]);
  const values = pool.length ? pool : fallback;
  return values[crypto.randomInt(values.length)];
}
function openChest(guildId, userId, itemId, { forcedRewardId = null } = {}) {
  return db.transaction(() => {
    consumeInventory(guildId, userId, itemId, 1);
    const chest = getCatalogItem(itemId);
    const lucky = consumeActiveEffect(guildId, userId, 'chest_luck');
    const minimumRarity = lucky ? 'epic' : chest?.minimumRarity || null;
    let reward = forcedRewardId ? getCatalogItem(forcedRewardId) : rollCollectible(itemId === 'premium_chest', minimumRarity, chest?.collectionPool || null);
    if (!reward || reward.type !== 'collectible') throw new Error('INVALID_CHEST_REWARD');
    let duplicate = getInventoryQuantity(guildId, userId, reward.id) > 0;
    let protectedDuplicate = false;
    if (duplicate && getActiveEffect(guildId, userId, 'chest_duplicate_ward')) {
      const meetsRarity = item => !minimumRarity || RARITY[item.rarity] >= RARITY[minimumRarity];
      const missingInPool = COLLECTIBLES.filter(item => (!chest?.collectionPool || item.collection === chest.collectionPool)
        && meetsRarity(item) && getInventoryQuantity(guildId, userId, item.id) < 1);
      const missing = missingInPool.length ? missingInPool : COLLECTIBLES.filter(item => meetsRarity(item) && getInventoryQuantity(guildId, userId, item.id) < 1);
      if (missing.length) {
        consumeActiveEffect(guildId, userId, 'chest_duplicate_ward');
        reward = missing[crypto.randomInt(missing.length)];
        duplicate = false;
        protectedDuplicate = true;
      }
    }
    if (duplicate) {
      const shards = { common: 10, rare: 25, epic: 60, legendary: 150, mythic: 350 }[reward.rarity];
      addInventory(guildId, userId, 'soul_shard', shards);
      return { reward, duplicate: true, shards, lucky, protectedDuplicate };
    }
    addInventory(guildId, userId, reward.id, 1);
    return { reward, duplicate: false, shards: 0, lucky, protectedDuplicate };
  })();
}

function useHint(guildId, channelId) {
  const channel = getGameByChannel(guildId, channelId);
  if (!channel || !['doanitem', 'vuatiengviet'].includes(channel.game)) throw new Error('WRONG_EFFECT_CHANNEL');
  if (channel.game === 'doanitem') {
    const session = medianQuiz.getMedianQuiz(guildId, 'doanitem');
    if (!session) throw new Error('NO_ACTIVE_GAME');
    const answer = String(session.question.answer);
    return `🔎 Gợi ý thêm: đáp án có **${answer.length} ký tự**, bắt đầu bằng **${answer[0].toUpperCase()}**.`;
  }
  const session = games.getVuaSession(guildId);
  if (!session) throw new Error('NO_ACTIVE_GAME');
  const answer = session.question.answer;
  return `🔎 Gợi ý thêm: từ đúng bắt đầu bằng **${answer[0].toUpperCase()}**, kết thúc bằng **${answer.at(-1)}** và có **${answer.replace(/\s/g, '').length} chữ cái**.`;
}
function useSkip(guildId, channelId) {
  const channel = getGameByChannel(guildId, channelId);
  if (!channel || !['doanitem', 'vuatiengviet', 'noitu'].includes(channel.game)) throw new Error('WRONG_EFFECT_CHANNEL');
  if (channel.game === 'doanitem') {
    const result = medianQuiz.skipMedianQuiz(guildId, 'doanitem');
    if (!result) throw new Error('NO_ACTIVE_GAME');
    return `⏭️ Đã đổi câu.\n${medianQuiz.quizText(result.nextQuestion)}`;
  }
  if (channel.game === 'vuatiengviet') {
    const result = games.skipVuaSession(guildId);
    if (!result) throw new Error('NO_ACTIVE_GAME');
    return `⏭️ Đã đổi câu.\n${games.vuaQuestionText(result.nextQuestion)}`;
  }
  const session = games.skipWordSession(guildId);
  if (!session) throw new Error('NO_ACTIVE_GAME');
  return `⏭️ Đã đổi lượt nối từ. Từ tiếp theo phải bắt đầu bằng **${session.required}**.`;
}
function useMinesDetector(guildId, userId, channelId) {
  const session = mines.getMinesByUser(guildId, userId);
  if (!session || session.channel_id !== String(channelId)) throw new Error('NO_ACTIVE_MINES');
  const state = JSON.parse(session.state_json);
  const hidden = state.mines.filter(cell => !state.opened.includes(cell));
  if (!hidden.length) throw new Error('NO_HIDDEN_MINE');
  return `🧭 Máy dò rung mạnh: **ô ${hidden[crypto.randomInt(hidden.length)] + 1} có mìn**. Thông tin này chỉ mình bạn thấy.`;
}

function useMinesSafeMap(guildId, userId, channelId) {
  const session = mines.getMinesByUser(guildId, userId);
  if (!session || session.channel_id !== String(channelId)) throw new Error('NO_ACTIVE_MINES');
  const state = JSON.parse(session.state_json);
  const minesSet = new Set(state.mines);
  const openedSet = new Set(state.opened);
  const safe = Array.from({ length: mines.CELL_COUNT }, (_, index) => index).filter(index => !minesSet.has(index) && !openedSet.has(index));
  if (!safe.length) throw new Error('NO_HIDDEN_SAFE_CELL');
  return `🗺️ Bản đồ xác nhận: **ô ${safe[crypto.randomInt(safe.length)] + 1} an toàn**. Thông tin này chỉ mình bạn thấy.`;
}

function useItem({ guildId, userId, channelId, itemId }) {
  const item = getCatalogItem(itemId);
  if (!item || getInventoryQuantity(guildId, userId, itemId) < 1) throw new Error('ITEM_NOT_OWNED');
  if (item.type === 'color') {
    equipOwnedCosmetic(guildId, userId, item.id);
    return { item, message: `🎨 Đã trang bị **${item.name}**. Dùng \`/hoso\` để xem profile mới.`, ephemeral: true };
  }
  if (item.type === 'chest') {
    const opened = openChest(guildId, userId, item.id);
    const lucky = opened.lucky ? ' 🍀 Bùa may mắn đã bảo đảm độ hiếm từ **EPIC**.' : '';
    const ward = opened.protectedDuplicate ? ' 🧿 Bùa Chống Trùng đã đổi phần thưởng sang một thẻ còn thiếu.' : '';
    return { item, opened, message: (opened.duplicate
      ? `📦 Bạn mở được **${opened.reward.name}** (${opened.reward.rarity}) nhưng đã sở hữu, nên nhận **${opened.shards} Mảnh linh hồn**.`
      : `📦 Bạn mở được **${opened.reward.name}** — độ hiếm **${opened.reward.rarity.toUpperCase()}**!`) + lucky + ward };
  }
  if (item.effect === 'quiz_hint') { const message = useHint(guildId, channelId); consumeInventory(guildId, userId, item.id); return { item, message }; }
  if (item.effect === 'quiz_skip') { const message = useSkip(guildId, channelId); consumeInventory(guildId, userId, item.id); return { item, message }; }
  if (item.effect === 'mines_detector') { const message = useMinesDetector(guildId, userId, channelId); consumeInventory(guildId, userId, item.id); return { item, message, ephemeral: true }; }
  if (item.effect === 'mines_safe_cell') { const message = useMinesSafeMap(guildId, userId, channelId); consumeInventory(guildId, userId, item.id); return { item, message, ephemeral: true }; }
  if (item.effect === 'bet_insurance') { activateEffect(guildId, userId, item.id, 'bet_insurance', { expiresAt: Date.now() + 86_400_000 }); return { item, message: '🛡️ Bảo hiểm cược đã kích hoạt: hoàn 25% nếu ván cược kế tiếp thua trắng, hiệu lực 24 giờ.' }; }
  if (item.effect === 'bet_insurance_plus') { activateEffect(guildId, userId, item.id, 'bet_insurance_plus', { expiresAt: Date.now() + 86_400_000 }); return { item, message: '🛡️ Bảo hiểm cao cấp đã kích hoạt: hoàn 50% nếu ván cược kế tiếp thua trắng, hiệu lực 24 giờ.' }; }
  if (item.effect === 'quiz_reward_boost') { activateEffect(guildId, userId, item.id, 'quiz_reward_boost', { expiresAt: Date.now() + 7 * 86_400_000 }); return { item, message: '✨ Bùa nhân đôi thưởng đã kích hoạt cho câu trả lời đúng tiếp theo, hiệu lực 7 ngày.' }; }
  if (item.effect === 'craft_discount') { activateEffect(guildId, userId, item.id, 'craft_discount', { expiresAt: Date.now() + 7 * 86_400_000 }); return { item, message: '🔨 Búa Thợ Rèn đã kích hoạt: lần /craft tiếp theo giảm 25% Mảnh linh hồn, hiệu lực 7 ngày.' }; }
  if (item.effect === 'chest_luck') { activateEffect(guildId, userId, item.id, 'chest_luck', { expiresAt: Date.now() + 7 * 86_400_000 }); return { item, message: '🍀 Bùa May Mắn đã kích hoạt: hòm sưu tập tiếp theo chắc chắn từ Epic trở lên, hiệu lực 7 ngày.' }; }
  if (item.effect === 'chest_duplicate_ward') { activateEffect(guildId, userId, item.id, 'chest_duplicate_ward', { expiresAt: Date.now() + 7 * 86_400_000 }); return { item, message: '🧿 Bùa Chống Trùng đã kích hoạt cho hòm sưu tập tiếp theo, hiệu lực 7 ngày.' }; }
  if (item.effect === 'soul_shards') {
    db.transaction(() => { consumeInventory(guildId, userId, item.id, 1); addInventory(guildId, userId, 'soul_shard', 100); })();
    return { item, message: '💠 Đã mở Túi Mảnh Linh Hồn và nhận **100 Mảnh linh hồn**.' };
  }
  if (item.effect === 'soul_shards_large') {
    db.transaction(() => { consumeInventory(guildId, userId, item.id, 1); addInventory(guildId, userId, 'soul_shard', 300); })();
    return { item, message: '💠 Đã mở Rương Mảnh Linh Hồn và nhận **300 Mảnh linh hồn**.' };
  }
  if (item.effect === 'hardcore_revive') { activateEffect(guildId, userId, item.id, 'hardcore_revive'); return { item, message: '❤️ Bùa hồi sinh đã kích hoạt cho Hardcore Run tiếp theo.' }; }
  if (item.effect === 'hardcore_chest_lock') { activateEffect(guildId, userId, item.id, 'hardcore_chest_lock'); return { item, message: '🔒 Khóa Hòm đã kích hoạt cho kết quả hòm rỗng hoặc Legendary giả tiếp theo.' }; }
  if (item.effect === 'boss_damage_boost') { activateEffect(guildId, userId, item.id, 'boss_damage_boost', { expiresAt: Date.now() + 7 * 86_400_000, charges: 3 }); return { item, message: '⚔️ Dầu Săn Boss đã kích hoạt: **3 chiến thắng** tiếp theo gây gấp đôi sát thương boss.' }; }
  if (item.effect === 'season_points_boost') { activateEffect(guildId, userId, item.id, 'season_points_boost', { expiresAt: Date.now() + 7 * 86_400_000, charges: 3 }); return { item, message: '🚩 Cờ Hiệu đã kích hoạt: **3 ván** tiếp theo nhận gấp đôi điểm mùa.' }; }
  if (item.effect === 'checkin_streak_guard') { activateEffect(guildId, userId, item.id, 'checkin_streak_guard', { expiresAt: Date.now() + 30 * 86_400_000 }); return { item, message: '📅 Thẻ Giữ Chuỗi đã kích hoạt và sẽ tự dùng nếu bạn bỏ lỡ đúng một ngày.' }; }
  throw new Error('ITEM_NOT_USABLE');
}

module.exports = { getActiveEffect, activateEffect, consumeActiveEffect, insuredRefund, rollCollectible, openChest, useItem };

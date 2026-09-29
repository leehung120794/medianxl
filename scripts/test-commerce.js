const assert = require('node:assert/strict');
const { db } = require('../src/db');
const economy = require('../src/services/economyService');
const shop = require('../src/services/shopService');
const effects = require('../src/services/itemEffectService');
const effectState = require('../src/services/effectStateService');
const coinRequests = require('../src/services/coinRequestService');
const { COLLECTIBLES, RARITY, DEFAULT_PRICE_MULTIPLIER, getCatalogItem } = require('../src/services/itemCatalogService');
const inventoryCommand = require('../src/commands/inventory');
const useCommand = require('../src/commands/use');
const collectionCommand = require('../src/commands/collection');
const craftCommand = require('../src/commands/craft');
const giftitemCommand = require('../src/commands/giftitem');
const minesService = require('../src/services/minesService');

assert.equal(shop.ROTATION_MS, 86_400_000);
assert.equal(coinRequests.REQUEST_TTL_MS, 30_000);
assert.equal(DEFAULT_PRICE_MULTIPLIER, 100);
assert.equal(getCatalogItem('hint_charm').price, 30_000);
assert(COLLECTIBLES.length >= 35, 'expanded Median XL collection should contain at least 35 cards');
for (const pool of ['boss', 'charm', 'set']) {
  for (let index = 0; index < 50; index += 1) {
    const reward = effects.rollCollectible(false, 'rare', pool);
    assert.equal(reward.collection, pool, `targeted ${pool} chest must stay in its collection`);
    assert(RARITY[reward.rarity] >= RARITY.rare, `targeted ${pool} chest must be Rare or better`);
  }
}

const guildId = `test-commerce-${Date.now()}`;
const buyer = 'buyer';
const receiver = 'receiver';

(async () => {
try {
  economy.getAccount(guildId, buyer);
  economy.getAccount(guildId, receiver);
  db.prepare('UPDATE economy_accounts SET balance=10000000,games_played=100,wins=60 WHERE guild_id=? AND user_id=?').run(guildId, buyer);
  db.prepare('UPDATE economy_accounts SET balance=5000 WHERE guild_id=? AND user_id=?').run(guildId, receiver);

  const rotation = shop.listShopItems(guildId);
  assert(rotation.length >= 6 && rotation.length <= 10, 'daily shop must show 6-10 items');
  const colorListing = rotation.find(row => row.catalog.type === 'color');
  assert(colorListing && colorListing.cosmetic_id !== 'color_blood', 'every rotation must contain one purchasable non-default profile color');
  assert(rotation.filter(row => ['chest', 'consumable'].includes(row.catalog.type)).length >= Math.min(rotation.length - 1, 5),
    'shop rotation must primarily contain game items');
  assert(!shop.listShopItems(guildId, { activeOnly: false }).some(row => /^(title|badge|frame|background)_/.test(row.cosmetic_id)),
    'retired profile decorations must not remain listed');
  assert.equal(shop.listShopItems(guildId, { activeOnly: false }).find(row => row.cosmetic_id === 'hint_charm').price, 30_000,
    'system listings must receive the current default catalog price');
  const colorPurchase = shop.purchaseShopItem({ guildId, userId: buyer, itemId: colorListing.item_id });
  assert.equal(colorPurchase.catalog.type, 'color');
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: colorListing.cosmetic_id });
  assert.equal(require('../src/services/profileCosmeticService').getProfileAppearance(guildId, buyer).color.id, colorListing.cosmetic_id,
    'purchased color must be equippable with /use');
  let hint = shop.upsertShopItem({ guildId, catalogId: 'hint_charm', price: 300, stock: 2, minGames: 10, minWins: 5, createdBy: 'admin' });
  assert.equal(hint.price, 300);
  hint = shop.setShopDiscount(guildId, hint.item_id, 50, 24);
  assert.equal(hint.final_price, 150);
  const purchase = shop.purchaseShopItem({ guildId, userId: buyer, itemId: hint.item_id, quantity: 2 });
  assert.equal(purchase.paid, 300);
  assert.equal(shop.getInventoryQuantity(guildId, buyer, 'hint_charm'), 2);
  assert.throws(() => shop.purchaseShopItem({ guildId, userId: buyer, itemId: hint.item_id, quantity: 1 }), /OUT_OF_STOCK/);
  const colorItem = shop.upsertShopItem({ guildId, catalogId: 'color_frost', price: 1000, createdBy: 'admin' });
  assert.throws(() => shop.purchaseShopItem({ guildId, userId: buyer, itemId: colorItem.item_id, quantity: 2 }), /NON_STACKABLE_QUANTITY/);

  shop.addInventory(guildId, buyer, 'bet_insurance', 1);
  const activated = effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'bet_insurance' });
  assert.match(activated.message, /25%/);
  assert(effectState.getActiveEffect(guildId, buyer, 'bet_insurance'));
  assert.equal(effectState.insuredRefund(guildId, buyer, 1000), 250);
  assert.equal(effectState.insuredRefund(guildId, buyer, 1000), 0, 'insurance charge must be consumed once');
  shop.addInventory(guildId, buyer, 'bet_insurance_plus', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'bet_insurance_plus' });
  assert.equal(effectState.insuredRefund(guildId, buyer, 1000), 500, 'premium insurance must refund 50% once');

  shop.addInventory(guildId, buyer, 'reward_booster', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'reward_booster' });
  assert.deepEqual(effectState.boostedQuizReward(guildId, buyer, 50), { amount: 100, boosted: true });
  assert.deepEqual(effectState.boostedQuizReward(guildId, buyer, 50), { amount: 50, boosted: false });

  for (const card of COLLECTIBLES) shop.addInventory(guildId, buyer, card.id, 1);
  shop.consumeInventory(guildId, buyer, 'boss_butcher', 1);
  shop.addInventory(guildId, buyer, 'duplicate_ward', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'duplicate_ward' });
  shop.addInventory(guildId, buyer, 'boss_cache', 1);
  const protectedChest = effects.openChest(guildId, buyer, 'boss_cache', { forcedRewardId: 'card_baal' });
  assert.equal(protectedChest.protectedDuplicate, true, 'duplicate ward must reroll an owned card');
  assert.equal(protectedChest.reward.id, 'boss_butcher', 'duplicate ward should prefer a missing card in the same collection');
  shop.addInventory(guildId, buyer, 'chest_luck', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'chest_luck' });
  shop.addInventory(guildId, buyer, 'common_chest', 1);
  const opened = effects.openChest(guildId, buyer, 'common_chest');
  assert(opened.duplicate && opened.shards > 0, 'duplicate chest reward must become soul shards');
  assert(opened.lucky && RARITY[opened.reward.rarity] >= RARITY.epic, 'chest luck must guarantee Epic or better');
  const craftedTarget = COLLECTIBLES[0];
  shop.consumeInventory(guildId, buyer, craftedTarget.id, 1);
  shop.addInventory(guildId, buyer, 'soul_shard', 2000);
  shop.addInventory(guildId, buyer, 'craft_discount', 1);
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'craft_discount' });
  const crafted = shop.craftCollectible(guildId, buyer, craftedTarget.id);
  assert.equal(crafted.item.id, craftedTarget.id);
  assert.equal(crafted.cost, Math.ceil(craftedTarget.craftCost * 0.75));
  assert.equal(crafted.discounted, true);

  shop.addInventory(guildId, buyer, 'soul_pouch', 1);
  const shardsBeforePouch = shop.getInventoryQuantity(guildId, buyer, 'soul_shard');
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'soul_pouch' });
  assert.equal(shop.getInventoryQuantity(guildId, buyer, 'soul_shard'), shardsBeforePouch + 100);
  shop.addInventory(guildId, buyer, 'soul_crate', 1);
  const shardsBeforeCrate = shop.getInventoryQuantity(guildId, buyer, 'soul_shard');
  effects.useItem({ guildId, userId: buyer, channelId: 'none', itemId: 'soul_crate' });
  assert.equal(shop.getInventoryQuantity(guildId, buyer, 'soul_shard'), shardsBeforeCrate + 300);

  minesService.startMines({ guildId, userId: buyer, channelId: 'mines-channel', stake: 10, mineCount: 2, forcedMines: [0, 1] });
  shop.addInventory(guildId, buyer, 'mines_safe_map', 1);
  const safeMap = effects.useItem({ guildId, userId: buyer, channelId: 'mines-channel', itemId: 'mines_safe_map' });
  const safeCell = Number(safeMap.message.match(/ô (\d+)/)?.[1]);
  assert(safeCell >= 3 && safeCell <= minesService.CELL_COUNT, 'safe map must reveal a valid non-mine cell on the 20-cell board');

  shop.addInventory(guildId, buyer, 'skip_card', 2);
  const gift = shop.transferInventory({ guildId, fromUserId: buyer, toUserId: receiver, itemId: 'skip_card', quantity: 1 });
  assert.equal(gift.remaining, 1);
  assert.equal(shop.getInventoryQuantity(guildId, receiver, 'skip_card'), 1);
  shop.addInventory(guildId, receiver, COLLECTIBLES[2].id, 1);
  const senderCollectibleBefore = shop.getInventoryQuantity(guildId, buyer, COLLECTIBLES[2].id);
  assert.throws(() => shop.transferInventory({ guildId, fromUserId: buyer, toUserId: receiver, itemId: COLLECTIBLES[2].id }), /ALREADY_OWNED/);
  assert.equal(shop.getInventoryQuantity(guildId, buyer, COLLECTIBLES[2].id), senderCollectibleBefore,
    'failed duplicate gift must not remove the sender item');

  const makeInteraction = ({ actor = buyer, userOption = null, stringOption = null, integerOption = null } = {}) => {
    const replies = [];
    return {
      guildId, channelId: 'channel', user: { id: actor, username: actor, globalName: actor, bot: false }, replies,
      options: {
        getUser: () => userOption,
        getString: () => stringOption,
        getInteger: () => integerOption,
        getFocused: () => '',
      },
      reply: async payload => { replies.push(payload); return payload; },
      respond: async payload => { replies.push(payload); return payload; },
    };
  };
  const inventoryInteraction = makeInteraction();
  await inventoryCommand.execute(inventoryInteraction);
  assert.equal(inventoryInteraction.replies[0].embeds.length, 1, '/inventory must return an embed');
  const collectionInteraction = makeInteraction();
  await collectionCommand.execute(collectionInteraction);
  assert.equal(collectionInteraction.replies[0].embeds.length, 1, '/collection must return an embed');

  shop.addInventory(guildId, buyer, 'soul_pouch', 1);
  const useInteraction = makeInteraction({ stringOption: 'soul_pouch' });
  await useCommand.execute(useInteraction);
  assert.match(useInteraction.replies[0].content, /100 Mảnh/);

  const commandCraftTarget = COLLECTIBLES[1];
  shop.consumeInventory(guildId, buyer, commandCraftTarget.id, 1);
  shop.addInventory(guildId, buyer, 'soul_shard', commandCraftTarget.craftCost);
  const craftInteraction = makeInteraction({ stringOption: commandCraftTarget.id });
  await craftCommand.execute(craftInteraction);
  assert.match(craftInteraction.replies[0].content, /Đã chế tạo/);

  shop.addInventory(guildId, buyer, 'hint_charm', 1);
  const giftInteraction = makeInteraction({ userOption: { id: receiver, username: receiver, globalName: receiver, bot: false }, stringOption: 'hint_charm', integerOption: 1 });
  await giftitemCommand.execute(giftInteraction);
  assert.match(giftInteraction.replies[0].content, /đã tặng/);

  const beforeBuyer = economy.getAccount(guildId, buyer).balance;
  const beforeReceiver = economy.getAccount(guildId, receiver).balance;
  const request = coinRequests.createCoinRequest({ guildId, channelId: 'channel', requesterId: buyer, targetId: receiver, amount: 500, reason: 'test', now: 1_000_000 });
  const accepted = coinRequests.acceptCoinRequest(request.id, receiver, 1_001_000);
  assert.equal(accepted.transfer.amount, 500);
  assert.equal(economy.getAccount(guildId, buyer).balance, beforeBuyer + 500);
  assert.equal(economy.getAccount(guildId, receiver).balance, beforeReceiver - 500);
  assert.throws(() => coinRequests.acceptCoinRequest(request.id, receiver, 1_002_000), /REQUEST_CLOSED/);
  assert.throws(() => coinRequests.createCoinRequest({ guildId, channelId: 'channel', requesterId: buyer, targetId: receiver, amount: 10, now: 1_002_000 }), /REQUEST_COOLDOWN/);
  assert.equal(coinRequests.cleanupCoinRequests(1_001_000 + 86_400_001), 1, 'closed coin requests should be deleted one day after closing');

  db.prepare('UPDATE shop_purchases SET created_at=0 WHERE guild_id=?').run(guildId);
  assert(shop.cleanupShopPurchases(7 * 86_400_000 + 1) >= 1, 'shop purchase history should be deleted after seven days');

  assert(shop.removeShopItem(guildId, hint.item_id));
  console.log(JSON.stringify({ ok: true, rotation: rotation.length, inventory: shop.getInventory(guildId, buyer).length, collection: shop.collectionProgress(guildId, buyer).count }));
} finally {
  db.prepare('DELETE FROM coin_requests WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM mines_sessions WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM user_item_effects WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM user_inventory WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM shop_purchases WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM shop_items WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM shop_settings WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM profile_loadouts WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM profile_cosmetics WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM game_player_stats WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM economy_transactions WHERE guild_id=?').run(guildId);
  db.prepare('DELETE FROM economy_accounts WHERE guild_id=?').run(guildId);
}
})().catch(error => { console.error(error); process.exitCode = 1; });

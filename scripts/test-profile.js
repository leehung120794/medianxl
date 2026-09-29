const assert = require('node:assert/strict');
const { db } = require('../src/db');
const {
  DEFAULT_IDS,
  getProfileAppearance,
  getOwnedCosmetics,
  grantCosmetic,
  equipCosmetic,
} = require('../src/services/profileCosmeticService');
const { renderProfileCard, WIDTH, HEIGHT } = require('../src/services/profileCardService');
const hosoCommand = require('../src/commands/hoso');

const guildId = `test-profile-${Date.now()}`;
const userId = 'profile-user';

(async () => {
  try {
    const defaultAppearance = getProfileAppearance(guildId, userId);
    assert.equal(getOwnedCosmetics(guildId, userId).length, DEFAULT_IDS.length);
    assert.equal(defaultAppearance.color.id, 'color_blood');

    assert.equal(grantCosmetic(guildId, userId, 'color_arcane').newlyOwned, true);
    assert.equal(grantCosmetic(guildId, userId, 'color_arcane').newlyOwned, false);
    const appearance = equipCosmetic(guildId, userId, 'color_arcane');
    assert.equal(appearance.color.value, '#a855f7');
    assert.throws(() => grantCosmetic(guildId, userId, 'title_hardcore'), /UNKNOWN_COSMETIC/);

    const png = await renderProfileCard({
      displayName: 'Người chơi thử nghiệm',
      username: 'profile.test',
      avatarUrl: null,
      account: { balance: 12500, games_played: 40, wins: 22, losses: 15, draws: 3 },
      rank: 7,
      appearance,
    });
    assert(png.length > 10_000, 'profile card should contain a rendered PNG');
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([WIDTH, HEIGHT], [1000, 340]);

    let deferred = false;
    let commandReply = null;
    const commandUser = {
      id: userId, username: 'profile.test', globalName: 'Người chơi thử nghiệm', bot: false,
      displayAvatarURL: () => null,
    };
    await hosoCommand.execute({
      guildId,
      user: commandUser,
      options: { getUser: () => null },
      deferReply: async () => { deferred = true; },
      editReply: async payload => { commandReply = payload; return payload; },
    });
    assert.equal(deferred, true, '/hoso must acknowledge the interaction before rendering');
    assert.equal(commandReply.files.length, 1, '/hoso must return a rendered profile attachment');
    assert.equal(commandReply.embeds.length, 1, '/hoso must return the profile embed');
    console.log(JSON.stringify({ ok: true, pngBytes: png.length, owned: getOwnedCosmetics(guildId, userId).length }));
  } finally {
    db.prepare('DELETE FROM user_inventory WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM profile_loadouts WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM profile_cosmetics WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM economy_transactions WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM economy_accounts WHERE guild_id = ?').run(guildId);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

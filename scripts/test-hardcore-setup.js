'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testDb = path.resolve(__dirname, '../data/test-hardcore-setup.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
process.env.DB_PATH = testDb;

const { getAccount, creditCoins } = require('../src/services/economyService');
const hardcore = require('../src/services/hardcoreService');
const setupService = require('../src/services/hardcoreSetupService');

(async () => {
  const guildId = 'setup-guild'; const userId = 'setup-user'; const channelId = 'setup-channel';
  creditCoins({ guildId, userId, amount: 1_000, reason: 'test:fund', operationId: 'test:hardcore-setup-fund' });
  require('../src/services/gameChannelService').setGameChannel(guildId, 'hardcore', channelId);
  const commandReplies = [];
  await require('../src/commands/hardcore').execute({
    guildId, channelId, user: { id: 'slash-user' },
    options: { getSubcommand: () => 'batdau', getInteger: () => null, getString: () => null },
    reply: async payload => { commandReplies.push(payload); return payload; },
  });
  assert.match(commandReplies[0].embeds[0].toJSON().title, /CHUẨN BỊ RUN/);
  assert.equal(commandReplies[0].flags, 64, 'bảng chuẩn bị slash phải là riêng tư');
  assert.equal(commandReplies[0].components.length, 2);
  const before = getAccount(guildId, userId).balance;
  const setup = setupService.createSetup({ guildId, channelId, userId });
  let panel = setupService.setupPanel(setup);
  assert.equal(panel.components[1].components[1].data.disabled, true, 'chưa đủ lựa chọn thì nút Bắt đầu phải khóa');

  await setupService.handleSetupClass({
    customId: `hardcore-setup-class:${setup.token}`, values: ['amazon'], guildId, user: { id: userId },
    update: async payload => { panel = payload; return payload; }, reply: async payload => payload,
  });
  assert.equal(setup.classKey, 'amazon');
  assert.equal(panel.components[1].components[1].data.disabled, true);

  await setupService.handleSetupModal({
    customId: `hardcore-setup-modal:${setup.token}`, guildId, user: { id: userId },
    fields: { getTextInputValue: () => '100' },
    update: async payload => { panel = payload; return payload; }, reply: async payload => payload,
  });
  assert.equal(setup.stake, 100);
  assert.equal(panel.components[1].components[1].data.disabled, false);
  assert.equal(getAccount(guildId, userId).balance, before, 'nhập cược chưa được trừ xu');

  const startInteraction = {
    customId: `hardcore-setup-start:${setup.token}`, guildId, user: { id: userId }, message: { id: 'setup-panel' },
    deferred: false, replied: false,
    deferUpdate: async function deferUpdate() { this.deferred = true; },
    editReply: async payload => payload, followUp: async payload => payload, reply: async payload => payload,
  };
  const started = await setupService.handleSetupButton(startInteraction);
  assert(started.session.id);
  assert.equal(getAccount(guildId, userId).balance, before - 100, 'chỉ bấm Bắt đầu mới giữ xu');
  assert.equal(require('../src/services/hardcoreRepository').getSession(started.session.id).message_id, 'setup-panel');
  hardcore.playHardcore({ sessionId: started.session.id, userId, expectedTurn: 0, action: 'retreat' });

  const batdau = require('../src/commands/hardcore').data.toJSON().options.find(option => option.name === 'batdau');
  assert.equal(batdau.options?.length || 0, 0, 'slash batdau phải mở UI, không còn option bắt buộc');
  const routes = require('../src/componentRouter').ROUTES;
  assert(routes.some(route => route.kind === 'select' && route.prefix === 'hardcore-setup-class:'));
  assert(routes.some(route => route.kind === 'modal' && route.prefix === 'hardcore-setup-modal:'));

  require('../src/db').db.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${testDb}${suffix}`, { force: true });
  console.log(JSON.stringify({ ok: true, hardcoreSetup: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });

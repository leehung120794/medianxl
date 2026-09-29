require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const pino = require('pino');
const itemCommand = require('./commands/item');
const sleepCommand = require('./commands/sleep');
const statusCommand = require('./commands/status');
const breakpointCommand = require('./commands/breakpoint');
const compareCommand = require('./commands/compare');
const xuCommand = require('./commands/xu');
const hosoCommand = require('./commands/hoso');
const baucuaCommand = require('./commands/baucua');
const oantutiCommand = require('./commands/oantuti');
const taixiuCommand = require('./commands/taixiu');
const blackjackCommand = require('./commands/blackjack');
const duanguaCommand = require('./commands/duangua');
const minesCommand = require('./commands/mines');
const hardcoreCommand = require('./commands/hardcore');
const noituCommand = require('./commands/noitu');
const vuatiengvietCommand = require('./commands/vuatiengviet');
const gameCommand = require('./commands/game');
const doanitemCommand = require('./commands/doanitem');
const trochoiCommand = require('./commands/trochoi');
const shopCommand = require('./commands/shop');
const buyCommand = require('./commands/buy');
const inventoryCommand = require('./commands/inventory');
const useCommand = require('./commands/use');
const collectionCommand = require('./commands/collection');
const craftCommand = require('./commands/craft');
const giftitemCommand = require('./commands/giftitem');
const anxinCommand = require('./commands/anxin');
const nhiemvuCommand = require('./commands/nhiemvu');
const sukienCommand = require('./commands/sukien');
const xephangCommand = require('./commands/xephang');
const { syncAll } = require('./services/syncService');
const monitoring = require('./services/monitoringService');
const { startEconomyMaintenance } = require('./services/economyService');
const { handlePrefixMessage } = require('./services/prefixCommandService');
const { handleGameMessage } = require('./services/gameMessageService');
const { handleGamePrefix } = require('./services/gamePrefixService');
const { handleBetButton, handleBetModal, resumeOpenRounds } = require('./services/multiplayerGameService');
const { handleBlackjackButton } = require('./services/blackjackService');
const { handleHorseButton, handleHorseModal, resumeHorseRaces } = require('./services/horseRaceService');
const { handleMinesButton } = require('./services/minesService');
const { handleHardcoreButton, cleanupStaleHardcoreSessions } = require('./services/hardcoreService');
const { startTimedChallengeMaintenance } = require('./services/timedChallengeService');
const { handleCoinRequestButton } = require('./services/coinRequestService');
const { startCommerceMaintenance } = require('./services/commerceMaintenanceService');

if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN in .env');
const logDir = path.resolve(process.env.LOG_DIR || './logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, process.env.LOG_FILE_NAME || 'bot.log');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' }, pino.multistream([{ stream: process.stdout }, { stream: pino.destination({ dest: logFile, sync: false }) }]));
startEconomyMaintenance(logger);
const messageCommandsEnabled = /^(1|true|yes)$/i.test(process.env.ENABLE_MESSAGE_COMMANDS || process.env.ENABLE_PREFIX_COMMANDS || 'false');
const intents = [GatewayIntentBits.Guilds];
if (messageCommandsEnabled) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
else logger.warn('prefix commands disabled; enable Message Content Intent in Discord Developer Portal and set ENABLE_PREFIX_COMMANDS=true');
const client = new Client({ intents });
client.commands = new Collection([
  ['item', itemCommand], ['sleep', sleepCommand], ['status', statusCommand], ['breakpoint', breakpointCommand],
  ['compare', compareCommand], ['xu', xuCommand], ['hoso', hosoCommand],
  ['baucua', baucuaCommand], ['oantuti', oantutiCommand], ['taixiu', taixiuCommand], ['blackjack', blackjackCommand],
  ['duangua', duanguaCommand], ['mines', minesCommand],
  ['hardcore', hardcoreCommand],
  ['noitu', noituCommand], ['vuatiengviet', vuatiengvietCommand],
  ['game', gameCommand],
  ['doanitem', doanitemCommand],
  ['trochoi', trochoiCommand],
  ['shop', shopCommand], ['buy', buyCommand], ['inventory', inventoryCommand], ['use', useCommand],
  ['collection', collectionCommand], ['craft', craftCommand], ['giftitem', giftitemCommand], ['anxin', anxinCommand],
  ['nhiemvu', nhiemvuCommand], ['sukien', sukienCommand], ['xephang', xephangCommand],
]);
let syncInProgress = false;

process.on('unhandledRejection', error => { logger.error({ err: error }, 'unhandled rejection'); monitoring.recordRuntimeError(error, { source: 'unhandledRejection' }); });
process.on('uncaughtException', error => { logger.fatal({ err: error }, 'uncaught exception'); monitoring.recordRuntimeError(error, { source: 'uncaughtException' }); });
client.once(Events.ClientReady, () => {
  const resumedRounds = resumeOpenRounds(client, logger);
  const resumedHorseRaces = resumeHorseRaces(client, logger);
  const expiredHardcoreRuns = cleanupStaleHardcoreSessions();
  startTimedChallengeMaintenance(client, logger);
  startCommerceMaintenance(client, logger);
  logger.info({ user: client.user.tag, logFile, resumedRounds, resumedHorseRaces, expiredHardcoreRuns }, 'bot ready');
});
if (messageCommandsEnabled) {
  client.on(Events.MessageCreate, message => {
    (async () => {
      if (await handlePrefixMessage(message, logger)) return;
      if (await handleGamePrefix(message)) return;
      await handleGameMessage(message);
    })().catch(error => {
      logger.error({ err: error }, 'message command failed');
      monitoring.recordRuntimeError(error, { source: 'message' });
    });
  });
}
client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('anxin:')) {
    try { await handleCoinRequestButton(interaction); }
    catch (error) { logger.error({ err: error }, 'coin request button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'anxin' }); }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('hardcore:')) {
    try { await handleHardcoreButton(interaction); }
    catch (error) { logger.error({ err: error }, 'hardcore button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'hardcore' }); }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('mines:')) {
    try { await handleMinesButton(interaction); }
    catch (error) { logger.error({ err: error }, 'mines button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'mines' }); }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('horserace:')) {
    try { await handleHorseButton(interaction); }
    catch (error) { logger.error({ err: error }, 'horse race button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'duangua' }); }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('blackjack:')) {
    try { await handleBlackjackButton(interaction); }
    catch (error) { logger.error({ err: error }, 'blackjack button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'blackjack' }); }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('gamebet:')) {
    try { await handleBetButton(interaction); }
    catch (error) { logger.error({ err: error }, 'bet button failed'); monitoring.recordRuntimeError(error, { source: 'button', command: 'gamebet' }); }
    return;
  }
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('horserace-modal:')) {
      try { await handleHorseModal(interaction); }
      catch (error) { logger.error({ err: error }, 'horse race modal failed'); monitoring.recordRuntimeError(error, { source: 'modal', command: 'duangua' }); }
      return;
    }
    if (interaction.customId.startsWith('gamebet-modal:')) {
      try { await handleBetModal(interaction); }
      catch (error) { logger.error({ err: error }, 'bet modal failed'); monitoring.recordRuntimeError(error, { source: 'modal', command: 'gamebet' }); }
      return;
    }
    return;
  }
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) await command.autocomplete(interaction).catch(error => { logger.error({ err: error, command: interaction.commandName }, 'autocomplete failed'); monitoring.recordRuntimeError(error, { source: 'autocomplete', command: interaction.commandName }); });
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'sync' || interaction.commandName === 'update') {
    const admins = (process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
    if (!admins.includes(interaction.user.id)) return interaction.reply({ content: 'Bạn không có quyền cập nhật database.', flags: MessageFlags.Ephemeral });
    if (syncInProgress) return interaction.reply({ content: 'Một lần cập nhật database đang chạy. Vui lòng chờ hoàn tất.', flags: MessageFlags.Ephemeral });
    syncInProgress = true; await interaction.deferReply({ flags: MessageFlags.Ephemeral }); monitoring.recordSyncStart();
    try { const result = await syncAll(logger); monitoring.recordSyncResult(result); const summary = result.report.map(x => `${x.slug}=${x.ok ? x.count : `ERROR (${x.error})`}`).join(', '); const failed = result.report.filter(x => !x.ok).length; return interaction.editReply(`${failed ? 'Cập nhật hoàn tất nhưng có nguồn lỗi' : 'Cập nhật database hoàn tất'}: ${summary}`); }
    catch (error) { logger.error({ err: error }, 'database sync failed'); monitoring.recordSyncError(error); return interaction.editReply(`Cập nhật database thất bại: ${error.message}`); }
    finally { syncInProgress = false; }
  }
  const command = client.commands.get(interaction.commandName);
  if (!command) return interaction.reply({ content: 'Lệnh này chưa được nạp trên phiên bản bot đang chạy.', flags: MessageFlags.Ephemeral });
  try { await command.execute(interaction); }
  catch (error) {
    logger.error({ err: error, command: interaction.commandName }, 'command failed');
    monitoring.recordRuntimeError(error, { source: 'command', command: interaction.commandName });
    const content = 'Có lỗi khi xử lý lệnh. Lỗi đã được ghi vào monitoring log.';
    if (interaction.deferred) await interaction.editReply({ content, embeds: [], components: [], files: [] });
    else if (interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
});
client.login(process.env.DISCORD_TOKEN).catch(error => { logger.fatal({ err: error }, 'discord login failed'); monitoring.recordRuntimeError(error, { source: 'login' }); process.exitCode = 1; });

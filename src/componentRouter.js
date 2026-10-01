const { MessageFlags } = require('discord.js');
const { handleBetButton, handleBetModal } = require('./services/multiplayerGameService');
const { handleBlackjackButton } = require('./services/blackjackService');
const { handleBlackjackTableButton, handleBlackjackTablePrivateButton, getBlackjackTableLock } = require('./services/blackjackService');
const { handleBlackjackDuelButton } = require('./services/blackjackDuelService');
const { handlePokerButton, handlePokerPrivateButton, handlePokerModal } = require('./services/pokerService');
const { handleHorseButton, handleHorseModal } = require('./services/horseRaceService');
const { handleMinesButton } = require('./services/minesService');
const { handleCoquayButton } = require('./services/coquayService');
const { handleHardcoreButton, handleHardcoreItemsButton } = require('./services/hardcoreService');
const { handleCoinRequestButton } = require('./services/coinRequestService');
const { handleRpsDuelButton } = require('./services/rpsDuelService');
const { handleReplayButton } = require('./services/replayService');
const { handleRpsBotButton } = require('./services/rpsBotService');
const { handleChinchiroButton } = require('./services/chinchiroService');
const profileCommand = require('./commands/hoso');
const shopCommand = require('./commands/shop');
const gachaCommand = require('./commands/gacha');
const useCommand = require('./commands/use');
const leaderboardCommand = require('./commands/xephang');
const helpCommand = require('./commands/trogiup');
const gameCommand = require('./commands/game');
const vuaTiengVietCommand = require('./commands/vuatiengviet');
const itemCatalogViewCommand = require('./commands/itemCatalogView');
const adminCommand = require('./commands/quantri');
const checklistCommand = require('./commands/kiemtra');

const ROUTES = Object.freeze([
  { kind: 'button', prefix: 'replay:', handle: (interaction, logger) => handleReplayButton(interaction, logger) },
  { kind: 'select', prefix: 'hoso:', handle: interaction => profileCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'shop:', handle: interaction => shopCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'use:', handle: interaction => useCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'use-filter:', handle: interaction => useCommand.handleFilter(interaction) },
  { kind: 'select', prefix: 'iteminfo-filter:', handle: interaction => itemCatalogViewCommand.handleFilter(interaction) },
  { kind: 'select', prefix: 'game-config-select', handle: interaction => gameCommand.handleConfigSelect(interaction) },
  { kind: 'select', prefix: 'xephang:', handle: interaction => leaderboardCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'trogiup:', handle: interaction => helpCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'kiemtra:', handle: interaction => checklistCommand.handleSelect(interaction) },
  { kind: 'select', prefix: 'kiemtra-status:', handle: interaction => checklistCommand.handleAchievementFilter(interaction) },
  { kind: 'select', prefix: 'kiemtra-category:', handle: interaction => checklistCommand.handleAchievementFilter(interaction) },
  { kind: 'button', prefix: 'kiemtra-page:', handle: interaction => checklistCommand.handleAchievementPage(interaction) },
  { kind: 'button', prefix: 'gacha-history:', handle: interaction => gachaCommand.handleHistoryButton(interaction) },
  { kind: 'button', prefix: 'gacha:', handle: interaction => gachaCommand.handleButton(interaction) },
  { kind: 'button', prefix: 'rpsbot:', handle: handleRpsBotButton },
  { kind: 'button', prefix: 'chinchiro:', handle: handleChinchiroButton },
  { kind: 'button', prefix: 'vuatiengviet:', handle: interaction => vuaTiengVietCommand.handleButton(interaction) },
  { kind: 'button', prefix: 'iteminfo-page:', handle: interaction => itemCatalogViewCommand.handlePage(interaction) },
  { kind: 'button', prefix: 'admin-clear-all:', handle: interaction => adminCommand.handleClearAllButton(interaction) },
  { kind: 'button', prefix: 'anxin:', handle: handleCoinRequestButton },
  { kind: 'button', prefix: 'rpsduel:', handle: handleRpsDuelButton },
  { kind: 'button', prefix: 'bjduel:', handle: handleBlackjackDuelButton },
  { kind: 'button', prefix: 'poker-private:', handle: handlePokerPrivateButton },
  { kind: 'button', prefix: 'poker:', handle: handlePokerButton },
  { kind: 'button', prefix: 'hardcore-items:', handle: handleHardcoreItemsButton },
  { kind: 'button', prefix: 'hardcore:', handle: handleHardcoreButton },
  { kind: 'button', prefix: 'mines:', handle: handleMinesButton },
  { kind: 'button', prefix: 'coquay:', handle: handleCoquayButton },
  { kind: 'button', prefix: 'horserace:', handle: handleHorseButton },
  { kind: 'button', prefix: 'blackjack:', handle: handleBlackjackButton },
  { kind: 'button', prefix: 'blackjack-table-private:', handle: handleBlackjackTablePrivateButton },
  { kind: 'button', prefix: 'blackjack-table:', handle: handleBlackjackTableButton },
  { kind: 'button', prefix: 'gamebet:', handle: handleBetButton },
  { kind: 'modal', prefix: 'horserace-modal:', handle: handleHorseModal },
  { kind: 'modal', prefix: 'gamebet-modal:', handle: handleBetModal },
  { kind: 'modal', prefix: 'poker-modal:', handle: handlePokerModal },
  { kind: 'modal', prefix: 'poker-private-modal:', handle: handlePokerModal },
  { kind: 'modal', prefix: 'game-config-modal:', handle: interaction => gameCommand.handleConfigModal(interaction) },
]);

function interactionKind(interaction) {
  if (interaction.isButton()) return 'button';
  if (interaction.isStringSelectMenu()) return 'select';
  if (interaction.isModalSubmit()) return 'modal';
  return null;
}

async function ephemeralResponse(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function routeComponentInteraction(interaction, logger) {
  const kind = interactionKind(interaction);
  if (!kind) return false;
  const route = ROUTES.find(item => item.kind === kind && interaction.customId.startsWith(item.prefix));
  if (!route) return false;
  // Sinh tồn có nhiều nút và embed lớn. ACK ngay trước mọi truy vấn/lock chung để
  // Discord không hết cửa sổ phản hồi 3 giây khi server hoặc SQLite đang bận.
  if (kind === 'button' && interaction.customId.startsWith('hardcore:') && !interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferUpdate();
      const acknowledgementDelayMs = Date.now() - (interaction.createdTimestamp || Date.now());
      if (acknowledgementDelayMs > 1_500) logger?.warn({ interactionId: interaction.id, acknowledgementDelayMs }, 'slow hardcore interaction acknowledgement');
    } catch (error) {
      logger?.warn({ err: error, code: error?.code, interactionId: interaction.id }, 'could not acknowledge hardcore interaction in router');
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: 'Nút đã hết thời gian phản hồi. Hãy bấm lại trên bảng Sinh tồn mới nhất.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return true;
    }
  }
  const gameAction = /^(replay:|rpsbot:|chinchiro:|rpsduel:|bjduel:|poker:|poker-private:|hardcore:|mines:|coquay:|horserace:|blackjack:|gamebet:|gamebet-modal:|poker-modal:|poker-private-modal:|horserace-modal:)/.test(interaction.customId);
  if (gameAction && interaction.guildId && !interaction.customId.startsWith('blackjack-table:')
    && getBlackjackTableLock(interaction.guildId, interaction.user.id)) {
    await ephemeralResponse(interaction, 'Bạn đang ở bàn Xì dách và chỉ có thể thao tác tại bàn đó cho đến khi ván kết thúc.');
    return true;
  }
  await route.handle(interaction, logger);
  return true;
}

module.exports = { ROUTES, interactionKind, ephemeralResponse, routeComponentInteraction };

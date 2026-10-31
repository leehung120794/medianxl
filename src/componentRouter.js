const { MessageFlags } = require("discord.js");
const {
  handleBetButton,
  handleBetModal,
} = require("./services/multiplayerGameService");
const { handleBlackjackButton } = require("./services/blackjackService");
const {
  handleBlackjackTableButton,
  handleBlackjackTablePrivateButton,
  getBlackjackTableLock,
} = require("./services/blackjackService");
const {
  handleBlackjackDuelButton,
} = require("./services/blackjackDuelService");
const {
  handlePokerButton,
  handlePokerPrivateButton,
  handlePokerModal,
} = require("./services/pokerService");
const {
  handleHorseButton,
  handleHorseModal,
} = require("./services/horseRaceService");
const { handleMinesButton } = require("./services/minesService");
const { handleCoinRequestButton } = require("./services/coinRequestService");
const { handleReplayButton } = require("./services/replayService");
const profileCommand = require("./commands/hoso");
const leaderboardCommand = require("./commands/xephang");
const rulesCommand = require("./commands/luat");
const gameCommand = require("./commands/game");
const vuaTiengVietCommand = require("./commands/vuatiengviet");
const adminCommand = require("./commands/quantri");
const { handleWinMultiplierInteraction } = require("./commands/quantriPanels");

const ROUTES = Object.freeze([
  {
    kind: "button",
    prefix: "changelog:",
    handle: (interaction) => require("./commands/changelog").handleButton(interaction),
  },
  {
    kind: "button",
    prefix: "luat:",
    handle: (interaction) => rulesCommand.handleButton(interaction),
  },
  {
    kind: "button",
    prefix: "replay:",
    handle: (interaction, logger) => handleReplayButton(interaction, logger),
  },
  {
    kind: "select",
    prefix: "hoso:",
    handle: (interaction) => profileCommand.handleSelect(interaction),
  },
  {
    kind: "select",
    prefix: "game-config-select",
    handle: (interaction) => gameCommand.handleConfigSelect(interaction),
  },
  {
    kind: "select",
    prefix: "xephang:",
    handle: (interaction) => leaderboardCommand.handleSelect(interaction),
  },
  {
    kind: "button",
    prefix: "vuatiengviet:",
    handle: (interaction) => vuaTiengVietCommand.handleButton(interaction),
  },
  {
    kind: "button",
    prefix: "admin-clear-all:",
    handle: (interaction) => adminCommand.handleClearAllButton(interaction),
  },
  {
    kind: "button",
    prefix: "admin-maintenance:",
    handle: (interaction) => adminCommand.handleMaintenanceButton(interaction),
  },
  {
    kind: "button",
    prefix: "admin-winmult:",
    handle: handleWinMultiplierInteraction,
  },
  {
    kind: "select",
    prefix: "admin-winmult:",
    handle: handleWinMultiplierInteraction,
  },
  {
    kind: "modal",
    prefix: "admin-winmult:",
    handle: handleWinMultiplierInteraction,
  },
  { kind: "button", prefix: "anxin:", handle: handleCoinRequestButton },
  { kind: "button", prefix: "bjduel:", handle: handleBlackjackDuelButton },
  {
    kind: "button",
    prefix: "poker-private:",
    handle: handlePokerPrivateButton,
  },
  { kind: "button", prefix: "poker:", handle: handlePokerButton },
  { kind: "button", prefix: "mines:", handle: handleMinesButton },
  { kind: "button", prefix: "horserace:", handle: handleHorseButton },
  { kind: "button", prefix: "blackjack:", handle: handleBlackjackButton },
  {
    kind: "button",
    prefix: "blackjack-table-private:",
    handle: handleBlackjackTablePrivateButton,
  },
  {
    kind: "button",
    prefix: "blackjack-table:",
    handle: handleBlackjackTableButton,
  },
  { kind: "button", prefix: "gamebet:", handle: handleBetButton },
  { kind: "modal", prefix: "horserace-modal:", handle: handleHorseModal },
  { kind: "modal", prefix: "gamebet-modal:", handle: handleBetModal },
  { kind: "modal", prefix: "poker-modal:", handle: handlePokerModal },
  { kind: "modal", prefix: "poker-private-modal:", handle: handlePokerModal },
  {
    kind: "modal",
    prefix: "game-config-modal:",
    handle: (interaction) => gameCommand.handleConfigModal(interaction),
  },
]);

function interactionKind(interaction) {
  if (interaction.isButton()) return "button";
  // Menu chọn chuỗi và menu chọn vai trò đều định tuyến theo tiền tố customId.
  if (interaction.isStringSelectMenu() || interaction.isRoleSelectMenu?.())
    return "select";
  if (interaction.isModalSubmit()) return "modal";
  return null;
}

async function routeComponentInteraction(interaction, logger) {
  const kind = interactionKind(interaction);
  if (!kind) return false;
  if (
    /^(chinchiro:|coquay:|hardcore(?::|-)|gacha(?:-history)?:|shop:|use(?:-page|-filter)?:|iteminfo-(?:page|filter):)/.test(
      interaction.customId,
    )
  ) {
    await interaction.reply({
      content: "Chức năng này đã được gỡ khỏi bot.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  const route = ROUTES.find(
    (item) =>
      item.kind === kind && interaction.customId.startsWith(item.prefix),
  );
  if (!route) return false;
  const gameAction =
    /^(replay:|bjduel:|poker:|poker-private:|mines:|horserace:|blackjack:|gamebet:|gamebet-modal:|poker-modal:|poker-private-modal:|horserace-modal:)/.test(
      interaction.customId,
    );
  if (
    gameAction &&
    interaction.guildId &&
    !interaction.customId.startsWith("blackjack-table:") &&
    getBlackjackTableLock(interaction.guildId, interaction.user.id)
  ) {
    await interaction.reply({
      content:
        "Bạn đang ở bàn Xì dách và chỉ có thể thao tác tại bàn đó cho đến khi ván kết thúc.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  await route.handle(interaction, logger);
  return true;
}

module.exports = { ROUTES, interactionKind, routeComponentInteraction };

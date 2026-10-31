const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");
const {
  remapOptions,
  renamedOption,
  commandData,
} = require("../utils/commandAlias");

const games = {
  baucua: require("./baucua"),
  taixiu: require("./taixiu"),
  xidach: require("./blackjack"),
  poker: require("./poker"),
  duangua: require("./duangua"),
  domin: require("./mines"),
  vuatiengviet: require("./vuatiengviet"),
};

const GAME_ALIASES = {
  vtv: "vuatiengviet",
  vutiengviet: "vuatiengviet",
};
const MAINTENANCE_KEYS = {
  xidach: "blackjack",
  domin: "mines",
  vuatiengviet: "vuatiengviet",
};

function simpleGame(
  name,
  command,
  description = command.data.toJSON().description,
  names = {},
) {
  const schema = command.data.toJSON();
  return {
    type: ApplicationCommandOptionType.Subcommand,
    name,
    description,
    options: (schema.options || []).map((option) =>
      renamedOption(option, names),
    ),
  };
}
function gameGroup(
  name,
  command,
  description,
  subNames = {},
  optionNames = {},
) {
  return {
    type: ApplicationCommandOptionType.SubcommandGroup,
    name,
    description,
    options: command.data
      .toJSON()
      .options.map((option) =>
        renamedOption(
          { ...option, name: subNames[option.name] || option.name },
          optionNames,
        ),
      ),
  };
}

const options = [
  simpleGame("baucua", games.baucua, "Mở bàn Bầu cua nhiều người"),
  simpleGame("taixiu", games.taixiu, "Mở bàn Tài xỉu nhiều người"),
  simpleGame(
    "xidach",
    games.xidach,
    "Chơi Xì dách với nhà cái bot hoặc mở bàn với người chơi khác",
  ),
  simpleGame(
    "poker",
    games.poker,
    "Chơi Poker với bot hoặc mời một người chơi",
  ),
  simpleGame("duangua", games.duangua, "Mở cuộc Đua ngựa nhiều người"),
  simpleGame("domin", games.domin, "Dò mìn và săn hệ số thưởng", {
    min: "somin",
  }),
  simpleGame("vtv", games.vuatiengviet, "Admin: bắt đầu phiên Vua tiếng Việt"),
];

function selected(interaction) {
  return (
    interaction.options.getSubcommandGroup(false) ||
    interaction.options.getSubcommand()
  );
}
function delegated(interaction) {
  const selectedKey = selected(interaction);
  const key = GAME_ALIASES[selectedKey] || selectedKey;
  if (key === "domin")
    return {
      command: games.domin,
      subcommand: null,
      optionNames: { min: "somin" },
    };
  return { command: games[key] };
}

const standaloneCommands = Object.fromEntries(
  options
    .filter((option) => option.name !== "vtv")
    .map((option) => {
      const key = option.name;
      const gameKey = MAINTENANCE_KEYS[key] || key;
      const command = games[key];
      const route = (interaction) => ({
        subcommand: undefined,
        optionNames: key === "domin" ? { min: "somin" } : {},
      });
      return [
        key,
        {
          data: commandData(key, option.description, option.options || []),
          async execute(interaction) {
            const {
              isGameMaintenance,
              GAME_LABELS,
            } = require("../services/gameChannelService");
            if (isGameMaintenance(interaction.guildId, gameKey))
              return interaction.reply({
                content: `🔴 **${GAME_LABELS[gameKey]}** đang bảo trì. Hãy quay lại khi quản trị mở game.`,
                flags: MessageFlags.Ephemeral,
              });
            return command.execute(
              remapOptions(interaction, route(interaction)),
            );
          },
          autocomplete(interaction) {
            return command.autocomplete?.(
              remapOptions(interaction, route(interaction)),
            );
          },
        },
      ];
    }),
);

module.exports = {
  standaloneCommands,
  data: commandData("choi", "Chọn và chơi tất cả game của bot", options),
  async execute(interaction) {
    const key = GAME_ALIASES[selected(interaction)] || selected(interaction);
    const gameKey = MAINTENANCE_KEYS[key] || key;
    const {
      isGameMaintenance,
      GAME_LABELS,
    } = require("../services/gameChannelService");
    if (isGameMaintenance(interaction.guildId, gameKey))
      return interaction.reply({
        content: `🔴 **${GAME_LABELS[gameKey]}** đang bảo trì. Hãy quay lại khi quản trị mở game.`,
        flags: MessageFlags.Ephemeral,
      });
    const route = delegated(interaction);
    if (
      selected(interaction) === "vtv" &&
      !require("./vuatiengviet").isAdmin(interaction)
    ) {
      return interaction.reply({
        content: "Chỉ admin mới được bắt đầu phiên Vua tiếng Việt.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return route.command.execute(remapOptions(interaction, route));
  },
};

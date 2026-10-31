const { normalizeSearch } = require("../utils/text");
const { handleSlashPrefix, messageInteraction } = require("./slashPrefixService");
const baucua = require("../commands/baucua");
const taixiu = require("../commands/taixiu");
const blackjack = require("../commands/blackjack");
const poker = require("../commands/poker");
const duangua = require("../commands/duangua");
const mines = require("../commands/mines");
const vuatiengviet = require("../commands/vuatiengviet");
const trochoi = require("../commands/trochoi");
const { PermissionFlagsBits } = require("discord.js");
const {
  REWARD_GAMES,
  setGameReward,
  listGameRewards,
} = require("./gameRewardService");
const { formatCoins } = require("../utils/economy");
const {
  BET_GAMES,
  setGameBetLimit,
  listGameBetLimits,
} = require("./gameBetLimitService");

const COMMANDS = {
  baucua,
  taixiu,
  blackjack,
  poker,
  duangua,
  mines,
  vuatiengviet,
  trochoi,
};
const NAME_ALIASES = {
  vua: "vuatiengviet",
  vtv: "vuatiengviet",
  vutiengviet: "vuatiengviet",
  xidach: "blackjack",
  xi_dach: "blackjack",
  domin: "mines",
  huongdan: "trochoi",
  games: "trochoi",
  gamehelp: "trochoi",
  datthuong: "setreward",
  xemthuong: "rewards",
  datgioihan: "setmaxbet",
  xemgioihan: "maxbets",
};
const SUB_ALIASES = {
  start: "batdau",
  batdau: "batdau",
  skip: "boqua",
  boqua: "boqua",
  end: "ketthuc",
  ketthuc: "ketthuc",
};
const REWARD_LABELS = { vuatiengviet: "Vua tiếng Việt" };
const BET_LABELS = {
  baucua: "Bầu cua",
  taixiu: "Tài xỉu",
  blackjack: "Xì dách",
  poker: "Poker",
  duangua: "Đua ngựa",
  mines: "Mines",
};

function isAdmin(message) {
  const ids = String(process.env.ADMIN_USER_ID || "")
    .split(/[,;\n]/)
    .map((id) => id.trim())
    .filter(Boolean);
  return (
    ids.includes(message.author.id) ||
    message.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function help(prefix, command) {
  if (command === "blackjack")
    return `Cách dùng: \`${prefix}xidach <số xu> [bot|nguoichoi]\` — mặc định chơi với nhà cái bot; \`nguoichoi\` mở bàn làm nhà cái cho tối đa 3 người`;
  if (command === "poker")
    return `Cách dùng: \`${prefix}poker <texas|sixplus|pineapple|omaha> [bot|banbe]\``;
  if (command === "mines")
    return `Cách dùng: \`${prefix}domin <số xu> <số mìn 2–7>\``;
  if (command === "vuatiengviet")
    return `Cách dùng: \`${prefix}vtv <batdau|boqua|ketthuc>\``;
  return `Cách dùng: \`${prefix}${command}\``;
}

async function handleGamePrefix(message) {
  if (!message.guildId || message.author?.bot) return false;
  if (await handleSlashPrefix(message)) return true;
  const prefix = process.env.COMMAND_PREFIX || "!";
  const content = String(message.content || "").trim();
  if (!content.startsWith(prefix)) return false;
  const parts = content.slice(prefix.length).trim().split(/\s+/);
  let name = normalizeSearch(parts.shift() || "").replace(/\s/g, "");
  name = NAME_ALIASES[name] || name;
  if (name === "setreward") {
    if (!isAdmin(message)) {
      await message.reply({
        content: "Chỉ admin mới được thay đổi phần thưởng game.",
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    let game = normalizeSearch(parts[0] || "").replace(/\s/g, "");
    game = NAME_ALIASES[game] || game;
    const reward = Number(parts[1]);
    if (
      !REWARD_GAMES.includes(game) ||
      !Number.isSafeInteger(reward) ||
      reward < 0 ||
      reward > 100_000
    ) {
      await message.reply({
        content: `Cách dùng: \`${prefix}datthuong vuatiengviet <0–100000>\``,
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    setGameReward(message.guildId, game, reward);
    await message.reply({
      content: `✅ Phần thưởng **${REWARD_LABELS[game]}** đã đặt thành **${formatCoins(reward)} :coin:**.`,
      allowedMentions: { repliedUser: false },
    });
    return true;
  }
  if (name === "rewards") {
    const content = listGameRewards(message.guildId)
      .map(
        (item) =>
          `**${REWARD_LABELS[item.game]}:** ${formatCoins(item.reward)} :coin:`,
      )
      .join("\n");
    await message.reply({ content, allowedMentions: { repliedUser: false } });
    return true;
  }
  if (name === "setmaxbet") {
    if (!isAdmin(message)) {
      await message.reply({
        content: "Chỉ admin mới được thay đổi giới hạn cược.",
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    let game = normalizeSearch(parts[0] || "").replace(/\s/g, "");
    game = NAME_ALIASES[game] || game;
    const maxBet = Number(parts[1]);
    if (
      !BET_GAMES.includes(game) ||
      !Number.isSafeInteger(maxBet) ||
      maxBet < 10 ||
      maxBet > 100_000
    ) {
      await message.reply({
        content: `Cách dùng: \`${prefix}datgioihan <game> <10–100000>\``,
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    setGameBetLimit(message.guildId, game, maxBet);
    await message.reply({
      content: `✅ Giới hạn cược **${BET_LABELS[game]}** là **${formatCoins(maxBet)} :coin:/người/ván**.`,
      allowedMentions: { repliedUser: false },
    });
    return true;
  }
  if (name === "maxbets") {
    const content = listGameBetLimits(message.guildId)
      .map(
        (item) =>
          `**${BET_LABELS[item.game]}:** ${formatCoins(item.maxBet)} :coin:/người/ván`,
      )
      .join("\n");
    await message.reply({ content, allowedMentions: { repliedUser: false } });
    return true;
  }
  let command = COMMANDS[name];
  if (!command) return false;

  let options = {};
  if (name === "blackjack") {
    const ante = Number(parts[0]);
    const mode = normalizeSearch(parts[1] || "bot");
    if (
      parts.length > 2 ||
      !Number.isSafeInteger(ante) ||
      !["bot", "banbe", "nguoichoi"].includes(mode)
    ) {
      await message.reply({
        content: help(prefix, name),
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    options = {
      integers: { ante },
      strings: { chedochoi: mode === "bot" ? "bot" : "nguoichoi" },
    };
  } else if (name === "poker") {
    const variant = normalizeSearch(parts[0] || "").replace("+", "plus");
    const mode = normalizeSearch(parts[1] || "bot");
    if (
      !["texas", "sixplus", "pineapple", "omaha"].includes(variant) ||
      !["bot", "banbe", "nguoichoi"].includes(mode)
    ) {
      await message.reply({
        content: help(prefix, name),
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    options = {
      strings: {
        chedo: variant,
        chedochoi: mode === "bot" ? "bot" : "nguoichoi",
      },
    };
  } else if (name === "mines") {
    const amount = Number(parts[0]);
    const mineCount = Number(parts[1]);
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(mineCount)) {
      await message.reply({
        content: help(prefix, name),
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    options = { integers: { xu: amount, min: mineCount } };
  } else if (name === "vuatiengviet") {
    const rawSubcommand = normalizeSearch(parts[0] || "batdau").replace(
      /\s/g,
      "",
    );
    const subcommand = SUB_ALIASES[rawSubcommand];
    if (!subcommand) {
      await message.reply({
        content: help(prefix, name),
        allowedMentions: { repliedUser: false },
      });
      return true;
    }
    options = { subcommand };
    if (subcommand !== "batdau") command = vuatiengviet.playerCommand;
  }

  await command.execute(messageInteraction(message, options));
  return true;
}

module.exports = { handleGamePrefix, messageInteraction };

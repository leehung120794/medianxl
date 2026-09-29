const { normalizeSearch } = require('../utils/text');
const baucua = require('../commands/baucua');
const taixiu = require('../commands/taixiu');
const oantuti = require('../commands/oantuti');
const blackjack = require('../commands/blackjack');
const duangua = require('../commands/duangua');
const mines = require('../commands/mines');
const hardcore = require('../commands/hardcore');
const noitu = require('../commands/noitu');
const vuatiengviet = require('../commands/vuatiengviet');
const doanitem = require('../commands/doanitem');
const trochoi = require('../commands/trochoi');
const item = require('../commands/item');
const { PermissionFlagsBits } = require('discord.js');
const { REWARD_GAMES, setGameReward, listGameRewards } = require('./gameRewardService');
const { formatCoins } = require('../utils/economy');
const { BET_GAMES, setGameBetLimit, listGameBetLimits } = require('./gameBetLimitService');

const COMMANDS = { baucua, taixiu, oantuti, blackjack, duangua, mines, hardcore, noitu, vuatiengviet, doanitem, trochoi, item };
const NAME_ALIASES = { vua: 'vuatiengviet', xidach: 'blackjack', xi_dach: 'blackjack', hc: 'hardcore', doanruneword: 'doanitem', doanrw: 'doanitem', itemquiz: 'doanitem', rwquiz: 'doanitem', games: 'trochoi', gamehelp: 'trochoi', items: 'item' };
const SUB_ALIASES = { start: 'batdau', batdau: 'batdau', skip: 'boqua', boqua: 'boqua', end: 'ketthuc', ketthuc: 'ketthuc', baotu: 'baotu', choduyet: 'choduyet', duyet: 'duyet', tuchoi: 'tuchoi', themtu: 'themtu', xoatu: 'xoatu', tudien: 'tudien' };
const REWARD_LABELS = { noitu: 'Nối từ', vuatiengviet: 'Vua tiếng Việt', doanitem: 'Đoán item & runeword' };
const BET_LABELS = { baucua: 'Bầu cua', taixiu: 'Tài xỉu', oantuti: 'Oẳn tù tì', blackjack: 'Blackjack', duangua: 'Đua ngựa', mines: 'Mines', hardcore: 'Hardcore Run' };

function isAdmin(message) {
  const ids = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  return ids.includes(message.author.id) || message.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function messageInteraction(message, options = {}) {
  const interaction = {
    guildId: message.guildId,
    channelId: message.channelId,
    guild: message.guild,
    client: message.client,
    user: message.author,
    memberPermissions: message.member?.permissions,
    replied: false,
    deferred: false,
    options: {
      getSubcommand: () => options.subcommand,
      getString: (name, required = false) => options.strings?.[name] ?? (required ? '' : null),
      getInteger: (name, required = false) => options.integers?.[name] ?? (required ? 0 : null),
      getUser: name => options.users?.[name] || null,
    },
    async reply(payload) {
      const clean = { ...payload };
      delete clean.flags;
      delete clean.withResponse;
      this.replied = true;
      const sent = await message.reply(clean);
      return { resource: { message: sent } };
    },
    async followUp(payload) {
      const clean = { ...payload };
      delete clean.flags;
      return message.reply(clean);
    },
  };
  return interaction;
}

function help(prefix, command) {
  if (command === 'item') return `Cách dùng: \`${prefix}item [TU|SU|RW|SET|UMO|CYCLE|RELIC|TROPHY] <tên hoặc stat>\``;
  if (command === 'oantuti') return `Cách dùng: \`${prefix}oantuti <bua|keo|bao> <số xu>\``;
  if (command === 'blackjack') return `Cách dùng: \`${prefix}blackjack <số xu>\``;
  if (command === 'mines') return `Cách dùng: \`${prefix}mines <số xu> <số mìn 1–7>\``;
  if (command === 'hardcore') return `Cách dùng: \`${prefix}hardcore <số xu> <barbarian|assassin|sorceress>\` hoặc \`${prefix}hardcore <hoso|top|rates>\``;
  if (command === 'noitu') return `Cách dùng: \`${prefix}noitu <batdau|boqua|baotu <cụm từ>|tudien [trang]|ketthuc>\``;
  if (['vuatiengviet', 'doanitem'].includes(command)) return `Cách dùng: \`${prefix}${command} <batdau|boqua|ketthuc>\``;
  return `Cách dùng: \`${prefix}${command}\``;
}

async function handleGamePrefix(message) {
  if (!message.guildId || message.author?.bot) return false;
  const prefix = process.env.COMMAND_PREFIX || '!';
  const content = String(message.content || '').trim();
  if (!content.startsWith(prefix)) return false;
  const parts = content.slice(prefix.length).trim().split(/\s+/);
  let name = normalizeSearch(parts.shift() || '').replace(/\s/g, '');
  name = NAME_ALIASES[name] || name;
  if (name === 'setreward') {
    if (!isAdmin(message)) {
      await message.reply({ content: 'Chỉ admin mới được thay đổi phần thưởng game.', allowedMentions: { repliedUser: false } });
      return true;
    }
    let game = normalizeSearch(parts[0] || '').replace(/\s/g, '');
    game = NAME_ALIASES[game] || game;
    const reward = Number(parts[1]);
    if (!REWARD_GAMES.includes(game) || !Number.isSafeInteger(reward) || reward < 0 || reward > 100_000) {
      await message.reply({ content: `Cách dùng: \`${prefix}setreward <noitu|vuatiengviet|doanitem> <0–100000>\``, allowedMentions: { repliedUser: false } });
      return true;
    }
    setGameReward(message.guildId, game, reward);
    await message.reply({ content: `✅ Phần thưởng **${REWARD_LABELS[game]}** đã đặt thành **${formatCoins(reward)} xu**.`, allowedMentions: { repliedUser: false } });
    return true;
  }
  if (name === 'rewards') {
    const content = listGameRewards(message.guildId).map(item => `**${REWARD_LABELS[item.game]}:** ${formatCoins(item.reward)} xu`).join('\n');
    await message.reply({ content, allowedMentions: { repliedUser: false } });
    return true;
  }
  if (name === 'setmaxbet') {
    if (!isAdmin(message)) {
      await message.reply({ content: 'Chỉ admin mới được thay đổi giới hạn cược.', allowedMentions: { repliedUser: false } });
      return true;
    }
    let game = normalizeSearch(parts[0] || '').replace(/\s/g, '');
    game = NAME_ALIASES[game] || game;
    const maxBet = Number(parts[1]);
    if (!BET_GAMES.includes(game) || !Number.isSafeInteger(maxBet) || maxBet < 10 || maxBet > 100_000) {
      await message.reply({ content: `Cách dùng: \`${prefix}setmaxbet <${BET_GAMES.join('|')}> <10–100000>\``, allowedMentions: { repliedUser: false } });
      return true;
    }
    setGameBetLimit(message.guildId, game, maxBet);
    await message.reply({ content: `✅ Giới hạn cược **${BET_LABELS[game]}** là **${formatCoins(maxBet)} xu/người/ván**.`, allowedMentions: { repliedUser: false } });
    return true;
  }
  if (name === 'maxbets') {
    const content = listGameBetLimits(message.guildId).map(item => `**${BET_LABELS[item.game]}:** ${formatCoins(item.maxBet)} xu/người/ván`).join('\n');
    await message.reply({ content, allowedMentions: { repliedUser: false } });
    return true;
  }
  const command = COMMANDS[name];
  if (!command) return false;

  let options = {};
  if (name === 'item') {
    const types = new Set(['ALL', 'TU', 'SU', 'RW', 'SET', 'UMO', 'CYCLE', 'RELIC', 'TROPHY']);
    const possibleType = String(parts[0] || '').toUpperCase();
    const type = types.has(possibleType) ? possibleType : 'ALL';
    if (type !== 'ALL') parts.shift();
    const query = parts.join(' ').trim();
    if (!query) {
      await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
      return true;
    }
    options = { strings: { query, type } };
  } else if (name === 'oantuti') {
    const choice = normalizeSearch(parts[0] || '');
    const amount = Number(parts[1]);
    if (!['bua', 'keo', 'bao'].includes(choice) || !Number.isSafeInteger(amount)) {
      await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
      return true;
    }
    options = { strings: { chon: choice }, integers: { xu: amount } };
  } else if (name === 'blackjack') {
    const amount = Number(parts[0]);
    if (!Number.isSafeInteger(amount)) {
      await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
      return true;
    }
    options = { integers: { xu: amount } };
  } else if (name === 'mines') {
    const amount = Number(parts[0]);
    const mineCount = Number(parts[1]);
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(mineCount)) {
      await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
      return true;
    }
    options = { integers: { xu: amount, min: mineCount } };
  } else if (name === 'hardcore') {
    const first = normalizeSearch(parts[0] || '');
    if (['hoso', 'profile', 'top', 'rates', 'tyle'].includes(first)) {
      const subcommand = first === 'profile' ? 'hoso' : first === 'tyle' ? 'rates' : first;
      options = { subcommand };
    } else {
      const amount = Number(parts[0]);
      const classKey = normalizeSearch(parts[1] || '');
      if (!Number.isSafeInteger(amount) || !['barbarian', 'assassin', 'sorceress'].includes(classKey)) {
        await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
        return true;
      }
      options = { subcommand: 'batdau', integers: { xu: amount }, strings: { class: classKey } };
    }
  } else if (['noitu', 'vuatiengviet', 'doanitem'].includes(name)) {
    const rawSubcommand = normalizeSearch(parts[0] || 'batdau').replace(/\s/g, '');
    const subcommand = SUB_ALIASES[rawSubcommand];
    if (!subcommand) {
      await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
      return true;
    }
    if (name === 'noitu' && ['baotu', 'themtu', 'xoatu'].includes(subcommand)) {
      const phrase = parts.slice(1).join(' ').trim();
      if (!phrase) {
        await message.reply({ content: help(prefix, name), allowedMentions: { repliedUser: false } });
        return true;
      }
      options = { subcommand, strings: { tu: phrase } };
    } else if (name === 'noitu' && subcommand === 'tudien') {
      const page = parts[1] === undefined ? 1 : Number(parts[1]);
      if (!Number.isSafeInteger(page) || page < 1) {
        await message.reply({ content: `Cách dùng: \`${prefix}noitu tudien [trang]\``, allowedMentions: { repliedUser: false } });
        return true;
      }
      options = { subcommand, integers: { trang: page } };
    } else if (name === 'noitu' && ['duyet', 'tuchoi'].includes(subcommand)) {
      const id = Number(parts[1]);
      if (!Number.isSafeInteger(id) || id < 1) {
        await message.reply({ content: `Cách dùng: \`${prefix}noitu ${subcommand} <id>\``, allowedMentions: { repliedUser: false } });
        return true;
      }
      options = { subcommand, integers: { id } };
    } else options = { subcommand };
  }

  await command.execute(messageInteraction(message, options));
  return true;
}

module.exports = { handleGamePrefix, messageInteraction };

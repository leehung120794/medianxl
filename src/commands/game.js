const { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { GAMES, setGameChannel, listGameChannels } = require('../services/gameChannelService');
const { REWARD_GAMES, setGameReward, listGameRewards } = require('../services/gameRewardService');
const { formatCoins } = require('../utils/economy');
const { BET_GAMES, setGameBetLimit, listGameBetLimits } = require('../services/gameBetLimitService');

const LABELS = { noitu: 'Nối từ', baucua: 'Bầu cua', oantuti: 'Oẳn tù tì', taixiu: 'Tài xỉu', blackjack: 'Blackjack', duangua: 'Đua ngựa', mines: 'Mines', hardcore: 'Hardcore Run', vuatiengviet: 'Vua tiếng Việt', doanitem: 'Đoán item & runeword' };
const choices = GAMES.map(game => ({ name: LABELS[game], value: game }));
const rewardChoices = REWARD_GAMES.map(game => ({ name: LABELS[game], value: game }));
const betChoices = BET_GAMES.map(game => ({ name: LABELS[game], value: game }));

function isAdmin(interaction) {
  const ids = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  return ids.includes(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  data: new SlashCommandBuilder().setName('game').setDescription('Thiết lập channel riêng cho các game')
    .addSubcommand(command => command.setName('setup').setDescription('Chọn channel cho một game')
      .addStringOption(option => option.setName('trochoi').setDescription('Trò chơi').setRequired(true).addChoices(...choices))
      .addChannelOption(option => option.setName('channel').setDescription('Channel dành riêng cho game').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(command => command.setName('channels').setDescription('Xem channel đã thiết lập'))
    .addSubcommand(command => command.setName('reward').setDescription('Đặt phần thưởng xu cho một game')
      .addStringOption(option => option.setName('trochoi').setDescription('Game có thưởng cố định').setRequired(true).addChoices(...rewardChoices))
      .addIntegerOption(option => option.setName('xu').setDescription('Số xu thưởng (0–100.000)').setRequired(true).setMinValue(0).setMaxValue(100000)))
    .addSubcommand(command => command.setName('rewards').setDescription('Xem phần thưởng của từng game'))
    .addSubcommand(command => command.setName('maxbet').setDescription('Đặt giới hạn cược tối đa cho một game')
      .addStringOption(option => option.setName('trochoi').setDescription('Game đặt cược').setRequired(true).addChoices(...betChoices))
      .addIntegerOption(option => option.setName('xu').setDescription('Giới hạn mỗi người/ván (10–100.000)').setRequired(true).setMinValue(10).setMaxValue(100000)))
    .addSubcommand(command => command.setName('maxbets').setDescription('Xem giới hạn cược của các game')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng được trong server.', flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được thiết lập channel game.', flags: MessageFlags.Ephemeral });
      const game = interaction.options.getString('trochoi', true);
      const channel = interaction.options.getChannel('channel', true);
      try { setGameChannel(interaction.guildId, game, channel.id); }
      catch (error) {
        if (error.message === 'CHANNEL_IN_USE') return interaction.reply({ content: `Channel này đã dành cho **${LABELS[error.game]}**. Mỗi game phải dùng một channel khác nhau.`, flags: MessageFlags.Ephemeral });
        throw error;
      }
      return interaction.reply({ content: `✅ Đã đặt <#${channel.id}> làm channel riêng cho **${LABELS[game]}**.`, flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'reward') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được thay đổi phần thưởng game.', flags: MessageFlags.Ephemeral });
      const game = interaction.options.getString('trochoi', true);
      const reward = interaction.options.getInteger('xu', true);
      setGameReward(interaction.guildId, game, reward);
      return interaction.reply({ content: `✅ Phần thưởng **${LABELS[game]}** đã đặt thành **${formatCoins(reward)} xu** mỗi đáp án đúng.`, flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'rewards') {
      const description = listGameRewards(interaction.guildId).map(item => `**${LABELS[item.game]}:** ${formatCoins(item.reward)} xu`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle('💰 PHẦN THƯỞNG GAME').setDescription(description)], flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'maxbet') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được thay đổi giới hạn cược.', flags: MessageFlags.Ephemeral });
      const game = interaction.options.getString('trochoi', true);
      const maxBet = interaction.options.getInteger('xu', true);
      setGameBetLimit(interaction.guildId, game, maxBet);
      return interaction.reply({ content: `✅ Giới hạn cược của **${LABELS[game]}** là **${formatCoins(maxBet)} xu/người/ván**.`, flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'maxbets') {
      const description = listGameBetLimits(interaction.guildId).map(item => `**${LABELS[item.game]}:** ${formatCoins(item.maxBet)} xu/người/ván`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xE67E22).setTitle('🎚️ GIỚI HẠN CƯỢC').setDescription(description)], flags: MessageFlags.Ephemeral });
    }
    const settings = new Map(listGameChannels(interaction.guildId).map(row => [row.game, row.channel_id]));
    const description = GAMES.map(game => `**${LABELS[game]}:** ${settings.has(game) ? `<#${settings.get(game)}>` : 'Chưa thiết lập'}`).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎮 CHANNEL TRÒ CHƠI').setDescription(description)], flags: MessageFlags.Ephemeral });
  },
};

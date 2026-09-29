const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { requireGameChannel } = require('../utils/gameChannel');
const { economyError, formatCoins } = require('../utils/economy');
const { MIN_BET, MAX_BET, startBlackjack, setMessageId, blackjackEmbed, actionRows } = require('../services/blackjackService');

module.exports = {
  data: new SlashCommandBuilder().setName('blackjack').setDescription('Chơi Blackjack với dealer')
    .addIntegerOption(option => option.setName('xu').setDescription(`Số xu cược (${MIN_BET}–${MAX_BET})`).setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Game chỉ chơi được trong server.', flags: MessageFlags.Ephemeral });
    if (!await requireGameChannel(interaction, 'blackjack')) return;
    const stake = interaction.options.getInteger('xu', true);
    let started;
    try { started = startBlackjack({ guildId: interaction.guildId, userId: interaction.user.id, channelId: interaction.channelId, stake }); }
    catch (error) {
      if (error.message === 'ACTIVE_SESSION') return interaction.reply({ content: 'Bạn đang có một ván Blackjack chưa kết thúc trong server này.', flags: MessageFlags.Ephemeral });
      if (error.message === 'BET_LIMIT') return interaction.reply({ content: `Giới hạn cược Blackjack của server là **${formatCoins(error.maxBet)} xu**.`, flags: MessageFlags.Ephemeral });
      return economyError(interaction, error);
    }
    const result = started.immediate ? started.result : null;
    const response = await interaction.reply({ embeds: [blackjackEmbed(started.state, interaction.user.id, result)], components: started.immediate ? [] : actionRows(started.session.id, started.state), withResponse: true });
    const message = response?.resource?.message;
    if (message?.id && started.session) setMessageId(started.session.id, message.id);
    return started;
  },
};

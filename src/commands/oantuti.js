const crypto = require('node:crypto');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { settleBet } = require('../services/economyService');
const { consumeCommandCooldown } = require('../services/funGameService');
const { formatCoins, economyError } = require('../utils/economy');
const { requireGameChannel } = require('../utils/gameChannel');
const { randomLossTaunt } = require('../services/lossTauntService');
const { getGameBetLimit } = require('../services/gameBetLimitService');
const { insuredRefund } = require('../services/effectStateService');

const HANDS = {
  bua: { label: 'Búa', emoji: '✊', beats: 'keo' },
  keo: { label: 'Kéo', emoji: '✌️', beats: 'bao' },
  bao: { label: 'Bao', emoji: '✋', beats: 'bua' },
};

module.exports = {
  data: new SlashCommandBuilder().setName('oantuti').setDescription('Chơi oẳn tù tì bằng xu')
    .addStringOption(option => option.setName('chon').setDescription('Lựa chọn của bạn').setRequired(true).addChoices(
      { name: 'Búa', value: 'bua' }, { name: 'Kéo', value: 'keo' }, { name: 'Bao', value: 'bao' },
    ))
    .addIntegerOption(option => option.setName('xu').setDescription('Số xu cược (10–100.000)').setRequired(true).setMinValue(10).setMaxValue(100000)),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Game chỉ chơi được trong server.', flags: MessageFlags.Ephemeral });
    if (!await requireGameChannel(interaction, 'oantuti')) return;
    const remaining = consumeCommandCooldown(interaction.guildId, interaction.user.id, 'oantuti');
    if (remaining) return interaction.reply({ content: `Hãy chờ ${Math.ceil(remaining / 1000)} giây trước khi chơi tiếp.`, flags: MessageFlags.Ephemeral });
    const choice = interaction.options.getString('chon', true);
    const stake = interaction.options.getInteger('xu', true);
    const maxBet = getGameBetLimit(interaction.guildId, 'oantuti');
    if (stake > maxBet) return interaction.reply({ content: `Giới hạn cược Oẳn tù tì của server là **${formatCoins(maxBet)} xu**.`, flags: MessageFlags.Ephemeral });
    const botChoice = Object.keys(HANDS)[crypto.randomInt(3)];
    const outcome = choice === botChoice ? 'draw' : HANDS[choice].beats === botChoice ? 'win' : 'loss';
    let payout = outcome === 'win' ? stake * 2 : outcome === 'draw' ? stake : 0;
    const insurance = outcome === 'loss' ? insuredRefund(interaction.guildId, interaction.user.id, stake) : 0;
    payout += insurance;
    let account;
    try { account = settleBet({ guildId: interaction.guildId, userId: interaction.user.id, stake, payout, game: 'oantuti', outcome }); }
    catch (error) { return economyError(interaction, error); }
    const result = outcome === 'win' ? `🎉 Bạn thắng **${formatCoins(stake)} xu**!` : outcome === 'draw' ? '🤝 Hòa, bạn được hoàn lại tiền cược.' : `💥 Bạn thua **${formatCoins(stake)} xu**.${insurance ? `\n🛡️ Bảo hiểm hoàn **${formatCoins(insurance)} xu**.` : ''}\n😏 ${randomLossTaunt()}`;
    const embed = new EmbedBuilder().setColor(outcome === 'win' ? 0x2ECC71 : outcome === 'draw' ? 0xF1C40F : 0xE74C3C)
      .setTitle('✊ OẲN TÙ TÌ ✋')
      .setDescription(`Bạn chọn: ${HANDS[choice].emoji} **${HANDS[choice].label}**\nBot chọn: ${HANDS[botChoice].emoji} **${HANDS[botChoice].label}**\n\n${result}`)
      .setFooter({ text: `Số dư: ${formatCoins(account.balance)} xu` });
    return interaction.reply({ embeds: [embed] });
  },
};

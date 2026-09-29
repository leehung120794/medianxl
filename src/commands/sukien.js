const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getBoss, claimBossReward } = require('../services/progressionService');
const { formatCoins } = require('../utils/economy');

module.exports = {
  data: new SlashCommandBuilder().setName('sukien').setDescription('Boss cộng đồng hằng tuần')
    .addSubcommand(command => command.setName('boss').setDescription('Xem boss và đóng góp của server'))
    .addSubcommand(command => command.setName('nhan').setDescription('Nhận quà sau khi boss bị hạ')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    if (interaction.options.getSubcommand() === 'nhan') {
      try {
        const reward = claimBossReward(interaction.guildId, interaction.user.id);
        return interaction.reply({ content: `🏆 Bạn đã gây **${reward.damage} sát thương** và nhận **${formatCoins(reward.coins)} xu + 1 Hòm Sanctuary**.` });
      } catch (error) {
        const message = error.message === 'BOSS_ALIVE' ? 'Boss vẫn còn sống.' : error.message === 'NO_CONTRIBUTION' ? 'Bạn chưa gây sát thương cho boss tuần này.' : 'Bạn đã nhận phần thưởng boss.';
        return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      }
    }
    const boss = getBoss(interaction.guildId, interaction.user.id);
    const percent = Math.max(0, Math.round(boss.hp / boss.max_hp * 100));
    const bar = `${'█'.repeat(Math.round(percent / 10))}${'░'.repeat(10 - Math.round(percent / 10))}`;
    const leaders = boss.leaders.length ? boss.leaders.map((row, i) => `${i + 1}. <@${row.user_id}> — **${row.damage} damage**`).join('\n') : 'Chưa có ai gây sát thương.';
    const embed = new EmbedBuilder().setColor(boss.hp ? 0xC0392B : 0x2ECC71).setTitle(`⚔️ BOSS TUẦN · ${boss.boss_name}`)
      .setDescription(`${bar} **${boss.hp}/${boss.max_hp} HP**\n\nThắng bất kỳ game nào sẽ tự gây sát thương. Phần thưởng khi hạ boss: **100.000 xu + Hòm Sanctuary**.`)
      .addFields({ name: 'Top sát thương', value: leaders }, { name: 'Đóng góp của bạn', value: `**${boss.own?.damage || 0} damage**`, inline: true })
      .setFooter({ text: boss.hp ? `Tuần bắt đầu ${boss.event_key}` : 'Boss đã bị hạ · dùng /sukien nhan' }).setTimestamp();
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

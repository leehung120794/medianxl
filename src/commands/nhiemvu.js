const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getProgress, claimMissions, checkIn } = require('../services/progressionService');
const { formatCoins } = require('../utils/economy');

function missionLine(mission) {
  const mark = mission.claimed ? '✅' : mission.complete ? '🎁' : '▫️';
  const reward = mission.coins ? `${formatCoins(mission.coins)} xu` : `×${mission.quantity || 1} vật phẩm`;
  return `${mark} **${mission.label}** — ${mission.progress}/${mission.target}\n↳ ${reward}${mission.complete && !mission.claimed ? ' · có thể nhận' : ''}`;
}
module.exports = {
  data: new SlashCommandBuilder().setName('nhiemvu').setDescription('Nhiệm vụ, điểm danh và phần thưởng hoạt động')
    .addSubcommand(command => command.setName('xem').setDescription('Xem nhiệm vụ ngày và tuần'))
    .addSubcommand(command => command.setName('nhan').setDescription('Nhận tất cả phần thưởng đã hoàn thành'))
    .addSubcommand(command => command.setName('diemdanh').setDescription('Điểm danh hằng ngày')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'diemdanh') {
      const result = checkIn(interaction.guildId, interaction.user.id);
      if (!result.ok) return interaction.reply({ content: `Bạn đã điểm danh hôm nay. Chuỗi hiện tại: **${result.streak} ngày**.`, flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: `📅 Điểm danh ngày **${result.streak}/7**: nhận **${formatCoins(result.coins)} xu**${result.item ? ' và **1 Hòm Sanctuary**' : ''}.${result.guarded ? '\n🛡️ Thẻ Giữ Chuỗi đã tự động cứu chuỗi điểm danh.' : ''}` });
    }
    if (sub === 'nhan') {
      const rewards = claimMissions(interaction.guildId, interaction.user.id);
      if (!rewards.length) return interaction.reply({ content: 'Chưa có nhiệm vụ hoàn thành chưa nhận thưởng.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: `🎁 Đã nhận **${rewards.length}** phần thưởng:\n${rewards.map(item => `• ${item.label}: ${item.coins ? `${formatCoins(item.coins)} xu` : `×${item.quantity || 1} vật phẩm`}`).join('\n')}` });
    }
    const progress = getProgress(interaction.guildId, interaction.user.id);
    const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('📜 NHIỆM VỤ')
      .setDescription(`Chuỗi điểm danh: **${progress.streak}/7 ngày**\nTiến độ tự tăng khi chơi các game của bot.`)
      .addFields(
        { name: `Hằng ngày · ${progress.dailyKey}`, value: progress.daily.map(missionLine).join('\n') },
        { name: `Hằng tuần · từ ${progress.weeklyKey}`, value: progress.weekly.map(missionLine).join('\n') },
      ).setFooter({ text: 'Dùng /nhiemvu nhan để nhận tất cả phần thưởng' }).setTimestamp();
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getStatus } = require('../services/monitoringService');
const { countItems } = require('../db');

module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('Xem trạng thái database và lần đồng bộ gần nhất'),
  async execute(interaction) {
    const admins = (process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
    if (admins.length && !admins.includes(interaction.user.id)) return interaction.reply({ content: 'Bạn không có quyền xem trạng thái database.', flags: MessageFlags.Ephemeral });
    const snapshot = getStatus();
    const last = snapshot.status;
    const counts = countItems().map(x => `${x.type_code}: ${x.count}`).join(' · ') || 'Database trống';
    const report = last?.report?.map(x => `${x.ok ? 'OK' : 'ERROR'} ${x.slug}: ${x.ok ? x.count : x.error}`).join('\n') || 'Chưa có lần sync nào được ghi nhận.';
    const embed = new EmbedBuilder().setColor(last?.report?.some(x => !x.ok) ? 0xE74C3C : 0x2ECC71).setTitle('Median XL Bot · Status').addFields({ name: 'Lần sync gần nhất', value: last?.syncedAt || 'Chưa có dữ liệu' }, { name: 'Số bản ghi hiện tại', value: counts }, { name: 'Chi tiết nguồn', value: report.slice(0, 1024) }).setFooter({ text: 'Log chi tiết được lưu trong logs/events.jsonl' }).setTimestamp();
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

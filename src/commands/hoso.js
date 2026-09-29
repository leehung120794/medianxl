const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { getAccount, getRank } = require('../services/economyService');
const { getProfileAppearance } = require('../services/profileCosmeticService');
const { renderProfileCard } = require('../services/profileCardService');

function fallbackEmbed(user, account, rank, appearance) {
  const decided = account.wins + account.losses;
  const winRate = decided ? account.wins / decided * 100 : 0;
  return new EmbedBuilder()
    .setColor(Number.parseInt(appearance.color.value.slice(1), 16))
    .setTitle(`${user.globalName || user.username} · #${rank}`)
    .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }))
    .setDescription(`Màu hồ sơ: **${appearance.color.name}**`)
    .addFields(
      { name: 'Số dư', value: `${Number(account.balance).toLocaleString('vi-VN')} xu`, inline: true },
      { name: 'Tổng số ván', value: String(account.games_played), inline: true },
      { name: 'Tỷ lệ thắng', value: `${winRate.toFixed(1)}%`, inline: true },
      { name: 'Thắng / Thua / Hòa', value: `${account.wins} / ${account.losses} / ${account.draws}`, inline: true },
    )
    .setFooter({ text: 'Đang dùng giao diện dự phòng vì máy chủ không dựng được ảnh profile' });
}

module.exports = {
  data: new SlashCommandBuilder().setName('hoso').setDescription('Xem profile game và số xu')
    .addUserOption(option => option.setName('user').setDescription('Người chơi cần xem')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng được trong server.', flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('user') || interaction.user;
    if (user.bot) return interaction.reply({ content: 'Bot không có profile game.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply();
    const account = getAccount(interaction.guildId, user.id);
    const rank = getRank(interaction.guildId, user.id);
    const appearance = getProfileAppearance(interaction.guildId, user.id);
    const displayName = user.globalName || user.username;
    try {
      const image = await renderProfileCard({
        displayName,
        username: user.username,
        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
        account,
        rank,
        appearance,
      });
      const attachment = new AttachmentBuilder(image, { name: `profile-${user.id}.png` });
      const embed = new EmbedBuilder()
        .setColor(Number.parseInt(appearance.color.value.slice(1), 16))
        .setImage(`attachment://profile-${user.id}.png`)
        .setFooter({ text: `Màu hồ sơ: ${appearance.color.name} • Số liệu được lưu riêng trong server này` });
      return interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error('[hoso] profile image render failed', error);
      return interaction.editReply({ embeds: [fallbackEmbed(user, account, rank, appearance)] });
    }
  },
};

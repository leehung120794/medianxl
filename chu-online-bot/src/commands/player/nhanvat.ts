import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRealmById, getStageName } from '../../config/realms.js';
import { getRootById } from '../../config/spiritualRoots.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nhanvat')
    .setDescription('Xem hồ sơ nhân vật của bạn'),

  async execute(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: {
          character: {
            include: {
              spiritualRoot: true,
            },
          },
        },
      });

      if (!user?.character) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Chưa có nhân vật')
          .setDescription('Bạn chưa có nhân vật. Sử dụng lệnh `/batdau` để bắt đầu hành trình tu tiên.')
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const character = user.character;
      const realm = getRealmById(character.realmId);
      const root = getRootById(character.spiritualRootId);
      const stageName = getStageName(character.realmStage);

      // Calculate cultivation progress (simplified for MVP)
      const nextStage = character.realmStage < 9 ? character.realmStage + 1 : 9;
      const requiredCultivation = BigInt(Math.round(100 * Math.pow(1.35, (realm?.order || 1) - 1) * Math.pow(1.22, nextStage - 1)));
      const progress = character.cultivation < requiredCultivation
        ? Number((BigInt(character.cultivation) * BigInt(100) / requiredCultivation))
        : 100;

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle(`📜 Hồ Sơ Nhân Vật - ${character.dharmaName}`)
        .setDescription(
          `**Căn cốt:** ${root?.name} (×${root?.multiplier})\n` +
          `**Cảnh giới:** ${realm?.name} - Tầng ${character.realmStage} (${stageName})\n\n` +
          `**Tài nguyên:**\n` +
          `✨ Tu vi: ${character.cultivation} / ${requiredCultivation}\n` +
          `💎 Linh thạch: ${character.spiritStone}\n` +
          `🙏 Công đức: ${character.merit}\n` +
          `💫 Đạo tâm: ${character.daoHeart}\n\n` +
          `**Thống kê:**\n` +
          `📊 Số lần đột phá: ${character.totalBreakthroughs}\n` +
          `🔄 Số lần đổi căn cốt: ${character.rootChangedCount}`
        )
        .addFields(
          { name: 'Tiến độ tu vi', value: `▓▓▓▓▓▓▓▓▓▓ ${progress}%`, inline: false }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('character:cultivate')
          .setLabel('Tu luyện')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('character:quests')
          .setLabel('Nhiệm vụ')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('character:breakthrough')
          .setLabel('Đột phá')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('character:inventory')
          .setLabel('Túi đồ')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('character:refresh')
          .setLabel('Làm mới')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Lỗi khi xem hồ sơ nhân vật:', error);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Lỗi')
        .setDescription('Có lỗi xảy ra khi xem hồ sơ nhân vật. Vui lòng thử lại sau.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

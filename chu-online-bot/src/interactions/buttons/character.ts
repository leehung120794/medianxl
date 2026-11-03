import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';

export default {
  async execute(interaction: ButtonInteraction, params: string[]) {
    const action = params[0];
    const discordId = interaction.user.id;

    if (action === 'cultivate') {
      // Redirect to cultivation command
      await interaction.update({
        content: 'Sử dụng lệnh `/tuluyen` để bắt đầu tu luyện.',
        components: [],
      });
    } else if (action === 'quests') {
      await interaction.update({
        content: 'Sử dụng lệnh `/nhiemvu` để xem nhiệm vụ.',
        components: [],
      });
    } else if (action === 'breakthrough') {
      await interaction.update({
        content: 'Sử dụng lệnh `/dotpha` để xem điều kiện đột phá.',
        components: [],
      });
    } else if (action === 'inventory') {
      await interaction.update({
        content: 'Sử dụng lệnh `/tuido` để xem túi đồ.',
        components: [],
      });
    } else if (action === 'refresh') {
      // Refresh character info
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: {
          character: {
            include: { spiritualRoot: true },
          },
        },
      });

      if (!user?.character) {
        return interaction.update({
          content: 'Không tìm thấy nhân vật.',
          components: [],
        });
      }

      // Re-import dependencies
      const { getRealmById, getStageName } = await import('../../config/realms.js');
      const { getRootById } = await import('../../config/spiritualRoots.js');

      const character = user.character;
      const realm = getRealmById(character.realmId);
      const root = getRootById(character.spiritualRootId);
      const stageName = getStageName(character.realmStage);

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

      await interaction.update({ embeds: [embed], components: [row] });
    }
  },
};

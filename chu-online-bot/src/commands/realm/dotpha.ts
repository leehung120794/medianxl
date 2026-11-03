import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRealmById, getRealmByOrder, getStageName, calculateRequiredCultivation, getBreakthroughRate } from '../../config/realms.js';
import { getRootById } from '../../config/spiritualRoots.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dotpha')
    .setDescription('Xem điều kiện và thực hiện đột phá cảnh giới'),

  async execute(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: { character: { include: { spiritualRoot: true } } },
      });

      if (!user?.character) {
        return interaction.reply({
          content: 'Bạn chưa có nhân vật. Sử dụng lệnh `/batdau` để bắt đầu.',
          ephemeral: true,
        });
      }

      const character = user.character;
      const currentRealm = getRealmById(character.realmId);
      const root = getRootById(character.spiritualRootId);

      // Determine if minor or major breakthrough
      const isMinorBreakthrough = character.realmStage < 9;
      const nextStage = isMinorBreakthrough ? character.realmStage + 1 : 1;
      const nextRealm = isMinorBreakthrough
        ? currentRealm
        : getRealmByOrder((currentRealm?.order || 1) + 1);

      if (!nextRealm) {
        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🏆 Đã đạt cảnh giới cao nhất')
          .setDescription('Đạo hữu đã đạt đến cảnh giới cao nhất trong thế giới này!')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      const requiredCultivation = calculateRequiredCultivation(nextRealm.order, nextStage);
      const stageName = getStageName(nextStage);
      const breakthroughRate = isMinorBreakthrough ? 100 : getBreakthroughRate(currentRealm.order);

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('⚡ Đột Phá Cảnh Giới')
        .setDescription(
          `**Cảnh giới hiện tại:** ${currentRealm?.name} - Tầng ${character.realmStage} (${getStageName(character.realmStage)})\n` +
          `**Cảnh giới mục tiêu:** ${nextRealm.name} - Tầng ${nextStage} (${stageName})\n\n` +
          `**Yêu cầu:**\n` +
          `✨ Tu vi: ${character.cultivation} / ${requiredCultivation}\n` +
          `💫 Đạo tâm: ${character.daoHeart}\n` +
          `💎 Linh thạch: ${character.spiritStone}\n\n` +
          `**Tỷ lệ thành công:** ${breakthroughRate}%\n\n` +
          isMinorBreakthrough
            ? 'Đây là tiểu đột phá, tỷ lệ thành công 100%.'
            : 'Đây là đại đột phá, thất bại sẽ mất 10% tu vi yêu cầu.'
        )
        .setImage('assets/activities/dot-pha.png')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('breakthrough:attempt')
          .setLabel('Thử đột phá')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('breakthrough:cancel')
          .setLabel('Hủy')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Lỗi khi xem điều kiện đột phá:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

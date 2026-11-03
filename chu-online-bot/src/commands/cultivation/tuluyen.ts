import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { CULTIVATION_DURATIONS } from '../../config/cultivation.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tuluyen')
    .setDescription('Bắt đầu phiên tu luyện'),

  async execute(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });

      if (!user?.character) {
        return interaction.reply({
          content: 'Bạn chưa có nhân vật. Sử dụng lệnh `/batdau` để bắt đầu.',
          ephemeral: true,
        });
      }

      // Check if there's already a running session
      const runningSession = await prisma.cultivationSession.findFirst({
        where: {
          characterId: user.character.id,
          status: 'running',
        },
      });

      if (runningSession) {
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('Đang có phiên tu luyện đang chạy')
          .setDescription(
            `Bạn đang có một phiên tu luyện đang diễn ra.\n` +
            `Thời gian bắt đầu: ${runningSession.startedAt.toLocaleString('vi-VN')}\n` +
            `Thời gian kết thúc: ${runningSession.endsAt.toLocaleString('vi-VN')}\n\n` +
            `Sử dụng lệnh \`/nhantuvi\` để nhận phần thưởng khi phiên hoàn tất.`
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Show duration selection
      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🧘 Tu Luyện')
        .setDescription('Chọn thời gian tu luyện:')
        .addFields(
          CULTIVATION_DURATIONS.map(duration => ({
            name: `${duration.minutes} phút`,
            value: `Thưởng cơ bản: ${duration.baseReward} tu vi`,
            inline: true,
          }))
        )
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cultivation:select_duration')
        .setPlaceholder('Chọn thời gian tu luyện')
        .addOptions(
          CULTIVATION_DURATIONS.map(duration => ({
            label: `${duration.minutes} phút`,
            description: `Thưởng: ${duration.baseReward} tu vi`,
            value: duration.minutes.toString(),
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Lỗi khi mở menu tu luyện:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

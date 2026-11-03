import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { TEMPLE_ACTIVITIES } from '../../config/templeActivities.js';

export default {
  data: new SlashCommandBuilder()
    .setName('chua')
    .setDescription('Mở bản đồ chùa và tham gia hoạt động'),

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

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🏯 Chùa Online - Bản Đồ')
        .setDescription(
          'Chào mừng đạo hữu đến với chùa chúng tôi.\n\n' +
          'Đây là nơi đạo hữu có thể tham gia các hoạt động tu dưỡng,' +
          ' tích lũy công đức và đạo tâm.\n\n' +
          'Chọn một địa điểm để bắt đầu:'
        )
        .addFields(
          { name: 'Chính Điện', value: 'Lễ Phật, nhận công đức', inline: true },
          { name: 'Thiền Đường', value: 'Ngồi thiền, nhận đạo tâm', inline: true },
          { name: 'Vườn Hoa Sen', value: 'Chăm sóc hoa sen', inline: true },
          { name: 'Sân Chùa', value: 'Quét sân chùa', inline: true },
        )
        .setImage('assets/locations/chua.png')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('temple:main_hall')
          .setLabel('Chính Điện')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('temple:zen_hall')
          .setLabel('Thiền Đường')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('temple:lotus_garden')
          .setLabel('Vườn Hoa Sen')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('temple:temple_grounds')
          .setLabel('Sân Chùa')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Lỗi khi mở bản đồ chùa:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

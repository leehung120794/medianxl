import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRootById } from '../../config/spiritualRoots.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cancot')
    .setDescription('Xem thông tin căn cốt của bạn'),

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

      const root = user.character.spiritualRoot;
      const rootConfig = getRootById(root.id);

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🌟 Căn Cốt')
        .setDescription(
          `**Căn cốt:** ${root.name}\n` +
          `**Hệ số tu luyện:** ×${root.multiplier}\n` +
          `**Tỷ lệ xuất hiện:** ${root.chance}%\n\n` +
          `Số lần đổi căn cốt: ${user.character.rootChangedCount}\n\n` +
          `Mọi nguồn tu vi từ hoạt động hợp lệ đều sẽ được nhân với hệ số này.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi xem căn cốt:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

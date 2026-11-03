import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { ITEMS, getItemById } from '../../config/items.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cuahang')
    .setDescription('Mở cửa hàng để mua vật phẩm'),

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
        .setTitle('🏪 Cửa Hàng')
        .setDescription(
          `Chào mừng đạo hữu đến với cửa hàng.\n\n` +
          `💎 Linh thạch hiện có: ${user.character.spiritStone}\n\n` +
          `**Danh sách vật phẩm:**`
        )
        .addFields(
          ITEMS.map(item => ({
            name: item.name,
            value: `${item.description}\n💰 Giá: ${item.priceSpiritStone} linh thạch`,
            inline: false,
          }))
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('shop:buy:dan_nghich_thien')
          .setLabel('Mua Đan Dược Nghịch Thiên')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Lỗi khi mở cửa hàng:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

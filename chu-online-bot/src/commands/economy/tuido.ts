import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getItemById } from '../../config/items.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tuido')
    .setDescription('Xem túi đồ của bạn'),

  async execute(interaction: any) {
    const discordId = interaction.user.id;

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: {
          character: {
            include: {
              inventory: {
                include: { item: true },
              },
            },
          },
        },
      });

      if (!user?.character) {
        return interaction.reply({
          content: 'Bạn chưa có nhân vật. Sử dụng lệnh `/batdau` để bắt đầu.',
          ephemeral: true,
        });
      }

      if (user.character.inventory.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🎒 Túi Đồ')
          .setDescription('Túi đồ của bạn đang trống.')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      const itemsList = user.character.inventory.map(inv => {
        const item = getItemById(inv.itemId) || inv.item;
        return `**${item.name}** (x${inv.quantity})\n${item.description}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🎒 Túi Đồ')
        .setDescription(itemsList)
        .setTimestamp();

      // Add use buttons for items
      const rows = user.character.inventory.map(inv => {
        const item = getItemById(inv.itemId) || inv.item;
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`inventory:use:${inv.itemId}`)
            .setLabel(`Sử dụng ${item.name}`)
            .setStyle(ButtonStyle.Success)
        );
      });

      await interaction.reply({ embeds: [embed], components: rows });
    } catch (error) {
      console.error('Lỗi khi xem túi đồ:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

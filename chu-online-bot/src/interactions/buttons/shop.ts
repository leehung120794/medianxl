import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { ITEMS, getItemById } from '../../config/items.js';

export default {
  async execute(interaction: ButtonInteraction, params: string[]) {
    const action = params[0];
    const discordId = interaction.user.id;

    if (action === 'buy') {
      const itemId = params[1];
      const item = getItemById(itemId);

      if (!item) {
        return interaction.update({
          content: 'Vật phẩm không tồn tại.',
          components: [],
        });
      }

      try {
        const user = await prisma.user.findUnique({
          where: { discordId },
          include: { character: true },
        });

        if (!user?.character) {
          return interaction.update({
            content: 'Không tìm thấy nhân vật.',
            components: [],
          });
        }

        // Check if has enough spirit stones
        if (user.character.spiritStone < item.priceSpiritStone) {
          return interaction.update({
            content: `Linh thạch không đủ. Cần ${item.priceSpiritStone} linh thạch.`,
            components: [],
          });
        }

        // Purchase in transaction
        await prisma.$transaction(async (tx) => {
          // Deduct spirit stones
          await tx.character.update({
            where: { id: user.character.id },
            data: {
              spiritStone: {
                decrement: BigInt(item.priceSpiritStone),
              },
            },
          });

          // Add or update inventory
          const existingInventory = await tx.inventory.findUnique({
            where: {
              characterId_itemId: {
                characterId: user.character.id,
                itemId,
              },
            },
          });

          if (existingInventory) {
            await tx.inventory.update({
              where: { id: existingInventory.id },
              data: { quantity: { increment: 1 } },
            });
          } else {
            await tx.inventory.create({
              data: {
                characterId: user.character.id,
                itemId,
                quantity: 1,
              },
            });
          }

          // Ensure item exists in database
          const existingItem = await tx.item.findUnique({
            where: { id: itemId },
          });

          if (!existingItem) {
            await tx.item.create({
              data: {
                id: item.id,
                name: item.name,
                description: item.description,
                itemType: item.itemType,
                priceSpiritStone: BigInt(item.priceSpiritStone),
              },
            });
          }

          // Log transaction
          await tx.transaction.create({
            data: {
              characterId: user.character.id,
              resourceType: 'spirit_stone',
              amount: BigInt(-item.priceSpiritStone),
              reason: `Purchase: ${item.name}`,
              referenceType: 'purchase',
              referenceId: itemId,
            },
          });
        });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Mua Thành Công')
          .setDescription(
            `Đạo hữu đã mua thành công ${item.name}.\n\n` +
            `**Giá:** ${item.priceSpiritStone} linh thạch\n` +
            `**Linh thạch còn lại:** ${BigInt(user.character.spiritStone) - BigInt(item.priceSpiritStone)}\n\n` +
            `Sử dụng lệnh \`/tuido\` để xem và sử dụng vật phẩm.`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      } catch (error) {
        console.error('Lỗi khi mua vật phẩm:', error);
        await interaction.update({
          content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
          components: [],
        });
      }
    }
  },
};

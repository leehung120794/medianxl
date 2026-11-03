import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRandomRoot, getRootById } from '../../config/spiritualRoots.js';
import { getRealmById, getStageName } from '../../config/realms.js';

export default {
  async execute(interaction: ButtonInteraction, params: string[]) {
    const action = params[0];
    const discordId = interaction.user.id;

    if (action === 'use') {
      const itemId = params[1];

      if (itemId === 'dan_nghich_thien') {
        try {
          const user = await prisma.user.findUnique({
            where: { discordId },
            include: {
              character: {
                include: {
                  spiritualRoot: true,
                  inventory: {
                    where: { itemId },
                    include: { item: true },
                  },
                },
              },
            },
          });

          if (!user?.character) {
            return interaction.update({
              content: 'Không tìm thấy nhân vật.',
              components: [],
            });
          }

          const inventoryItem = user.character.inventory[0];
          if (!inventoryItem || inventoryItem.quantity < 1) {
            return interaction.update({
              content: 'Bạn không có vật phẩm này.',
              components: [],
            });
          }

          const currentRoot = user.character.spiritualRoot;

          // Show confirmation
          const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('⚠️ Xác Nhận Sử Đụng Đan Dược Nghịch Thiên')
            .setDescription(
              `Bạn đang sử dụng Đan Dược Nghịch Thiên để thay đổi căn cốt.\n\n` +
              `**Căn cốt hiện tại:** ${currentRoot.name} (×${currentRoot.multiplier})\n\n` +
              `⚠️ Lưu ý: Đan Dược Nghịch Thiên không đảm bảo căn cốt mới tốt hơn căn cốt cũ.\n\n` +
              `Bạn có chắc chắn muốn tiếp tục?`
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('inventory:confirm_use:dan_nghich_thien')
              .setLabel('Xác nhận')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('inventory:cancel_use')
              .setLabel('Hủy')
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
          console.error('Lỗi khi chuẩn bị sử dụng vật phẩm:', error);
          await interaction.update({
            content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
            components: [],
          });
        }
      }
    } else if (action === 'confirm_use') {
      const itemId = params[1];

      if (itemId === 'dan_nghich_thien') {
        try {
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

          const oldRoot = user.character.spiritualRoot;
          const newRoot = getRandomRoot();

          // Update in transaction
          await prisma.$transaction(async (tx) => {
            // Update character spiritual root
            await tx.character.update({
              where: { id: user.character.id },
              data: {
                spiritualRootId: newRoot.id,
                rootChangedCount: { increment: 1 },
              },
            });

            // Remove item from inventory
            const inventoryItem = await tx.inventory.findFirst({
              where: {
                characterId: user.character.id,
                itemId,
              },
            });

            if (inventoryItem) {
              if (inventoryItem.quantity > 1) {
                await tx.inventory.update({
                  where: { id: inventoryItem.id },
                  data: { quantity: { decrement: 1 } },
                });
              } else {
                await tx.inventory.delete({
                  where: { id: inventoryItem.id },
                });
              }
            }

            // Log root change
            await tx.rootChangeLog.create({
              data: {
                characterId: user.character.id,
                oldRootId: oldRoot.id,
                newRootId: newRoot.id,
                itemId,
              },
            });

            // Ensure new root exists in database
            const existingRoot = await tx.spiritualRoot.findUnique({
              where: { id: newRoot.id },
            });

            if (!existingRoot) {
              await tx.spiritualRoot.create({
                data: {
                  id: newRoot.id,
                  name: newRoot.name,
                  chance: newRoot.chance,
                  multiplier: newRoot.multiplier,
                },
              });
            }
          });

          const realm = getRealmById(user.character.realmId);
          const stageName = getStageName(user.character.realmStage);

          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎲 Đã Thay Đổi Căn Cốt')
            .setDescription(
              `Đạo hữu đã sử dụng Đan Dược Nghịch Thiên.\n\n` +
              `**Căn cốt cũ:** ${oldRoot.name} (×${oldRoot.multiplier})\n` +
              `**Căn cốt mới:** ${newRoot.name} (×${newRoot.multiplier})\n\n` +
              `Số lần đổi căn cốt: ${user.character.rootChangedCount + 1}\n\n` +
              `Cảnh giới hiện tại: ${realm?.name} - Tầng ${user.character.realmStage} (${stageName})`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
          console.error('Lỗi khi sử dụng vật phẩm:', error);
          await interaction.update({
            content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
            components: [],
          });
        }
      }
    } else if (action === 'cancel_use') {
      // Return to inventory view
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
        return interaction.update({
          content: 'Không tìm thấy nhân vật.',
          components: [],
        });
      }

      if (user.character.inventory.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🎒 Túi Đồ')
          .setDescription('Túi đồ của bạn đang trống.')
          .setTimestamp();

        return interaction.update({ embeds: [embed], components: [] });
      }

      const { getItemById } = await import('../../config/items.js');
      const itemsList = user.character.inventory.map(inv => {
        const item = getItemById(inv.itemId) || inv.item;
        return `**${item.name}** (x${inv.quantity})\n${item.description}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🎒 Túi Đồ')
        .setDescription(itemsList)
        .setTimestamp();

      const rows = user.character.inventory.map(inv => {
        const item = getItemById(inv.itemId) || inv.item;
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`inventory:use:${inv.itemId}`)
            .setLabel(`Sử dụng ${item.name}`)
            .setStyle(ButtonStyle.Success)
        );
      });

      await interaction.update({ embeds: [embed], components: rows });
    }
  },
};

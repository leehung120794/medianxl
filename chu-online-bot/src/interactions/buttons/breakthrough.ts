import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRealmById, getRealmByOrder, getStageName, calculateRequiredCultivation, getBreakthroughRate } from '../../config/realms.js';
import { isBreakthroughSuccessful } from '../../engines/rewardEngine.js';

export default {
  async execute(interaction: ButtonInteraction, params: string[]) {
    const action = params[0];
    const discordId = interaction.user.id;

    if (action === 'attempt') {
      try {
        const user = await prisma.user.findUnique({
          where: { discordId },
          include: { character: { include: { spiritualRoot: true } } },
        });

        if (!user?.character) {
          return interaction.update({
            content: 'Không tìm thấy nhân vật.',
            components: [],
          });
        }

        const character = user.character;
        const currentRealm = getRealmById(character.realmId);

        // Determine if minor or major breakthrough
        const isMinorBreakthrough = character.realmStage < 9;
        const nextStage = isMinorBreakthrough ? character.realmStage + 1 : 1;
        const nextRealm = isMinorBreakthrough
          ? currentRealm
          : getRealmByOrder((currentRealm?.order || 1) + 1);

        if (!nextRealm) {
          return interaction.update({
            content: 'Đã đạt cảnh giới cao nhất.',
            components: [],
          });
        }

        const requiredCultivation = calculateRequiredCultivation(nextRealm.order, nextStage);
        const breakthroughRate = isMinorBreakthrough ? 100 : getBreakthroughRate(currentRealm.order);

        // Check if has enough cultivation
        if (character.cultivation < requiredCultivation) {
          return interaction.update({
            content: `Tu vi không đủ. Cần ${requiredCultivation} tu vi.`,
            components: [],
          });
        }

        // Perform breakthrough
        const success = isBreakthroughSuccessful(breakthroughRate);

        await prisma.$transaction(async (tx) => {
          if (success) {
            // Update character
            await tx.character.update({
              where: { id: character.id },
              data: {
                realmId: nextRealm.id,
                realmStage: nextStage,
                cultivation: {
                  decrement: BigInt(requiredCultivation),
                },
                totalBreakthroughs: {
                  increment: 1,
                },
              },
            });

            // Log transaction
            await tx.transaction.create({
              data: {
                characterId: character.id,
                resourceType: 'cultivation',
                amount: BigInt(-requiredCultivation),
                reason: 'Breakthrough success',
                referenceType: 'breakthrough',
              },
            });
          } else {
            // Major breakthrough failed - deduct 10% of required cultivation
            const penalty = Math.round(requiredCultivation * 0.1);
            await tx.character.update({
              where: { id: character.id },
              data: {
                cultivation: {
                  decrement: BigInt(penalty),
                },
              },
            });

            // Log transaction
            await tx.transaction.create({
              data: {
                characterId: character.id,
                resourceType: 'cultivation',
                amount: BigInt(-penalty),
                reason: 'Breakthrough failed',
                referenceType: 'breakthrough',
              },
            });
          }
        });

        const stageName = getStageName(nextStage);

        if (success) {
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎉 Đột Phá Thành Công!')
            .setDescription(
              `Chúc mừng đạo hữu đã đột phá thành công!\n\n` +
              `**Cảnh giới mới:** ${nextRealm.name} - Tầng ${nextStage} (${stageName})\n` +
              `**Tu vi tiêu hao:** ${requiredCultivation}`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        } else {
          const penalty = Math.round(requiredCultivation * 0.1);
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Đột Phá Thất Bại')
            .setDescription(
              `Đạo hữu đã đột phá thất bại.\n\n` +
              `**Phạt:** ${penalty} tu vi (10% của yêu cầu)\n` +
              `**Tu vi còn lại:** ${BigInt(character.cultivation) - BigInt(penalty)}\n\n` +
              `Đừng nản chí, hãy tiếp tục tu luyện và thử lại!`
            )
            .setTimestamp();

          await interaction.update({ embeds: [embed], components: [] });
        }
      } catch (error) {
        console.error('Lỗi khi thực hiện đột phá:', error);
        await interaction.update({
          content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
          components: [],
        });
      }
    } else if (action === 'cancel') {
      await interaction.update({
        content: 'Đã hủy đột phá.',
        components: [],
      });
    }
  },
};

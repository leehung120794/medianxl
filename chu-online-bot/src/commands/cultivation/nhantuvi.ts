import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRootById } from '../../config/spiritualRoots.js';
import { calculateCultivationReward } from '../../engines/rewardEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nhantuvi')
    .setDescription('Nhận phần thưởng tu vi khi phiên hoàn tất'),

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

      // Find running session
      const session = await prisma.cultivationSession.findFirst({
        where: {
          characterId: user.character.id,
          status: 'running',
        },
      });

      if (!session) {
        return interaction.reply({
          content: 'Bạn không có phiên tu luyện nào đang diễn ra.',
          ephemeral: true,
        });
      }

      const now = new Date();
      if (now < session.endsAt) {
        const remainingTime = Math.ceil((session.endsAt.getTime() - now.getTime()) / 1000 / 60);
        return interaction.reply({
          content: `Phiên tu luyện chưa hoàn tất. Còn lại khoảng ${remainingTime} phút.`,
          ephemeral: true,
        });
      }

      // Calculate reward
      const root = getRootById(user.character.spiritualRootId);
      const rootMultiplier = root?.multiplier || 1;
      const baseReward = Number(session.baseReward);
      const actualReward = calculateCultivationReward({
        baseAmount: baseReward,
        rootMultiplier,
      });

      // Update in transaction
      await prisma.$transaction(async (tx) => {
        // Update session status
        await tx.cultivationSession.update({
          where: { id: session.id },
          data: {
            status: 'claimed',
            claimedAt: now,
          },
        });

        // Update character cultivation
        await tx.character.update({
          where: { id: user.character.id },
          data: {
            cultivation: {
              increment: BigInt(actualReward),
            },
          },
        });

        // Log transaction
        await tx.transaction.create({
          data: {
            characterId: user.character.id,
            resourceType: 'cultivation',
            amount: BigInt(actualReward),
            reason: 'Cultivation session reward',
            referenceType: 'cultivation_session',
            referenceId: session.id,
          },
        });
      });

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎉 Tu Luyện Hoàn Tất')
        .setDescription(
          `Đạo hữu đã hoàn thành phiên tu luyện!\n\n` +
          `**Thưởng cơ bản:** ${baseReward} tu vi\n` +
          `**Hệ số căn cốt:** ×${rootMultiplier}\n` +
          `**Thưởng thực nhận:** ${actualReward} tu vi\n\n` +
          `Tu vi hiện tại: ${BigInt(user.character.cultivation) + BigInt(actualReward)}`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi nhận tu vi:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

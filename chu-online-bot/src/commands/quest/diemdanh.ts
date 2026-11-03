import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';

export default {
  data: new SlashCommandBuilder()
    .setName('diemdanh')
    .setDescription('Điểm danh hằng ngày để nhận phần thưởng'),

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

      // Get today's date in Vietnam timezone
      const now = new Date();
      const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const today = vietnamTime.toISOString().split('T')[0];

      // Check if already checked in today
      const existingCheckin = await prisma.dailyCheckin.findUnique({
        where: {
          characterId_checkinDate: {
            characterId: user.character.id,
            checkinDate: today,
          },
        },
      });

      if (existingCheckin) {
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('Đã điểm danh hôm nay')
          .setDescription(
            `Bạn đã điểm danh hôm nay (${today}).\n\n` +
            `Chuỗi điểm danh: ${existingCheckin.streak} ngày\n\n` +
            `Hãy quay lại vào ngày mai để tiếp tục chuỗi điểm danh!`
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Calculate rewards based on streak
      const lastCheckin = await prisma.dailyCheckin.findFirst({
        where: { characterId: user.character.id },
        orderBy: { checkinDate: 'desc' },
      });

      let streak = 1;
      if (lastCheckin) {
        const yesterday = new Date(vietnamTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastCheckin.checkinDate === yesterdayStr) {
          streak = lastCheckin.streak + 1;
        }
      }

      // Rewards
      const spiritStoneReward = 100 + (streak * 10);
      const meritReward = 10 + Math.floor(streak / 7) * 5;

      // Create checkin and update character in transaction
      await prisma.$transaction(async (tx) => {
        await tx.dailyCheckin.create({
          data: {
            characterId: user.character.id,
            checkinDate: today,
            streak,
          },
        });

        await tx.character.update({
          where: { id: user.character.id },
          data: {
            spiritStone: { increment: BigInt(spiritStoneReward) },
            merit: { increment: BigInt(meritReward) },
          },
        });

        // Log transactions
        await tx.transaction.create({
          data: {
            characterId: user.character.id,
            resourceType: 'spirit_stone',
            amount: BigInt(spiritStoneReward),
            reason: 'Daily checkin',
            referenceType: 'daily_checkin',
          },
        });

        await tx.transaction.create({
          data: {
            characterId: user.character.id,
            resourceType: 'merit',
            amount: BigInt(meritReward),
            reason: 'Daily checkin',
            referenceType: 'daily_checkin',
          },
        });
      });

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Điểm Danh Thành Công')
        .setDescription(
          `Chúc mừng đạo hữu đã điểm danh thành công!\n\n` +
          `**Ngày:** ${today}\n` +
          `**Chuỗi điểm danh:** ${streak} ngày\n\n` +
          `**Phần thưởng:**\n` +
          `💎 Linh thạch: ${spiritStoneReward}\n` +
          `🙏 Công đức: ${meritReward}\n\n` +
          `Hãy quay lại vào ngày mai để tiếp tục chuỗi điểm danh!`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi điểm danh:', error);
      await interaction.reply({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        ephemeral: true,
      });
    }
  },
};

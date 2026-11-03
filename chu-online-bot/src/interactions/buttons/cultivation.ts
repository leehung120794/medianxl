import { StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { CULTIVATION_DURATIONS, RETREAT_DURATIONS, RETREAT_EFFICIENCY_MULTIPLIER } from '../../config/cultivation.js';
import { getRootById } from '../../config/spiritualRoots.js';
import { calculateCultivationReward } from '../../engines/rewardEngine.js';

export default {
  async execute(interaction: StringSelectMenuInteraction, params: string[]) {
    const action = params[0];

    if (action === 'select_duration') {
      const selectedMinutes = parseInt(interaction.values[0]);
      const duration = CULTIVATION_DURATIONS.find(d => d.minutes === selectedMinutes);

      if (!duration) {
        return interaction.update({
          content: 'Thời gian không hợp lệ.',
          components: [],
        });
      }

      const discordId = interaction.user.id;

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

        // Check again for running session
        const runningSession = await prisma.cultivationSession.findFirst({
          where: {
            characterId: user.character.id,
            status: 'running',
          },
        });

        if (runningSession) {
          return interaction.update({
            content: 'Bạn đang có một phiên tu luyện đang diễn ra.',
            components: [],
          });
        }

        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + duration.minutes * 60 * 1000);
        const root = getRootById(user.character.spiritualRootId);
        const rootMultiplier = root?.multiplier || 1;
        const baseReward = BigInt(duration.baseReward);

        // Create cultivation session
        await prisma.cultivationSession.create({
          data: {
            characterId: user.character.id,
            sessionType: 'normal',
            startedAt,
            endsAt,
            durationSeconds: duration.minutes * 60,
            baseReward,
            status: 'running',
          },
        });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🧘 Đã bắt đầu tu luyện')
          .setDescription(
            `Đạo hữu đã bắt đầu phiên tu luyện trong ${duration.minutes} phút.\n\n` +
            `**Thời gian bắt đầu:** ${startedAt.toLocaleString('vi-VN')}\n` +
            `**Thời gian kết thúc:** ${endsAt.toLocaleString('vi-VN')}\n` +
            `**Thưởng cơ bản:** ${duration.baseReward} tu vi\n` +
            `**Hệ số căn cốt:** ×${rootMultiplier}\n\n` +
            `Sử dụng lệnh \`/nhantuvi\` để nhận phần thưởng khi phiên hoàn tất.`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      } catch (error) {
        console.error('Lỗi khi bắt đầu tu luyện:', error);
        await interaction.update({
          content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
          components: [],
        });
      }
    } else if (action === 'select_retreat_duration') {
      const selectedMinutes = parseInt(interaction.values[0]);
      const duration = RETREAT_DURATIONS.find(d => d.minutes === selectedMinutes);

      if (!duration) {
        return interaction.update({
          content: 'Thời gian không hợp lệ.',
          components: [],
        });
      }

      const discordId = interaction.user.id;

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

        // Check again for running session
        const runningSession = await prisma.cultivationSession.findFirst({
          where: {
            characterId: user.character.id,
            status: 'running',
          },
        });

        if (runningSession) {
          return interaction.update({
            content: 'Bạn đang có một phiên tu luyện/bế quan đang diễn ra.',
            components: [],
          });
        }

        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + duration.minutes * 60 * 1000);
        const root = getRootById(user.character.spiritualRootId);
        const rootMultiplier = root?.multiplier || 1;
        const baseReward = BigInt(Math.round(duration.baseReward * RETREAT_EFFICIENCY_MULTIPLIER));

        // Create retreat session
        await prisma.cultivationSession.create({
          data: {
            characterId: user.character.id,
            sessionType: 'retreat',
            startedAt,
            endsAt,
            durationSeconds: duration.minutes * 60,
            baseReward,
            status: 'running',
          },
        });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🧘‍♂️ Đã bắt đầu bế quan')
          .setDescription(
            `Đạo hữu đã bắt đầu bế quan trong ${duration.minutes} phút.\n\n` +
            `**Thời gian bắt đầu:** ${startedAt.toLocaleString('vi-VN')}\n` +
            `**Thời gian kết thúc:** ${endsAt.toLocaleString('vi-VN')}\n` +
            `**Thưởng cơ bản:** ${duration.baseReward} tu vi (hiệu suất ×${RETREAT_EFFICIENCY_MULTIPLIER})\n` +
            `**Hệ số căn cốt:** ×${rootMultiplier}\n\n` +
            `Sử dụng lệnh \`/nhantuvi\` để nhận phần thưởng khi phiên hoàn tất.`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      } catch (error) {
        console.error('Lỗi khi bắt đầu bế quan:', error);
        await interaction.update({
          content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
          components: [],
        });
      }
    }
  },
};

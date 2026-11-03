import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { TEMPLE_ACTIVITIES, getActivityById } from '../../config/templeActivities.js';
import { getRootById } from '../../config/spiritualRoots.js';
import { calculateCultivationReward } from '../../engines/rewardEngine.js';

export default {
  async execute(interaction: ButtonInteraction, params: string[]) {
    const action = params[0];
    const discordId = interaction.user.id;

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: { character: { include: { spiritualRoot: true } } },
      });

      if (!user?.character) {
        return interaction.update({
          content: 'Bạn chưa có nhân vật. Sử dụng lệnh `/batdau` để bắt đầu.',
          components: [],
        });
      }

      if (action === 'main_hall') {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🏛️ Chính Điện')
          .setDescription(
            'Nơi trang nghiêm để đạo hữu lễ Phật và cầu nguyện.\n\n' +
            'Các hoạt động có thể thực hiện:'
          )
          .addFields(
            { name: 'Thắp hương', value: '50 tu vi, 5 công đức (1 lần/ngày)', inline: true },
            { name: 'Lễ Phật', value: '80 tu vi, 8 công đức (1 lần/ngày)', inline: true },
          )
          .setImage('assets/locations/chinh-dien.png')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('temple:activity:thap_huong')
            .setLabel('Thắp hương')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:activity:le_phat')
            .setLabel('Lễ Phật')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:back')
            .setLabel('Quay lại')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (action === 'zen_hall') {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🧘 Thiền Đường')
          .setDescription(
            'Nơi thanh tịnh để đạo hữu tĩnh tâm và tu dưỡng đạo tâm.\n\n' +
            'Các hoạt động có thể thực hiện:'
          )
          .addFields(
            { name: 'Ngồi thiền', value: '200 tu vi, 5 đạo tâm (1 lần/ngày)', inline: true },
            { name: 'Tụng kinh', value: '150 tu vi, 10 công đức, 2 đạo tâm (1 lần/ngày)', inline: true },
          )
          .setImage('assets/locations/thien-duong.png')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('temple:activity:ngoi_thien')
            .setLabel('Ngồi thiền')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:activity:tung_kinh')
            .setLabel('Tụng kinh')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:back')
            .setLabel('Quay lại')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (action === 'lotus_garden') {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🪷 Vườn Hoa Sen')
          .setDescription(
            'Vườn hoa sen tỏa hương thơm ngát, nơi đạo hữu chăm sóc để phát triển lòng từ bi.\n\n' +
            'Các hoạt động có thể thực hiện:'
          )
          .addFields(
            { name: 'Chăm sóc hoa sen', value: '120 tu vi, 8 công đức (2 lần/ngày)', inline: true },
          )
          .setImage('assets/locations/vuon-hoa-sen.png')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('temple:activity:cham_hoa_sen')
            .setLabel('Chăm sóc hoa sen')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:back')
            .setLabel('Quay lại')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (action === 'temple_grounds') {
        const embed = new EmbedBuilder()
          .setColor(0xB89B62)
          .setTitle('🏛️ Sân Chùa')
          .setDescription(
            'Sân chùa rộng lớn, nơi đạo hữu quét dọn để tích lũy công đức.\n\n' +
            'Các hoạt động có thể thực hiện:'
          )
          .addFields(
            { name: 'Quét sân chùa', value: '100 tu vi, 10 công đức (2 lần/ngày)', inline: true },
            { name: 'Công quả', value: '300 tu vi, 20 công đức, 5 đạo tâm (1 lần/ngày)', inline: true },
          )
          .setImage('assets/locations/san-chua.png')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('temple:activity:quet_san')
            .setLabel('Quét sân chùa')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:activity:cong_qua')
            .setLabel('Công quả')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('temple:back')
            .setLabel('Quay lại')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (action === 'back') {
        // Return to main temple map
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

        await interaction.update({ embeds: [embed], components: [row] });
      } else if (action === 'activity') {
        const activityId = params[1];
        const activity = getActivityById(activityId);

        if (!activity) {
          return interaction.update({
            content: 'Hoạt động không tồn tại.',
            components: [],
          });
        }

        // Check daily limit
        const today = new Date().toISOString().split('T')[0];
        const activityLogs = await prisma.activityLog.findMany({
          where: {
            characterId: user.character.id,
            activityId,
            createdAt: {
              gte: new Date(today),
            },
          },
        });

        if (activityLogs.length >= activity.dailyLimit) {
          return interaction.update({
            content: `Bạn đã đạt giới hạn cho hoạt động này hôm nay (${activity.dailyLimit} lần).`,
            components: [],
          });
        }

        // Calculate rewards
        const root = getRootById(user.character.spiritualRootId);
        const rootMultiplier = root?.multiplier || 1;
        const actualCultivation = calculateCultivationReward({
          baseAmount: activity.baseCultivationReward,
          rootMultiplier,
        });

        // Update in transaction
        await prisma.$transaction(async (tx) => {
          // Update character
          await tx.character.update({
            where: { id: user.character.id },
            data: {
              cultivation: { increment: BigInt(actualCultivation) },
              merit: { increment: BigInt(activity.meritReward) },
              daoHeart: { increment: BigInt(activity.daoHeartReward) },
            },
          });

          // Log activity
          await tx.activityLog.create({
            data: {
              characterId: user.character.id,
              activityId,
              baseCultivation: BigInt(activity.baseCultivationReward),
              actualCultivation: BigInt(actualCultivation),
              meritReward: BigInt(activity.meritReward),
              daoHeartReward: BigInt(activity.daoHeartReward),
            },
          });

          // Log transactions
          if (actualCultivation > 0) {
            await tx.transaction.create({
              data: {
                characterId: user.character.id,
                resourceType: 'cultivation',
                amount: BigInt(actualCultivation),
                reason: `Temple activity: ${activity.name}`,
                referenceType: 'activity_log',
              },
            });
          }

          if (activity.meritReward > 0) {
            await tx.transaction.create({
              data: {
                characterId: user.character.id,
                resourceType: 'merit',
                amount: BigInt(activity.meritReward),
                reason: `Temple activity: ${activity.name}`,
                referenceType: 'activity_log',
              },
            });
          }

          if (activity.daoHeartReward > 0) {
            await tx.transaction.create({
              data: {
                characterId: user.character.id,
                resourceType: 'dao_heart',
                amount: BigInt(activity.daoHeartReward),
                reason: `Temple activity: ${activity.name}`,
                referenceType: 'activity_log',
              },
            });
          }
        });

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`✅ Hoàn thành: ${activity.name}`)
          .setDescription(
            `Đạo hữu đã hoàn thành hoạt động ${activity.name}.\n\n` +
            `**Phần thưởng:**\n` +
            `✨ Tu vi: ${actualCultivation} (cơ bản: ${activity.baseCultivationReward} × ${rootMultiplier})\n` +
            `🙏 Công đức: ${activity.meritReward}\n` +
            `💫 Đạo tâm: ${activity.daoHeartReward}\n\n` +
            `Số lần thực hiện hôm nay: ${activityLogs.length + 1}/${activity.dailyLimit}`
          )
          .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
      }
    } catch (error) {
      console.error('Lỗi khi xử lý temple interaction:', error);
      await interaction.update({
        content: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
        components: [],
      });
    }
  },
};

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { getRandomRoot } from '../../config/spiritualRoots.js';
import { getRealmByOrder } from '../../config/realms.js';

export default {
  data: new SlashCommandBuilder()
    .setName('batdau')
    .setDescription('Bắt đầu hành trình tu tiên của bạn'),

  async execute(interaction: any) {
    const discordId = interaction.user.id;

    try {
      // Check if user already has a character
      const existingUser = await prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });

      if (existingUser?.character) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Nhân vật đã tồn tại')
          .setDescription('Bạn đã có nhân vật. Sử dụng lệnh `/nhanvat` để xem thông tin.')
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Create user and character in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user if not exists
        let user = await tx.user.findUnique({
          where: { discordId },
        });

        if (!user) {
          user = await tx.user.create({
            data: { discordId },
          });
        }

        // Random spiritual root
        const root = getRandomRoot();

        // Create character
        const character = await tx.character.create({
          data: {
            userId: user.id,
            dharmaName: interaction.user.username,
            realmId: 'mortal',
            realmStage: 1,
            cultivation: 0,
            spiritStone: 500,
            merit: 0,
            daoHeart: 0,
            spiritualRootId: root.id,
          },
        });

        // Initialize spiritual roots in database if not exists
        const existingRoot = await tx.spiritualRoot.findUnique({
          where: { id: root.id },
        });

        if (!existingRoot) {
          await tx.spiritualRoot.create({
            data: {
              id: root.id,
              name: root.name,
              chance: root.chance,
              multiplier: root.multiplier,
            },
          });
        }

        // Initialize realm if not exists
        const existingRealm = await tx.realmDefinition.findUnique({
          where: { id: 'mortal' },
        });

        if (!existingRealm) {
          await tx.realmDefinition.create({
            data: { id: 'mortal', name: 'Phàm Nhân', order: 1 },
          });
        }

        return { character, root };
      });

      const realm = getRealmByOrder(1);

      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle('🎉 Chúc mừng! Đạo hữu đã bước vào con đường tu tiên')
        .setDescription(
          `Bạn đã chính thức trở thành tu sĩ tại chùa chúng tôi.\n\n` +
          `**Pháp danh:** ${result.character.dharmaName}\n` +
          `**Cảnh giới:** ${realm?.name} - Tầng ${result.character.realmStage}\n` +
          `**Căn cốt:** ${result.root.name} (×${result.root.multiplier})\n\n` +
          `**Tài nguyên khởi đầu:**\n` +
          `💎 Linh thạch: ${result.character.spiritStone}\n` +
          `✨ Tu vi: ${result.character.cultivation}\n` +
          `🙏 Công đức: ${result.character.merit}\n` +
          `💫 Đạo tâm: ${result.character.daoHeart}`
        )
        .setImage('assets/realms/pham-nhan.png')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi tạo nhân vật:', error);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Lỗi')
        .setDescription('Có lỗi xảy ra khi tạo nhân vật. Vui lòng thử lại sau.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

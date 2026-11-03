const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { getRealmById, getRealmByOrder, getStageName, calculateRequiredCultivation, getBreakthroughRate } = require("../chu-online/config/realms");

const data = new SlashCommandBuilder()
  .setName("chudotpha")
  .setDescription("Xem điều kiện và thực hiện đột phá cảnh giới");

async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    const character = db
      .prepare("SELECT * FROM chu_characters WHERE guild_id = ? AND user_id = ?")
      .get(guildId, userId);

    if (!character) {
      return interaction.reply({
        content: "Bạn chưa có nhân vật. Sử dụng lệnh `/chubatdau` để bắt đầu.",
        ephemeral: true,
      });
    }

    const currentRealm = getRealmById(character.realm_id);
    const isMinorBreakthrough = character.realm_stage < 9;
    const nextStage = isMinorBreakthrough ? character.realm_stage + 1 : 1;
    const nextRealm = isMinorBreakthrough
      ? currentRealm
      : getRealmByOrder(currentRealm.order + 1);

    if (!nextRealm) {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("🏆 Đã đạt cảnh giới cao nhất")
        .setDescription("Đạo hữu đã đạt đến cảnh giới cao nhất trong thế giới này!")
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    const requiredCultivation = calculateRequiredCultivation(nextRealm.order, nextStage);
    const stageName = getStageName(nextStage);
    const breakthroughRate = isMinorBreakthrough ? 100 : getBreakthroughRate(currentRealm.order);

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("⚡ Đột Phá Cảnh Giới")
      .setDescription(
        `**Cảnh giới hiện tại:** ${currentRealm.name} - Tầng ${character.realm_stage} (${getStageName(character.realm_stage)})\n` +
          `**Cảnh giới mục tiêu:** ${nextRealm.name} - Tầng ${nextStage} (${stageName})\n\n` +
          `**Yêu cầu:**\n` +
          `✨ Tu vi: ${character.cultivation} / ${requiredCultivation}\n` +
          `💫 Đạo tâm: ${character.dao_heart}\n` +
          `💎 Linh thạch: ${character.spirit_stone}\n\n` +
          `**Tỷ lệ thành công:** ${breakthroughRate}%\n\n` +
          isMinorBreakthrough
            ? "Đây là tiểu đột phá, tỷ lệ thành công 100%."
            : "Đây là đại đột phá, thất bại sẽ mất 10% tu vi yêu cầu."
      )
      .setImage("assets/chu-online/activities/dot-pha.png")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("chu:breakthrough:attempt").setLabel("Thử đột phá").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("chu:breakthrough:cancel").setLabel("Hủy").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Lỗi khi xem điều kiện đột phá:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

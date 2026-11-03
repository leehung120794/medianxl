const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { getRealmById, getStageName, calculateRequiredCultivation } = require("../chu-online/config/realms");
const { getRootById } = require("../chu-online/config/spiritualRoots");

const data = new SlashCommandBuilder()
  .setName("chunhanvat")
  .setDescription("Xem hồ sơ nhân vật của bạn");

async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    const character = db
      .prepare("SELECT * FROM chu_characters WHERE guild_id = ? AND user_id = ?")
      .get(guildId, userId);

    if (!character) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("Chưa có nhân vật")
        .setDescription("Bạn chưa có nhân vật. Sử dụng lệnh `/chubatdau` để bắt đầu hành trình tu tiên.")
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const realm = getRealmById(character.realm_id);
    const root = getRootById(character.spiritual_root_id);
    const stageName = getStageName(character.realm_stage);

    const nextStage = character.realm_stage < 9 ? character.realm_stage + 1 : 9;
    const requiredCultivation = calculateRequiredCultivation(realm.order, nextStage);
    const progress = character.cultivation < requiredCultivation
      ? Math.floor((character.cultivation / requiredCultivation) * 100)
      : 100;

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle(`📜 Hồ Sơ Nhân Vật - ${character.dharma_name}`)
      .setDescription(
        `**Căn cốt:** ${root.name} (×${root.multiplier})\n` +
          `**Cảnh giới:** ${realm.name} - Tầng ${character.realm_stage} (${stageName})\n\n` +
          `**Tài nguyên:**\n` +
          `✨ Tu vi: ${character.cultivation} / ${requiredCultivation}\n` +
          `💎 Linh thạch: ${character.spirit_stone}\n` +
          `🙏 Công đức: ${character.merit}\n` +
          `💫 Đạo tâm: ${character.dao_heart}\n\n` +
          `**Thống kê:**\n` +
          `📊 Số lần đột phá: ${character.total_breakthroughs}\n` +
          `🔄 Số lần đổi căn cốt: ${character.root_changed_count}`
      )
      .addFields({ name: "Tiến độ tu vi", value: `▓▓▓▓▓▓▓▓▓▓ ${progress}%`, inline: false })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("chu:character:cultivate").setLabel("Tu luyện").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chu:character:quests").setLabel("Nhiệm vụ").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("chu:character:breakthrough").setLabel("Đột phá").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("chu:character:inventory").setLabel("Túi đồ").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("chu:character:refresh").setLabel("Làm mới").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Lỗi khi xem hồ sơ nhân vật:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra khi xem hồ sơ nhân vật. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

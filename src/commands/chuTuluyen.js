const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");
const { db } = require("../db");
const { CULTIVATION_DURATIONS } = require("../chu-online/config/cultivation");

const data = new SlashCommandBuilder()
  .setName("chutuluyen")
  .setDescription("Bắt đầu phiên tu luyện");

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

    // Check for running session
    const runningSession = db
      .prepare(
        "SELECT * FROM chu_cultivation_sessions WHERE character_id = ? AND status = 'running'"
      )
      .get(`${guildId}-${userId}`);

    if (runningSession) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle("Đang có phiên tu luyện đang chạy")
        .setDescription(
          `Bạn đang có một phiên tu luyện đang diễn ra.\n` +
            `Thời gian bắt đầu: ${new Date(runningSession.started_at * 1000).toLocaleString("vi-VN")}\n` +
            `Thời gian kết thúc: ${new Date(runningSession.ends_at * 1000).toLocaleString("vi-VN")}\n\n` +
            `Sử dụng lệnh \`/chunhantuvi\` để nhận phần thưởng khi phiên hoàn tất.`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("🧘 Tu Luyện")
      .setDescription("Chọn thời gian tu luyện:")
      .addFields(
        CULTIVATION_DURATIONS.map((duration) => ({
          name: `${duration.minutes} phút`,
          value: `Thưởng cơ bản: ${duration.baseReward} tu vi`,
          inline: true,
        }))
      )
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("chu:cultivation:select_duration")
      .setPlaceholder("Chọn thời gian tu luyện")
      .addOptions(
        CULTIVATION_DURATIONS.map((duration) => ({
          label: `${duration.minutes} phút`,
          description: `Thưởng: ${duration.baseReward} tu vi`,
          value: duration.minutes.toString(),
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Lỗi khi mở menu tu luyện:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");

const data = new SlashCommandBuilder()
  .setName("chuchua")
  .setDescription("Mở bản đồ chùa và tham gia hoạt động");

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

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("🏯 Chùa Online - Bản Đồ")
      .setDescription(
        "Chào mừng đạo hữu đến với chùa chúng tôi.\n\n" +
          "Đây là nơi đạo hữu có thể tham gia các hoạt động tu dưỡng," +
          " tích lũy công đức và đạo tâm.\n\n" +
          "Chọn một địa điểm để bắt đầu:"
      )
      .addFields(
        { name: "Chính Điện", value: "Lễ Phật, nhận công đức", inline: true },
        { name: "Thiền Đường", value: "Ngồi thiền, nhận đạo tâm", inline: true },
        { name: "Vườn Hoa Sen", value: "Chăm sóc hoa sen", inline: true },
        { name: "Sân Chùa", value: "Quét sân chùa", inline: true }
      )
      .setImage("assets/chu-online/locations/chua.png")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("chu:temple:main_hall").setLabel("Chính Điện").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chu:temple:zen_hall").setLabel("Thiền Đường").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chu:temple:lotus_garden").setLabel("Vườn Hoa Sen").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("chu:temple:temple_grounds").setLabel("Sân Chùa").setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Lỗi khi mở bản đồ chùa:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

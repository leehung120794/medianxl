const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎮 TRỢ GIÚP BOT")
    .setDescription("Các lệnh hiện được bật trong bot:")
    .addFields(
      {
        name: "🎲 Trò chơi",
        value: "`/baucua` · `/taixiu` · `/xidach` · `/poker` · `/duangua` · `/domin` · `/vtv`",
      },
      {
        name: "💰 Tài khoản",
        value: "`/hoso` · `/xu` · `/xephang` · `/anxin`",
      },
      {
        name: "🧰 Median XL",
        value: "`/item` tra cứu dữ liệu item · `/update` cập nhật database item · `/backup` sao lưu dữ liệu bot",
      },
      {
        name: "📖 Khác",
        value: "`/batdau` · `/luat` · `/huongdan` · `/changelog`",
      },
    )
    .setFooter({ text: "Lệnh quản trị có thể yêu cầu quyền admin." });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trogiup")
    .setDescription("Xem các lệnh đang hoạt động"),
  helpEmbed,
  async execute(interaction) {
    return interaction.reply({
      embeds: [helpEmbed()],
      flags: MessageFlags.Ephemeral,
    });
  },
};

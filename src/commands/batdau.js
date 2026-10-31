const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("batdau")
    .setDescription("Xem hướng dẫn bắt đầu chơi"),
  async execute(interaction) {
    if (!interaction.guildId)
      return interaction.reply({
        content: "Lệnh này chỉ dùng trong server.",
        flags: MessageFlags.Ephemeral,
      });
    const embed = new EmbedBuilder()
      .setColor(0x38bdf8)
      .setTitle("👋 CHÀO MỪNG ĐẾN GAME HUB")
      .setDescription("Bắt đầu nhanh trong ba bước:")
      .addFields(
        {
          name: "1 · Kiểm tra xu",
          value: "Dùng `/xu` để xem số dư và lịch sử giao dịch.",
        },
        {
          name: "2 · Chọn trò chơi",
          value:
            "Dùng `/baucua`, `/taixiu`, `/xidach`, `/poker`, `/duangua`, `/domin` hoặc `/vtv` để chơi.",
        },
        {
          name: "3 · Hồ sơ và xếp hạng",
          value: "Dùng `/hoso` và `/xephang`.",
        },
        {
          name: "Chơi có trách nhiệm",
          value:
            "Đặt cược nhỏ khi làm quen. Xem 10 ván gần nhất bằng `/xu vanchoi`.",
        },
      )
      .setFooter({ text: "Chúc bạn chơi vui vẻ." });
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

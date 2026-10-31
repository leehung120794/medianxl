const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎮 GAME ĐANG CÓ")
    .setDescription(
      "`/baucua` · `/taixiu` · `/xidach` · `/poker` · `/duangua` · `/domin` · `/vtv`",
    )
    .setFooter({ text: "Dùng /luat để xem luật từng trò chơi." });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("huongdan")
    .setDescription("Xem các trò chơi hiện có"),
  helpEmbed,
  async execute(interaction) {
    return interaction.reply({
      embeds: [helpEmbed()],
      flags: MessageFlags.Ephemeral,
    });
  },
};

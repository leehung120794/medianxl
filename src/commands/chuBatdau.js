const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../db");
const { getRandomRoot } = require("../chu-online/config/spiritualRoots");
const { getRealmByOrder } = require("../chu-online/config/realms");

const data = new SlashCommandBuilder()
  .setName("chubatdau")
  .setDescription("Bắt đầu hành trình tu tiên của bạn");

async function execute(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    // Check if character already exists
    const existing = db
      .prepare("SELECT * FROM chu_characters WHERE guild_id = ? AND user_id = ?")
      .get(guildId, userId);

    if (existing) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("Nhân vật đã tồn tại")
        .setDescription("Bạn đã có nhân vật. Sử dụng lệnh `/chunhanvat` để xem thông tin.")
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Random spiritual root
    const root = getRandomRoot();
    const realm = getRealmByOrder(1);
    const now = Math.floor(Date.now() / 1000);

    // Create character
    const characterId = `${guildId}-${userId}`;
    db.prepare(
      `INSERT INTO chu_characters (
        id, guild_id, user_id, dharma_name, realm_id, realm_stage,
        cultivation, spirit_stone, merit, dao_heart, spiritual_root_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      characterId,
      guildId,
      userId,
      interaction.user.username,
      "mortal",
      1,
      0,
      500,
      0,
      0,
      root.id,
      now,
      now
    );

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("🎉 Chúc mừng! Đạo hữu đã bước vào con đường tu tiên")
      .setDescription(
        `Bạn đã chính thức trở thành tu sĩ tại chùa chúng tôi.\n\n` +
          `**Pháp danh:** ${interaction.user.username}\n` +
          `**Cảnh giới:** ${realm.name} - Tầng 1\n` +
          `**Căn cốt:** ${root.name} (×${root.multiplier})\n\n` +
          `**Tài nguyên khởi đầu:**\n` +
          `💎 Linh thạch: 500\n` +
          `✨ Tu vi: 0\n` +
          `🙏 Công đức: 0\n` +
          `💫 Đạo tâm: 0`
      )
      .setImage("assets/chu-online/realms/pham-nhan.png")
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Lỗi khi tạo nhân vật:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra khi tạo nhân vật. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

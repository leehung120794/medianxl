const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../db");
const { getRootById } = require("../chu-online/config/spiritualRoots");

const data = new SlashCommandBuilder()
  .setName("chunhantuvi")
  .setDescription("Nhận phần thưởng tu vi khi phiên hoàn tất");

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

    const session = db
      .prepare(
        "SELECT * FROM chu_cultivation_sessions WHERE character_id = ? AND status = 'running'"
      )
      .get(`${guildId}-${userId}`);

    if (!session) {
      return interaction.reply({
        content: "Bạn không có phiên tu luyện nào đang diễn ra.",
        ephemeral: true,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < session.ends_at) {
      const remainingTime = Math.ceil((session.ends_at - now) / 60);
      return interaction.reply({
        content: `Phiên tu luyện chưa hoàn tất. Còn lại khoảng ${remainingTime} phút.`,
        ephemeral: true,
      });
    }

    const root = getRootById(character.spiritual_root_id);
    const rootMultiplier = root?.multiplier || 1;
    const baseReward = session.base_reward;
    const actualReward = Math.floor(baseReward * rootMultiplier);

    db.transaction(() => {
      // Update session
      db.prepare("UPDATE chu_cultivation_sessions SET status = 'claimed', claimed_at = ? WHERE id = ?").run(
        now,
        session.id
      );

      // Update character
      db.prepare("UPDATE chu_characters SET cultivation = cultivation + ?, updated_at = ? WHERE id = ?").run(
        actualReward,
        now,
        character.id
      );

      // Log transaction
      db.prepare(
        `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `${session.id}-cultivation`,
        guildId,
        character.id,
        "cultivation",
        actualReward,
        "Cultivation session reward",
        now
      );
    })();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("🎉 Tu Luyện Hoàn Tất")
      .setDescription(
        `Đạo hữu đã hoàn thành phiên tu luyện!\n\n` +
          `**Thưởng cơ bản:** ${baseReward} tu vi\n` +
          `**Hệ số căn cốt:** ×${rootMultiplier}\n` +
          `**Thưởng thực nhận:** ${actualReward} tu vi\n\n` +
          `Tu vi hiện tại: ${character.cultivation + actualReward}`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Lỗi khi nhận tu vi:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

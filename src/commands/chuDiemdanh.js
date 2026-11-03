const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../db");

const data = new SlashCommandBuilder()
  .setName("chudiemdanh")
  .setDescription("Điểm danh hằng ngày để nhận phần thưởng");

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

    // Get today's date in Vietnam timezone
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const today = vietnamTime.toISOString().split("T")[0];

    // Check if already checked in today
    const existingCheckin = db
      .prepare("SELECT * FROM chu_daily_checkins WHERE character_id = ? AND checkin_date = ?")
      .get(character.id, today);

    if (existingCheckin) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle("Đã điểm danh hôm nay")
        .setDescription(
          `Bạn đã điểm danh hôm nay (${today}).\n\n` +
            `Chuỗi điểm danh: ${existingCheckin.streak} ngày\n\n` +
            `Hãy quay lại vào ngày mai để tiếp tục chuỗi điểm danh!`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Calculate rewards based on streak
    const lastCheckin = db
      .prepare("SELECT * FROM chu_daily_checkins WHERE character_id = ? ORDER BY checkin_date DESC LIMIT 1")
      .get(character.id);

    let streak = 1;
    if (lastCheckin) {
      const yesterday = new Date(vietnamTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastCheckin.checkin_date === yesterdayStr) {
        streak = lastCheckin.streak + 1;
      }
    }

    // Rewards
    const spiritStoneReward = 100 + streak * 10;
    const meritReward = 10 + Math.floor(streak / 7) * 5;
    const nowUnix = Math.floor(Date.now() / 1000);

    // Create checkin and update character in transaction
    db.transaction(() => {
      db.prepare(
        `INSERT INTO chu_daily_checkins (id, guild_id, character_id, checkin_date, streak, claimed_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(`${character.id}-${today}`, guildId, character.id, today, streak, nowUnix);

      db.prepare(
        `UPDATE chu_characters SET spirit_stone = spirit_stone + ?, merit = merit + ?, updated_at = ? WHERE id = ?`
      ).run(spiritStoneReward, meritReward, nowUnix, character.id);

      // Log transactions
      db.prepare(
        `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `${character.id}-checkin-spirit-${nowUnix}`,
        guildId,
        character.id,
        "spirit_stone",
        spiritStoneReward,
        "Daily checkin",
        nowUnix
      );

      db.prepare(
        `INSERT INTO chu_transactions (id, guild_id, character_id, resource_type, amount, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `${character.id}-checkin-merit-${nowUnix}`,
        guildId,
        character.id,
        "merit",
        meritReward,
        "Daily checkin",
        nowUnix
      );
    })();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Điểm Danh Thành Công")
      .setDescription(
        `Chúc mừng đạo hữu đã điểm danh thành công!\n\n` +
          `**Ngày:** ${today}\n` +
          `**Chuỗi điểm danh:** ${streak} ngày\n\n` +
          `**Phần thưởng:**\n` +
          `💎 Linh thạch: ${spiritStoneReward}\n` +
          `🙏 Công đức: ${meritReward}\n\n` +
          `Hãy quay lại vào ngày mai để tiếp tục chuỗi điểm danh!`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Lỗi khi điểm danh:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

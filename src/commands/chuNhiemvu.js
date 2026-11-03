const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { getDailyQuests } = require("../chu-online/config/quests");

const data = new SlashCommandBuilder()
  .setName("chunhiemvu")
  .setDescription("Xem nhiệm vụ hằng ngày");

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

    const dailyQuests = getDailyQuests();
    const today = new Date().toISOString().split("T")[0];

    const questList = dailyQuests.map((quest) => {
      // Calculate progress based on activity logs and cultivation sessions
      let progress = 0;
      let completed = false;

      if (quest.activityId) {
        // Activity-based quest
        const activityLogs = db
          .prepare(
            `SELECT COUNT(*) as count FROM chu_activity_logs WHERE character_id = ? AND activity_id = ? AND created_at >= ?`
          )
          .get(character.id, quest.activityId, Math.floor(new Date(today).getTime() / 1000));
        progress = activityLogs.count;
      } else if (quest.id === 'daily_5') {
        // Cultivation session quest
        const sessions = db
          .prepare(
            `SELECT COUNT(*) as count FROM chu_cultivation_sessions WHERE character_id = ? AND status = 'claimed' AND claimed_at >= ?`
          )
          .get(character.id, Math.floor(new Date(today).getTime() / 1000));
        progress = sessions.count;
      } else if (quest.id === 'daily_1') {
        // Any temple activity
        const activityLogs = db
          .prepare(
            `SELECT COUNT(*) as count FROM chu_activity_logs WHERE character_id = ? AND created_at >= ?`
          )
          .get(character.id, Math.floor(new Date(today).getTime() / 1000));
        progress = activityLogs.count;
      }

      completed = progress >= quest.targetValue;

      const rewardText = [];
      if (quest.reward.cultivation) rewardText.push(`✨ ${quest.reward.cultivation} tu vi`);
      if (quest.reward.spiritStone) rewardText.push(`💎 ${quest.reward.spiritStone} linh thạch`);
      if (quest.reward.merit) rewardText.push(`🙏 ${quest.reward.merit} công đức`);
      if (quest.reward.daoHeart) rewardText.push(`💫 ${quest.reward.daoHeart} đạo tâm`);

      return `**${quest.name}**\n${quest.description}\nTiến độ: ${progress}/${quest.targetValue} ${completed ? '✅' : '⬜'}\nThưởng: ${rewardText.join(', ')}`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("📋 Nhiệm Vụ Hằng Ngày")
      .setDescription(
        `Ngày: ${today}\n\n` +
          `Hoàn thành các nhiệm vụ để nhận phần thưởng!\n\n` +
          questList
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Lỗi khi xem nhiệm vụ:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

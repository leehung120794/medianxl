"use strict";

const {
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { isAdminInteraction } = require("../utils/adminCheck");
const {
  runDatabaseBackup,
  deleteBackupFile,
  deleteAllBackups,
} = require("../services/databaseBackupService");
const discordBackup = require("../services/discordBackupService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Quản lý các bản backup database lưu trên VPS")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gui")
        .setDescription("Tạo và gửi backup database ngay đến Discord"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("xoa")
        .setDescription("Xóa các file backup đã lưu trên VPS")
        .addBooleanOption((option) =>
          option
            .setName("xacnhan")
            .setDescription("Xác nhận xóa các bản backup local")
            .setRequired(true),
        ),
    ),
  async execute(interaction) {
    if (!isAdminInteraction(interaction))
      return interaction.reply({
        content: "Chỉ admin mới có thể quản lý backup.",
        flags: MessageFlags.Ephemeral,
      });
    if (interaction.options.getSubcommand() === "gui") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let snapshot;
      try {
        snapshot = await runDatabaseBackup();
        const result = await discordBackup.sendDiscordBackup(
          snapshot.destination,
        );
        if (result.status === "sent" || result.status === "already_sent") {
          await deleteBackupFile(snapshot.destination);
          return interaction.editReply({
            content: "✅ Đã tạo, gửi và kiểm tra backup. File snapshot trên VPS đã được xóa.",
          });
        }
        return interaction.editReply({
          content:
            result.status === "disabled"
              ? "Chưa cấu hình người nhận backup trong DB_BACKUP_DISCORD_USER_ID. Snapshot vẫn được giữ trên VPS."
              : "Bot chưa sẵn sàng gửi backup lên Discord. Snapshot vẫn được giữ trên VPS.",
        });
      } catch (error) {
        console.error("manual database backup delivery failed", error);
        return interaction.editReply({
          content: `Không gửi được backup. Snapshot vẫn được giữ trên VPS để thử lại. ${discordBackup.getDiscordBackupStatus().lastError || "Hãy kiểm tra log bot."}`.slice(
            0,
            1900,
          ),
        });
      }
    }
    if (!interaction.options.getBoolean("xacnhan", true))
      return interaction.reply({
        content: "Đã hủy. Các bản backup trên VPS vẫn được giữ nguyên.",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const deleted = await deleteAllBackups();
      return interaction.editReply({
        content: `🧹 Đã xóa **${deleted}** file backup khỏi VPS. Database đang chạy của bot không bị xóa.`,
      });
    } catch (error) {
      console.error("manual backup cleanup failed", error);
      return interaction.editReply({
        content:
          error.message === "BACKUP_OPERATION_IN_PROGRESS"
            ? "Backup đang được tạo. Hãy thử lại sau khi tiến trình hoàn tất."
            : "Không thể dọn backup trên VPS. Các file database đang chạy được giữ nguyên.",
      });
    }
  },
};

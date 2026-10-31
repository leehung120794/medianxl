"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isAdminInteraction } = require("../utils/adminCheck");
const { syncAll } = require("../services/syncService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Admin: cập nhật database item Median XL"),
  async execute(interaction) {
    if (!isAdminInteraction(interaction))
      return interaction.reply({
        content: "Chỉ admin mới có thể cập nhật database item.",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { report, totals } = await syncAll(console);
      const succeeded = report.filter((entry) => entry.ok).length;
      const failed = report.filter((entry) => !entry.ok);
      const totalCount = Array.isArray(totals)
        ? totals.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
        : Number(totals) || 0;
      const details = failed.length
        ? `\n\n**Nguồn chưa cập nhật:**\n${failed
            .map((entry) => `• \`${entry.slug}\`: ${entry.error}`)
            .join("\n")}`
        : "";
      return interaction.editReply({
        content: `📚 Đã cập nhật **${succeeded}/${report.length}** nguồn database item. Database hiện có **${new Intl.NumberFormat("vi-VN").format(totalCount)} item**.${details}`.slice(
          0,
          1900,
        ),
      });
    } catch (error) {
      console.error("manual Median XL item update failed", error);
      return interaction.editReply({
        content:
          "Không thể cập nhật database item. Dữ liệu cũ vẫn được giữ nguyên; hãy kiểm tra log bot.",
      });
    }
  },
};

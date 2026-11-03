const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { getItemById } = require("../chu-online/config/items");

const data = new SlashCommandBuilder()
  .setName("chutuido")
  .setDescription("Xem túi đồ của bạn");

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

    const inventory = db
      .prepare(`
        SELECT ci.*, i.name, i.description
        FROM chu_inventory ci
        JOIN chu_items i ON ci.item_id = i.id
        WHERE ci.character_id = ?
      `)
      .all(character.id);

    if (inventory.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xB89B62)
        .setTitle("🎒 Túi Đồ")
        .setDescription("Túi đồ của bạn đang trống.")
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    const itemsList = inventory.map((inv) => {
      return `**${inv.name}** (x${inv.quantity})\n${inv.description}`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("🎒 Túi Đồ")
      .setDescription(itemsList)
      .setTimestamp();

    // Add use buttons for items
    const rows = inventory.map((inv) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`chu:inventory:use:${inv.item_id}`)
          .setLabel(`Sử dụng ${inv.name}`)
          .setStyle(ButtonStyle.Success)
      );
    });

    await interaction.reply({ embeds: [embed], components: rows });
  } catch (error) {
    console.error("Lỗi khi xem túi đồ:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

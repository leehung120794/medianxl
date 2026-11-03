const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { db } = require("../db");
const { ITEMS } = require("../chu-online/config/items");

const data = new SlashCommandBuilder()
  .setName("chucuahang")
  .setDescription("Mở cửa hàng để mua vật phẩm");

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

    // Initialize items in database if not exists
    for (const item of ITEMS) {
      const existing = db.prepare("SELECT * FROM chu_items WHERE id = ?").get(item.id);
      if (!existing) {
        db.prepare(
          `INSERT INTO chu_items (id, name, description, item_type, price_spirit_stone, enabled)
           VALUES (?, ?, ?, ?, ?, 1)`
        ).run(item.id, item.name, item.description, item.itemType, item.priceSpiritStone);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xB89B62)
      .setTitle("🏪 Cửa Hàng")
      .setDescription(
        `Chào mừng đạo hữu đến với cửa hàng.\n\n` +
          `💎 Linh thạch hiện có: ${character.spirit_stone}\n\n` +
          `**Danh sách vật phẩm:**`
      )
      .addFields(
        ITEMS.map((item) => ({
          name: item.name,
          value: `${item.description}\n💰 Giá: ${item.priceSpiritStone} linh thạch`,
          inline: false,
        }))
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("chu:shop:buy:dan_nghich_thien")
        .setLabel("Mua Đan Dược Nghịch Thiên")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Lỗi khi mở cửa hàng:", error);
    await interaction.reply({
      content: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };

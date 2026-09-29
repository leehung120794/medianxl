const { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { listCatalog } = require('../services/itemCatalogService');
const {
  listShopItems, upsertShopItem, editShopItem, removeShopItem, rotateShop,
  setShopStock, setShopDiscount,
} = require('../services/shopService');
const { formatCoins } = require('../utils/economy');

const RARITY_ICON = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟠', mythic: '🔴' };
function isAdmin(interaction) {
  const ids = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  return ids.includes(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}
function itemOption(option, description = 'Mã vật phẩm trong shop') { return option.setName('item').setDescription(description).setRequired(true).setAutocomplete(true); }
function conditionOptions(command) {
  return command
    .addIntegerOption(o => o.setName('min_games').setDescription('Số ván tối thiểu').setMinValue(0).setMaxValue(1000000))
    .addIntegerOption(o => o.setName('min_wins').setDescription('Số trận thắng tối thiểu').setMinValue(0).setMaxValue(1000000))
    .addIntegerOption(o => o.setName('min_balance').setDescription('Số dư tối thiểu').setMinValue(0).setMaxValue(1000000));
}
function shopEmbed(guildId) {
  const items = listShopItems(guildId);
  const description = items.length ? items.map(row => {
    const item = row.catalog;
    const price = row.final_price < row.price ? `~~${formatCoins(row.price)}~~ **${formatCoins(row.final_price)} xu**` : `**${formatCoins(row.price)} xu**`;
    const stock = row.stock === null ? '∞' : Math.max(0, row.stock - row.sold_count);
    const conditions = [row.min_games ? `${row.min_games} ván` : null, row.min_wins ? `${row.min_wins} thắng` : null, row.min_balance ? `số dư ${formatCoins(row.min_balance)}` : null].filter(Boolean).join(' · ');
    return `${RARITY_ICON[item?.rarity] || '⚪'} **${row.display_name}** · \`${row.item_id}\`\n${item?.description || ''}\n💰 ${price} · Kho: **${stock}**${conditions ? ` · Yêu cầu: ${conditions}` : ''}`;
  }).join('\n\n') : 'Cửa hàng chưa có vật phẩm.';
  return new EmbedBuilder().setColor(0xC0392B).setTitle('🏪 CỬA HÀNG SANCTUARY').setDescription(description.slice(0, 4096))
    .setFooter({ text: 'Cửa hàng tự xoay mỗi ngày • Dùng /buy để mua' });
}

module.exports = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Xem và quản lý cửa hàng')
    .addSubcommand(c => c.setName('xem').setDescription('Mở cửa hàng hiện tại'))
    .addSubcommand(c => conditionOptions(c.setName('add').setDescription('Admin: đưa hiệu ứng có sẵn vào shop')
      .addStringOption(o => o.setName('effect').setDescription('Hiệu ứng/vật phẩm có sẵn').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName('price').setDescription('Giá bán; bỏ trống để dùng giá đề xuất').setMinValue(1).setMaxValue(100000000))
      .addStringOption(o => o.setName('name').setDescription('Tên hiển thị riêng').setMaxLength(80))
      .addIntegerOption(o => o.setName('stock').setDescription('Tồn kho; 0 là không giới hạn').setMinValue(0).setMaxValue(1000000))))
    .addSubcommand(c => conditionOptions(c.setName('edit').setDescription('Admin: sửa tên, giá và điều kiện')
      .addStringOption(itemOption)
      .addStringOption(o => o.setName('name').setDescription('Tên hiển thị mới').setMaxLength(80))
      .addIntegerOption(o => o.setName('price').setDescription('Giá mới').setMinValue(1).setMaxValue(100000000))))
    .addSubcommand(c => c.setName('remove').setDescription('Admin: gỡ vật phẩm khỏi shop').addStringOption(itemOption))
    .addSubcommand(c => c.setName('rotate').setDescription('Admin: xoay cửa hàng ngay')
      .addIntegerOption(o => o.setName('size').setDescription('Số món hiển thị').setMinValue(6).setMaxValue(10)))
    .addSubcommand(c => c.setName('stock').setDescription('Admin: đặt lại tồn kho')
      .addStringOption(itemOption).addIntegerOption(o => o.setName('quantity').setDescription('0 là không giới hạn').setRequired(true).setMinValue(0).setMaxValue(1000000)))
    .addSubcommand(c => c.setName('discount').setDescription('Admin: đặt giảm giá')
      .addStringOption(itemOption)
      .addIntegerOption(o => o.setName('percent').setDescription('0 để hủy; tối đa 90%').setRequired(true).setMinValue(0).setMaxValue(90))
      .addIntegerOption(o => o.setName('hours').setDescription('Thời hạn giờ; 0 là không hết hạn').setMinValue(0).setMaxValue(8760))),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const query = String(focused.value || '').toLowerCase();
    const values = focused.name === 'effect'
      ? listCatalog({ shopEligible: true }).map(item => ({ id: item.id, name: `${item.name} · ${item.effect}` }))
      : listShopItems(interaction.guildId, { activeOnly: false }).map(row => ({ id: row.item_id, name: `${row.display_name} · ${row.active ? 'đang bán' : 'đang ẩn'}` }));
    return interaction.respond(values.filter(x => `${x.id} ${x.name}`.toLowerCase().includes(query)).slice(0, 25).map(x => ({ name: x.name.slice(0, 100), value: x.id })));
  },
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'xem') return interaction.reply({ embeds: [shopEmbed(interaction.guildId)] });
    if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được quản lý cửa hàng.', flags: MessageFlags.Ephemeral });
    let item;
    if (sub === 'add') item = upsertShopItem({ guildId: interaction.guildId, catalogId: interaction.options.getString('effect', true),
      displayName: interaction.options.getString('name'), price: interaction.options.getInteger('price'), stock: interaction.options.getInteger('stock'),
      minGames: interaction.options.getInteger('min_games') || 0, minWins: interaction.options.getInteger('min_wins') || 0,
      minBalance: interaction.options.getInteger('min_balance') || 0, createdBy: interaction.user.id });
    else if (sub === 'edit') item = editShopItem(interaction.guildId, interaction.options.getString('item', true), {
      displayName: interaction.options.getString('name'), price: interaction.options.getInteger('price'),
      minGames: interaction.options.getInteger('min_games'), minWins: interaction.options.getInteger('min_wins'),
      minBalance: interaction.options.getInteger('min_balance'), adminId: interaction.user.id });
    else if (sub === 'remove') {
      const removed = removeShopItem(interaction.guildId, interaction.options.getString('item', true));
      return interaction.reply({ content: removed ? '✅ Đã gỡ vật phẩm khỏi shop.' : 'Không tìm thấy vật phẩm.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'rotate') {
      const rows = rotateShop(interaction.guildId, interaction.options.getInteger('size') || 8);
      return interaction.reply({ content: `🔄 Đã xoay cửa hàng với **${rows.length} vật phẩm**.`, embeds: [shopEmbed(interaction.guildId)], flags: MessageFlags.Ephemeral });
    } else if (sub === 'stock') item = setShopStock(interaction.guildId, interaction.options.getString('item', true), interaction.options.getInteger('quantity', true));
    else if (sub === 'discount') item = setShopDiscount(interaction.guildId, interaction.options.getString('item', true), interaction.options.getInteger('percent', true), interaction.options.getInteger('hours') || 0);
    return interaction.reply({ content: `✅ Đã cập nhật **${item.display_name}** · giá hiện tại **${formatCoins(item.final_price)} xu**.`, flags: MessageFlags.Ephemeral });
  },
  shopEmbed,
};

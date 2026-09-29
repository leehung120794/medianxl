const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { COLLECTIBLES } = require('../services/itemCatalogService');
const { craftCollectible, collectionProgress } = require('../services/shopService');
module.exports = {
  data: new SlashCommandBuilder().setName('craft').setDescription('Chế tạo thẻ bằng Mảnh linh hồn')
    .addStringOption(o => o.setName('item').setDescription('Thẻ muốn chế tạo').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const q = String(interaction.options.getFocused() || '').toLowerCase();
    const owned = collectionProgress(interaction.guildId, interaction.user.id).owned;
    return interaction.respond(COLLECTIBLES.filter(x => !owned.has(x.id) && `${x.id} ${x.name}`.toLowerCase().includes(q)).slice(0, 25)
      .map(x => ({ name: `${x.name} · ${x.craftCost} mảnh`.slice(0, 100), value: x.id })));
  },
  async execute(interaction) {
    try {
      const result = craftCollectible(interaction.guildId, interaction.user.id, interaction.options.getString('item', true));
      return interaction.reply({ content: `🛠️ Đã chế tạo **${result.item.name}** với **${result.cost} Mảnh linh hồn**.${result.discounted ? ' 🔨 Búa Thợ Rèn đã giảm 25% chi phí.' : ''} Còn lại: **${result.shards}**.` });
    } catch (error) {
      const content = error.message === 'ITEM_NOT_OWNED' ? 'Bạn không đủ Mảnh linh hồn.' : error.message === 'ALREADY_OWNED' ? 'Bạn đã sở hữu thẻ này.' : 'Vật phẩm không thể chế tạo.';
      return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  },
};

const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { getInventory } = require('../services/shopService');
const { useItem } = require('../services/itemEffectService');
module.exports = {
  data: new SlashCommandBuilder().setName('use').setDescription('Sử dụng hoặc trang bị vật phẩm')
    .addStringOption(o => o.setName('item').setDescription('Vật phẩm trong kho').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const q = String(interaction.options.getFocused() || '').toLowerCase();
    return interaction.respond(getInventory(interaction.guildId, interaction.user.id).filter(x => !['collectible', 'material'].includes(x.item.type) && `${x.item_id} ${x.item.name}`.toLowerCase().includes(q)).slice(0, 25)
      .map(x => ({ name: `${x.item.name} ×${x.quantity}`.slice(0, 100), value: x.item_id })));
  },
  async execute(interaction) {
    try {
      const result = useItem({ guildId: interaction.guildId, userId: interaction.user.id, channelId: interaction.channelId, itemId: interaction.options.getString('item', true) });
      return interaction.reply({ content: result.message, flags: result.ephemeral ? MessageFlags.Ephemeral : undefined });
    } catch (error) {
      const map = { ITEM_NOT_OWNED: 'Bạn không sở hữu vật phẩm này.', WRONG_EFFECT_CHANNEL: 'Vật phẩm phải dùng trong đúng channel game hỗ trợ.', NO_ACTIVE_GAME: 'Channel này chưa có câu hỏi đang hoạt động.', NO_ACTIVE_MINES: 'Bạn chưa có ván Mines đang hoạt động trong channel này.', ITEM_NOT_USABLE: 'Vật phẩm này không thể sử dụng trực tiếp.' };
      return interaction.reply({ content: map[error.message] || 'Không thể sử dụng vật phẩm lúc này.', flags: MessageFlags.Ephemeral });
    }
  },
};

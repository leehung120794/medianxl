const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { collectionProgress, getInventoryQuantity } = require('../services/shopService');
const GROUP_NAMES = { boss: 'BOSS', class: 'CLASS', pet: 'PET', relic: 'RELIC', charm: 'CHARM', set: 'SACRED SET' };
module.exports = {
  data: new SlashCommandBuilder().setName('collection').setDescription('Xem bộ sưu tập Median XL').addUserOption(o => o.setName('user').setDescription('Người chơi cần xem')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    if (user.bot) return interaction.reply({ content: 'Bot không có bộ sưu tập.', flags: MessageFlags.Ephemeral });
    const progress = collectionProgress(interaction.guildId, user.id);
    const groups = new Map();
    for (const item of progress.items) { const list = groups.get(item.collection) || []; list.push(`${progress.owned.has(item.id) ? '✅' : '⬛'} ${item.name} · ${item.rarity}`); groups.set(item.collection, list); }
    const shards = getInventoryQuantity(interaction.guildId, user.id, 'soul_shard');
    const embed = new EmbedBuilder().setColor(0xD35400).setTitle(`📚 BỘ SƯU TẬP · ${user.globalName || user.username}`)
      .setDescription([...groups].map(([name, items]) => `**${GROUP_NAMES[name] || name.toUpperCase()}**\n${items.join('\n')}`).join('\n\n'))
      .setFooter({ text: `${progress.count}/${progress.total} thẻ • ${shards} Mảnh linh hồn • Dùng /craft để chế tạo` });
    return interaction.reply({ embeds: [embed] });
  },
};

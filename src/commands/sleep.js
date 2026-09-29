const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { searchItems } = require('../services/searchService');
const { normalizeSearch } = require('../utils/text');

function getSleepItem() {
  return searchItems({ query: 'the sleep', type: 'SLEEP', limit: 1 })[0] || null;
}

function awakeningLines(item) {
  return (item?.stats || []).filter(line => /^Awakening\s+—/i.test(line));
}

function trophyName(line) {
  return line.replace(/^Awakening\s+—\s*/i, '').split(':')[0].trim();
}

function renderBonusEmbed(item, matches, query) {
  const embed = new EmbedBuilder()
    .setColor(0x8E44AD)
    .setTitle(`[SLEEP] The Sleep — Awakening Bonus`)
    .setDescription(`Nymyr's Light · Reward: The Sleep\nTừ khóa: **${query}**`)
    .addFields({ name: 'Dungeon', value: "Nymyr's Light", inline: true }, { name: 'Reward type', value: 'Dungeon Charm', inline: true }, { name: 'Bonus tìm thấy', value: matches.map(x => x.replace(/^Awakening\s+—\s*/i, '')).join('\n').slice(0, 1024) })
    .setFooter({ text: 'SLEEP · Median XL' });
  if (item.image_url) embed.setThumbnail(item.image_url);
  if (item.source_url) embed.setURL(item.source_url);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder().setName('sleep').setDescription("Search The Sleep awakening bonuses")
    .addStringOption(o => o.setName('query').setDescription('Tên Trophy màu vàng hoặc từ khóa, ví dụ lord of lies').setRequired(false).setAutocomplete(true)),
  async autocomplete(interaction) {
    const typed = normalizeSearch(interaction.options.getString('query') || '');
    const item = getSleepItem();
    const names = [...new Map(awakeningLines(item).map(line => [normalizeSearch(trophyName(line)), trophyName(line)])).entries()];
    const choices = names.filter(([key]) => !typed || key.includes(typed)).slice(0, 25).map(([value, name]) => ({ name, value }));
    return interaction.respond(choices);
  },
  async execute(interaction) {
    const query = interaction.options.getString('query');
    if (!query?.trim()) return interaction.reply({ content: 'Vui lòng nhập từ khóa Trophy màu vàng để tìm bonus, ví dụ: `lord of lies`, `lies` hoặc `yshari`.', flags: MessageFlags.Ephemeral });
    const item = getSleepItem();
    const q = normalizeSearch(query);
    const matches = awakeningLines(item).filter(line => normalizeSearch(line).includes(q));
    if (!matches.length) return interaction.reply({ content: `Không tìm thấy bonus awakening cho **${query}**. Hãy thử tên Trophy như \'Lord of Lies\' hoặc \'Yshari Sanctum\'.`, flags: MessageFlags.Ephemeral });
    return interaction.reply({ embeds: [renderBonusEmbed(item, matches, query)] });
  },
};

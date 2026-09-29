const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { autocompleteItems, getItemById } = require('../services/searchService');

function damageText(item) {
  const stats = item.stats || [];
  const index = stats.findIndex(line => /^(?:One-Hand|Two-Hand|Throw) Damage\s*:/i.test(line));
  if (index < 0) return null;
  const line = stats[index];
  if (!/:\s*$/.test(line)) return line.replace(/^[^:]+:\s*/, '');
  return stats[index + 1] || null;
}

function visibleStats(item) {
  const stats = item.stats || [];
  return stats.filter((line, index) => {
    if (String(line).trim().toLowerCase() === String(item.name).trim().toLowerCase()) return false;
    if (/^(?:Required (?:Level|Strength|Dexterity|Vitality|Energy)|Item Level)\s*:/i.test(line)) return false;
    if (/^(?:One-Hand|Two-Hand|Throw) Damage\s*:/i.test(line)) return false;
    if (/^Defense\s*:/i.test(line) || /^Socketed\s*\(/i.test(line)) return false;
    const previous = stats[index - 1] || '';
    if (/^(?:One-Hand|Two-Hand|Throw) Damage\s*:\s*$/i.test(previous) && /^[\d()\s–-]+to[\d()\s–-]+$/i.test(line)) return false;
    return !/^(?:Relic|Mystic Orb)$/i.test(line);
  });
}

function itemColumn(item) {
  const requirements = item.requirements || {};
  const details = [
    `**Type:** ${item.type_code}`,
    `**Base:** ${item.base_type || '—'}`,
    `**Variant:** ${item.tier_or_variant || '—'}`,
    `**Required Level:** ${requirements.requiredLevel ?? '—'}`,
    requirements.requiredStrength != null ? `**Strength:** ${requirements.requiredStrength}` : null,
    requirements.requiredDexterity != null ? `**Dexterity:** ${requirements.requiredDexterity}` : null,
    damageText(item) ? `**Damage:** ${damageText(item)}` : null,
    item.socket_count != null ? `**Sockets:** ${item.socket_count}` : null,
    '',
    '**Stats**',
    ...visibleStats(item).map(line => `• ${line}`),
    item.source_url ? `\n[Source page](${item.source_url})` : null,
  ].filter(line => line !== null);
  const value = details.join('\n');
  if (value.length <= 1024) return value;
  return `${value.slice(0, 970)}\n… Use \`/item\` to view the full item.`;
}

function comparisonEmbed(left, right) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'Median XL · Item comparison' })
    .setTitle('Side-by-side items')
    .setDescription(`① **${left.name}**\n② **${right.name}**`)
    .addFields(
      { name: `① ${left.name}`.slice(0, 256), value: itemColumn(left), inline: true },
      { name: `② ${right.name}`.slice(0, 256), value: itemColumn(right), inline: true },
    )
    .setFooter({ text: 'Use /item to view either item in full detail' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder().setName('compare').setDescription('Display two Median XL items side by side')
    .addStringOption(o => o.setName('item_1').setDescription('First item').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('item_2').setDescription('Second item').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    const choices = autocompleteItems({ query, type: 'ALL', limit: 25 }).map(item => ({
      name: `[${item.type_code}] ${item.name}${item.base_type ? ` · ${item.base_type}` : ''}`.slice(0, 100),
      value: String(item.id),
    }));
    return interaction.respond(choices);
  },

  async execute(interaction) {
    const left = getItemById(Number(interaction.options.getString('item_1')));
    const right = getItemById(Number(interaction.options.getString('item_2')));
    if (!left || !right) return interaction.reply({ content: 'One or both items could not be found. Please select items from autocomplete.', flags: MessageFlags.Ephemeral });
    if (left.id === right.id) return interaction.reply({ content: 'Please select two different items.', flags: MessageFlags.Ephemeral });
    return interaction.reply({ embeds: [comparisonEmbed(left, right)] });
  },

  comparisonEmbed,
  itemColumn,
};

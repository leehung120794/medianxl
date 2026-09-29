const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const META = {
  TU: { label: 'Tiered Unique', color: 0xD4A72C, emoji: '◆' }, SU: { label: 'Sacred Unique', color: 0x9B59B6, emoji: '✦' }, RW: { label: 'Runeword', color: 0x3498DB, emoji: '◈' }, SET: { label: 'Set', color: 0x2ECC71, emoji: '●' }, UMO: { label: 'Unique Mystic Orb', color: 0xE67E22, emoji: '◇' }, CYCLE: { label: 'Cycle', color: 0xF1C40F, emoji: '↻' }, RELIC: { label: 'Relic', color: 0x1ABC9C, emoji: '✧' }, TROPHY: { label: 'Trophy', color: 0xE74C3C, emoji: '♜' }, SLEEP: { label: "Nymyr's Light Reward", color: 0x8E44AD, emoji: '☾' },
};
const safeUrl = (value, source) => { try { return value ? new URL(value, source).href : null; } catch { return null; } };
const field = (name, value, inline = true) => ({ name, value: String(value ?? 'Not listed').slice(0, 1024), inline });

function chunks(lines, max = 1000) {
  const out = []; let current = '';
  for (const line of lines.filter(Boolean)) {
    if ((current + '\n' + line).length > max) { if (current) out.push(current); current = line; } else current = current ? `${current}\n${line}` : line;
  }
  if (current) out.push(current);
  return out.length ? out : ['No stats listed'];
}

function typeFields(item) {
  const stats = item.stats || [];
  switch (item.type_code) {
    case 'TU': return [field('Tier', item.tier_or_variant || 'Highest available'), field('Base item', item.base_type)];
    case 'SU': return [field('Base item', item.base_type), field('Variant', item.tier_or_variant || item.group_name)];
    case 'RW': return [field('Base item', item.base_type || 'Any allowed base'), field('Rune sequence', item.tier_or_variant), field('Runes', stats.find(x => /^Runes:/i.test(x))?.replace(/^Runes:\s*/i, ''))];
    case 'SET': return [field('Set', item.group_name || 'Set item'), field('Base item', item.base_type)];
    case 'UMO': return [field('Orb type', item.group_name || 'Unique Mystic Orb'), field('Limit per item', item.limit_per_item)];
    case 'CYCLE': return [field('Cycle', item.tier_or_variant || item.group_name || 'Cycle'), field('Use', item.apply_text || 'See stats')];
    case 'RELIC': return [field('Relic category', item.group_name || 'Relic'), field('Effect', 'Skill and stat bonuses')];
    case 'TROPHY': return [field('Trophy group', item.group_name || 'Trophy'), field('Use', 'See cube recipe')];
    case 'SLEEP': return [field('Dungeon', "Nymyr's Light"), field('Reward', 'The Sleep awakening bonus')];
    default: return [];
  }
}

function isSectionHeader(line) {
  return /^(on striking|on attack|when you|chance to|awakening\s+—|requirements?|socketed|class|damage|defense|.+:)$/i.test(line.trim());
}
function formatStats(lines) {
  const visible = lines.filter(Boolean).map(line => String(line).trim()).filter(Boolean);
  if (!visible.length) return ['No stats listed'];
  const formatted = [];
  visible.forEach((line, index) => {
    const previous = visible[index - 1];
    if (index > 0 && (isSectionHeader(line) || isSectionHeader(previous))) formatted.push('');
    formatted.push(line);
    if (index < visible.length - 1 && !isSectionHeader(line) && !isSectionHeader(visible[index + 1])) formatted.push('');
  });
  return formatted;
}

function detailEmbeds(item) {
  const meta = META[item.type_code] || { label: 'Item', color: 0x5865F2, emoji: '•' };
  const requirements = Object.entries(item.requirements || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `**${k}:** ${v}`).join('\n') || 'None listed';
  const rawStats = [item.apply_text, ...(item.stats || [])].filter(Boolean).filter(x => !/^Runes:/i.test(x) && x !== item.tier_or_variant && !/^Required Level:/i.test(x));
  if (item.limit_per_item != null) rawStats.push(`Limit per item: ${item.limit_per_item}`);
  const statChunks = chunks(formatStats(rawStats));
  return statChunks.map((stats, index) => {
    const subtitle = [item.base_type, item.group_name, item.tier_or_variant].filter(Boolean).join(' · ') || meta.label;
    const embed = new EmbedBuilder().setColor(meta.color).setAuthor({ name: `${meta.emoji} Median XL · ${meta.label}` }).setTitle(item.name).setDescription(`**${item.type_code}**  ·  ${subtitle}`).addFields({ name: 'Category', value: meta.label, inline: true }, ...typeFields(item), field('Requirements', requirements, false), field(index ? 'Stats (continued)' : 'Stats', stats, false)).setFooter({ text: `Median XL Database · ${item.type_code}${index ? ` · Page ${index + 1}` : ''}` }).setTimestamp();
    const image = safeUrl(item.image_url, item.source_url); if (image) embed.setThumbnail(image); if (item.source_url) embed.setURL(item.source_url); return embed;
  });
}

function suggestionResponse(results, query, ownerId, page = 0) {
  const pageSize = 25; const totalPages = Math.max(1, Math.ceil(results.length / pageSize)); const currentPage = Math.max(0, Math.min(page, totalPages - 1)); const pageItems = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const options = pageItems.map(x => ({ label: `[${x.type_code}] ${x.name}`.slice(0, 100), description: [x.base_type, x.group_name, x.tier_or_variant].filter(Boolean).join(' · ').slice(0, 100) || 'Median XL item', value: String(x.id) }));
  const list = pageItems.slice(0, 10).map((x, i) => `${currentPage * pageSize + i + 1}. **[${x.type_code}] ${x.name}**\n   ${[x.base_type, x.group_name, x.tier_or_variant].filter(Boolean).join(' · ') || 'Median XL item'}`).join('\n');
  const embed = new EmbedBuilder().setColor(0x5865F2).setAuthor({ name: 'Median XL Search' }).setTitle('Các item phù hợp').setDescription(`Từ khóa: **${query}**\nChọn item để xem chi tiết.`).addFields({ name: `Suggestions · Trang ${currentPage + 1}/${totalPages}`, value: (list || 'Không có suggestion').slice(0, 1024) }).setFooter({ text: `${results.length} kết quả · Chỉ người gọi lệnh được chọn` });
  const menu = new StringSelectMenuBuilder().setCustomId(`item-pick:${ownerId}`).setPlaceholder('Chọn item để xem embed').addOptions(options);
  const previous = new ButtonBuilder().setCustomId(`item-page:${ownerId}:${currentPage - 1}`).setLabel('Trước').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0);
  const next = new ButtonBuilder().setCustomId(`item-page:${ownerId}:${currentPage + 1}`).setLabel('Sau').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1);
  const close = new ButtonBuilder().setCustomId(`item-close:${ownerId}`).setLabel('Đóng').setStyle(ButtonStyle.Danger);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(previous, next, close)] };
}
module.exports = { detailEmbeds, suggestionResponse, META, formatStats };

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { calculate, autocompleteWeapons, chars, skillSlows } = require('../services/speedcalcService');

const charChoices = [...new Map(chars.map(x => [x.id, { name: x.label, value: x.id }])).values()].slice(0, 25);
const modeChoices = [
  { name: 'Attack Speed', value: 'attack' },
  { name: 'Cast Speed', value: 'cast' },
  { name: 'Block Speed', value: 'block' },
  { name: 'Hit Recovery', value: 'recovery' },
];
const slowChoices = skillSlows.map(x => ({ name: `${x.label} (${x.value})`, value: String(x.value) }));

const data = new SlashCommandBuilder()
  .setName('breakpoint')
  .setDescription('Tính breakpoint Attack, Cast, Block hoặc Hit Recovery của Median XL')
  .addStringOption(o => o.setName('character').setDescription('Character hoặc morph').setRequired(true).addChoices(...charChoices))
  .addStringOption(o => o.setName('mode').setDescription('Loại breakpoint cần tính').setRequired(true).addChoices(...modeChoices))
  .addStringOption(o => o.setName('weapon').setDescription('Weapon Base, dùng autocomplete').setRequired(true).setAutocomplete(true))
  .addIntegerOption(o => o.setName('speed').setDescription('Attack/Cast/Block/Recovery speed hiện tại').setRequired(true).setMinValue(0).setMaxValue(1000))
  .addStringOption(o => o.setName('skill_slow').setDescription('Skill Slow đang áp dụng').setRequired(false).addChoices(...slowChoices));

function formatBreakpoints(result) {
  if (!result.breakpoints.length) return 'Không còn breakpoint nhanh hơn trong phạm vi bảng.';
  return result.breakpoints.map(x => `**${x.frame} frames** → ${x.speed} speed${x.gain ? ` (+${x.gain})` : ''}`).join('\n');
}

async function execute(interaction) {
  const character = interaction.options.getString('character');
  const mode = interaction.options.getString('mode');
  const weapon = interaction.options.getString('weapon');
  const speed = interaction.options.getInteger('speed');
  const skillSlow = Number(interaction.options.getString('skill_slow') || 0);
  const result = calculate({ character, mode, weapon, speed, skillSlow });
  const modeLabel = modeChoices.find(x => x.value === result.mode)?.name || result.mode;
  const slowLabel = skillSlows.find(x => x.value === skillSlow)?.label || String(skillSlow);
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Median XL · Speed Calculator' })
    .setTitle(`${result.character.label} · ${modeLabel}`)
    .setDescription(`**Weapon Base:** ${result.weapon.label}\n**WSM:** ${result.weapon.wsm}\n**Skill Slow:** ${slowLabel} (${skillSlow})`)
    .addFields(
      { name: 'Current breakpoint', value: `**${result.current.frame} frames** at **${result.current.speed} speed**`, inline: false },
      { name: 'Previous slower breakpoint', value: result.previous ? `${result.previous.frame} frames at ${result.previous.speed} speed` : 'Already at the slowest listed point', inline: true },
      { name: 'Next breakpoint', value: result.next[0] ? `${result.next[0].frame} frames at ${result.next[0].speed} speed\nNeed **+${result.next[0].gain}** more` : 'No faster breakpoint found', inline: true },
      { name: 'Breakpoint table', value: formatBreakpoints(result), inline: false },
    )
    .setFooter({ text: 'Median XL Speed Calculator data · Use /breakpoint again to recalculate' })
    .setTimestamp();
  if (result.source) embed.setURL(result.source);
  await interaction.reply({ embeds: [embed] });
}

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused();
  await interaction.respond(autocompleteWeapons(focused).map(x => ({ name: `${x.label} (WSM ${x.wsm})`.slice(0, 100), value: x.label })).slice(0, 25));
}
module.exports = { data, execute, autocomplete };

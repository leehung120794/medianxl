const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSeasonLeaderboard, getGameLeaderboard, claimSeasonReward, seasonKey } = require('../services/progressionService');
const { MessageFlags } = require('discord.js');
const { formatCoins } = require('../utils/economy');

const GAMES = [
  ['noitu', 'Nối từ'], ['vuatiengviet', 'Vua tiếng Việt'], ['doanitem', 'Đoán item'], ['baucua', 'Bầu cua'],
  ['taixiu', 'Tài xỉu'], ['oantuti', 'Oẳn tù tì'], ['blackjack', 'Blackjack'], ['duangua', 'Đua ngựa'],
  ['mines', 'Mines'], ['hardcore', 'Hardcore Run'],
];
const GAME_LABELS = Object.fromEntries(GAMES);

module.exports = {
  data: new SlashCommandBuilder().setName('xephang').setDescription('Bảng xếp hạng mùa game')
    .addSubcommand(command => command.setName('mua').setDescription('Xem bảng xếp hạng mùa hiện tại'))
    .addSubcommand(command => command.setName('game').setDescription('Xem bảng xếp hạng riêng của một game')
      .addStringOption(option => option.setName('trochoi').setDescription('Game cần xem').setRequired(true)
        .addChoices(...GAMES.map(([value, name]) => ({ name, value })))))
    .addSubcommand(command => command.setName('nhan').setDescription('Nhận thưởng top 10 của mùa trước')),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'nhan') {
      try {
        const reward = claimSeasonReward(interaction.guildId, interaction.user.id);
        return interaction.reply({ content: `🏆 Hạng **#${reward.rank} mùa ${reward.season}**: nhận **${formatCoins(reward.coins)} xu** và **1 ${reward.item === 'premium_chest' ? 'Hòm Nephalem' : 'Hòm Sanctuary'}**.` });
      } catch (error) {
        const content = error.message === 'ALREADY_CLAIMED' ? 'Bạn đã nhận thưởng mùa trước.' : 'Bạn không nằm trong top 10 mùa trước hoặc mùa trước chưa có dữ liệu.';
        return interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
    if (subcommand === 'game') {
      const game = interaction.options.getString('trochoi', true);
      const rows = getGameLeaderboard(interaction.guildId, game, 10);
      const description = rows.length ? rows.map((row, index) => {
        const rate = row.played ? Math.round(row.wins / row.played * 100) : 0;
        return `${index + 1}. <@${row.user_id}> — **${row.wins} thắng** · ${row.played} lượt · ${rate}%`;
      }).join('\n') : 'Game này chưa có dữ liệu xếp hạng.';
      const embed = new EmbedBuilder().setColor(0xE67E22).setTitle(`🏆 ${GAME_LABELS[game] || game.toUpperCase()}`).setDescription(description)
        .setFooter({ text: 'Xếp theo số lượt thắng, sau đó đến tỷ lệ thắng' }).setTimestamp();
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
    const rows = getSeasonLeaderboard(interaction.guildId, 10);
    const description = rows.length ? rows.map((row, index) => `${index + 1}. <@${row.user_id}> — **${row.points} điểm** · ${row.wins}/${row.games} thắng`).join('\n') : 'Chưa có người chơi trong mùa này.';
    const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle(`🏆 MÙA ${seasonKey()}`).setDescription(description)
      .setFooter({ text: 'Mỗi ván +3 điểm, mỗi chiến thắng thêm +12 điểm' }).setTimestamp();
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

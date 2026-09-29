const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getAccount, claimDaily, getLeaderboard, getTransactionHistory, transferCoins } = require('../services/economyService');
const { formatCoins, cooldownText } = require('../utils/economy');

const GAME_LABELS = { noitu: 'Nối từ', vuatiengviet: 'Vua tiếng Việt', doanitem: 'Đoán item', baucua: 'Bầu cua', taixiu: 'Tài xỉu', oantuti: 'Oẳn tù tì', blackjack: 'Blackjack', duangua: 'Đua ngựa', mines: 'Mines', hardcore: 'Hardcore Run' };
function transactionLabel(reason) {
  const value = String(reason || '');
  if (value === 'daily') return 'Quà xu hằng ngày';
  if (value.startsWith('transfer:to:')) return `Chuyển cho <@${value.slice(12)}>`;
  if (value.startsWith('transfer:from:')) return `Nhận từ <@${value.slice(14)}>`;
  if (value.startsWith('shop:')) return `Mua vật phẩm ${value.slice(5)}`;
  if (value.startsWith('checkin:')) return 'Điểm danh';
  if (value.startsWith('mission:')) return 'Phần thưởng nhiệm vụ';
  if (value.startsWith('season:')) return 'Phần thưởng mùa';
  if (value.startsWith('boss:')) return 'Phần thưởng boss cộng đồng';
  if (value.startsWith('admin-remove:')) return 'Admin trừ xu';
  if (value.startsWith('admin:')) return 'Admin cộng xu';
  const [game, outcome] = value.split(':');
  if (GAME_LABELS[game]) {
    const outcomeLabel = { win: 'thắng', loss: 'thua', draw: 'hòa', reserve: 'đặt cược', double: 'gấp đôi', split: 'tách bài' }[outcome] || outcome;
    return `${GAME_LABELS[game]} · ${outcomeLabel}`;
  }
  return value || 'Giao dịch';
}

module.exports = {
  data: new SlashCommandBuilder().setName('xu').setDescription('Quản lý xu game của server')
    .addSubcommand(command => command.setName('sodu').setDescription('Xem số xu hiện tại'))
    .addSubcommand(command => command.setName('daily').setDescription('Nhận xu miễn phí mỗi ngày'))
    .addSubcommand(command => command.setName('lichsu').setDescription('Xem 10 giao dịch xu gần nhất'))
    .addSubcommand(command => command.setName('top').setDescription('Xem bảng xếp hạng xu'))
    .addSubcommand(command => command.setName('chuyen').setDescription('Chuyển xu cho người chơi khác')
      .addUserOption(option => option.setName('user').setDescription('Người nhận').setRequired(true))
      .addIntegerOption(option => option.setName('xu').setDescription('Số xu muốn chuyển').setRequired(true).setMinValue(1).setMaxValue(100000))),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Lệnh này chỉ dùng được trong server.', flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'sodu') {
      const account = getAccount(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: `Bạn đang có **${formatCoins(account.balance)} xu**. Dùng \`/hoso\` để xem profile đầy đủ.`, flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'daily') {
      const result = claimDaily(interaction.guildId, interaction.user.id);
      if (!result.ok) return interaction.reply({ content: `Bạn đã nhận xu hôm nay. Có thể nhận lại sau **${cooldownText(result.remaining)}**.`, flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: `🎁 Bạn nhận được **${formatCoins(result.amount)} xu**. Số dư mới: **${formatCoins(result.account.balance)} xu**.` });
    }
    if (subcommand === 'lichsu') {
      const rows = getTransactionHistory(interaction.guildId, interaction.user.id, 10);
      const description = rows.length ? rows.map(row => {
        const amount = `${row.amount >= 0 ? '+' : ''}${formatCoins(row.amount)}`;
        return `${row.amount >= 0 ? '🟢' : '🔴'} **${amount} xu** · ${transactionLabel(row.reason)}\n<t:${Math.floor(row.created_at / 1000)}:R> · Còn ${formatCoins(row.balance_after)} xu`;
      }).join('\n\n') : 'Bạn chưa có giao dịch nào.';
      const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('📜 LỊCH SỬ XU').setDescription(description).setFooter({ text: 'Hiển thị 10 giao dịch gần nhất' });
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    }
    if (subcommand === 'chuyen') {
      const receiver = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('xu', true);
      if (receiver.bot) return interaction.reply({ content: 'Không thể chuyển xu cho bot.', flags: MessageFlags.Ephemeral });
      if (receiver.id === interaction.user.id) return interaction.reply({ content: 'Bạn không thể tự chuyển xu cho chính mình.', flags: MessageFlags.Ephemeral });
      let result;
      try { result = transferCoins({ guildId: interaction.guildId, fromUserId: interaction.user.id, toUserId: receiver.id, amount }); }
      catch (error) {
        if (error.code === 'INSUFFICIENT_FUNDS') return interaction.reply({ content: `Bạn không đủ xu. Số dư hiện tại: **${formatCoins(error.balance)} xu**.`, flags: MessageFlags.Ephemeral });
        throw error;
      }
      return interaction.reply({ content: `💸 <@${interaction.user.id}> đã chuyển **${formatCoins(result.amount)} xu** cho <@${receiver.id}>. Số dư còn lại: **${formatCoins(result.senderBalance)} xu**.`, allowedMentions: { users: [receiver.id] } });
    }
    const leaders = getLeaderboard(interaction.guildId, 10);
    const description = leaders.length
      ? leaders.map((account, index) => `${index + 1}. <@${account.user_id}> — **${formatCoins(account.balance)} xu**`).join('\n')
      : 'Chưa có người chơi nào.';
    const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🏆 BẢNG XẾP HẠNG XU').setDescription(description).setFooter({ text: 'Xu và bảng xếp hạng được tính riêng cho server này' }).setTimestamp();
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

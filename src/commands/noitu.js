const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { startWordSession, getWordSession, skipWordSession, endWordSession } = require('../services/funGameService');
const { formatCoins } = require('../utils/economy');
const { requireGameChannel } = require('../utils/gameChannel');
const { getGameReward } = require('../services/gameRewardService');
const { knownWord } = require('../services/funGameService');
const { submitSuggestion, listPendingSuggestions, reviewSuggestion, addApprovedWord, listApprovedWords, removeApprovedWord } = require('../services/wordSuggestionService');

function isAdmin(interaction) {
  const ids = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  return ids.includes(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  data: new SlashCommandBuilder().setName('noitu').setDescription('Chơi nối từ chung trong channel')
    .addSubcommand(command => command.setName('batdau').setDescription('Bắt đầu phiên nối từ chung'))
    .addSubcommand(command => command.setName('boqua').setDescription('Bỏ qua từ hiện tại và lấy từ mới'))
    .addSubcommand(command => command.setName('baotu').setDescription('Báo một cụm từ còn thiếu trong từ điển')
      .addStringOption(option => option.setName('tu').setDescription('Cụm từ gồm 2–5 tiếng').setRequired(true).setMaxLength(60)))
    .addSubcommand(command => command.setName('choduyet').setDescription('Admin xem các từ đang chờ duyệt'))
    .addSubcommand(command => command.setName('duyet').setDescription('Admin duyệt một từ')
      .addIntegerOption(option => option.setName('id').setDescription('ID đề xuất').setRequired(true).setMinValue(1)))
    .addSubcommand(command => command.setName('tuchoi').setDescription('Admin từ chối một từ')
      .addIntegerOption(option => option.setName('id').setDescription('ID đề xuất').setRequired(true).setMinValue(1)))
    .addSubcommand(command => command.setName('themtu').setDescription('Admin thêm trực tiếp một cụm từ đã duyệt')
      .addStringOption(option => option.setName('tu').setDescription('Cụm từ gồm 2–5 tiếng').setRequired(true).setMaxLength(60)))
    .addSubcommand(command => command.setName('xoatu').setDescription('Admin xóa một cụm từ do server thêm')
      .addStringOption(option => option.setName('tu').setDescription('Cụm từ cần xóa').setRequired(true).setMaxLength(60)))
    .addSubcommand(command => command.setName('tudien').setDescription('Xem các từ do server đã thêm')
      .addIntegerOption(option => option.setName('trang').setDescription('Trang cần xem').setMinValue(1)))
    .addSubcommand(command => command.setName('ketthuc').setDescription('Admin kết thúc phiên hiện tại')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Game chỉ chơi được trong server.', flags: MessageFlags.Ephemeral });
    if (!await requireGameChannel(interaction, 'noitu')) return;
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'baotu') {
      const phrase = interaction.options.getString('tu', true);
      if (knownWord(guildId, phrase)) return interaction.reply({ content: 'Cụm từ này đã có trong từ điển Nối từ.', flags: MessageFlags.Ephemeral });
      try {
        const row = submitSuggestion(guildId, interaction.user.id, phrase);
        return interaction.reply({ content: `📝 Đã gửi **#${row.id} · ${row.phrase}** để admin duyệt.`, flags: MessageFlags.Ephemeral });
      } catch (error) {
        const messages = { INVALID_PHRASE: 'Chỉ nhận cụm từ tiếng Việt gồm 2–5 tiếng, tối đa 60 ký tự.', ALREADY_APPROVED: 'Cụm từ này đã được duyệt.', ALREADY_PENDING: 'Cụm từ này đang chờ duyệt.', TOO_MANY_PENDING: 'Bạn đã có 10 từ chờ duyệt. Hãy đợi admin xử lý trước.' };
        return interaction.reply({ content: messages[error.message] || 'Không thể gửi đề xuất từ.', flags: MessageFlags.Ephemeral });
      }
    }

    if (subcommand === 'tudien') {
      const result = listApprovedWords(guildId, interaction.options.getInteger('trang') || 1);
      const description = result.rows.length
        ? result.rows.map(row => `**#${row.id} · ${row.phrase}**\nThêm bởi <@${row.submitted_by}> · <t:${Math.floor((row.reviewed_at || row.created_at) / 1000)}:R>`).join('\n\n')
        : 'Server chưa thêm cụm từ riêng nào.';
      const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('📚 TỪ ĐIỂN NỐI TỪ CỦA SERVER')
        .setDescription(description).setFooter({ text: `${result.total} từ • Trang ${result.page}/${result.pages}` });
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }

    if (['choduyet', 'duyet', 'tuchoi', 'themtu', 'xoatu'].includes(subcommand)) {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được quản lý từ đề xuất.', flags: MessageFlags.Ephemeral });
      if (subcommand === 'xoatu') {
        try {
          const row = removeApprovedWord(guildId, interaction.user.id, interaction.options.getString('tu', true));
          return interaction.reply({ content: `🗑️ Đã xóa **#${row.id} · ${row.phrase}** khỏi từ điển của server.` });
        } catch (error) {
          const content = error.message === 'INVALID_PHRASE' ? 'Cụm từ không hợp lệ.' : 'Không tìm thấy cụm từ đã được server thêm. Từ có sẵn của bot không thể xóa bằng lệnh này.';
          return interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
      }
      if (subcommand === 'themtu') {
        const phrase = interaction.options.getString('tu', true);
        if (knownWord(guildId, phrase)) return interaction.reply({ content: 'Cụm từ này đã có trong từ điển Nối từ.', flags: MessageFlags.Ephemeral });
        try {
          const row = addApprovedWord(guildId, interaction.user.id, phrase);
          return interaction.reply({ content: `✅ Đã thêm trực tiếp **#${row.id} · ${row.phrase}** vào từ điển Nối từ.` });
        } catch (error) {
          const content = error.message === 'INVALID_PHRASE' ? 'Chỉ nhận cụm từ tiếng Việt gồm 2–5 tiếng, tối đa 60 ký tự.' : 'Không thể thêm cụm từ này.';
          return interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
      }
      if (subcommand === 'choduyet') {
        const rows = listPendingSuggestions(guildId);
        const content = rows.length ? rows.map(row => `**#${row.id}** · ${row.phrase} · <@${row.submitted_by}>`).join('\n') : 'Không có từ nào đang chờ duyệt.';
        return interaction.reply({ content, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
      }
      try {
        const row = reviewSuggestion(guildId, interaction.options.getInteger('id', true), interaction.user.id, subcommand === 'duyet');
        return interaction.reply({ content: `${subcommand === 'duyet' ? '✅ Đã duyệt' : '❌ Đã từ chối'} **#${row.id} · ${row.phrase}**.` });
      } catch {
        return interaction.reply({ content: 'Không tìm thấy đề xuất đang chờ duyệt với ID này.', flags: MessageFlags.Ephemeral });
      }
    }

    if (subcommand === 'batdau') {
      if (getWordSession(guildId)) return interaction.reply({ content: 'Channel đã có phiên nối từ. Hãy nhập trực tiếp đáp án vào channel để tham gia.', flags: MessageFlags.Ephemeral });
      const session = startWordSession(guildId);
      const baseReward = getGameReward(guildId, 'noitu');
      const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('🔗 NỐI TỪ CHUNG')
        .setDescription(`Bot bắt đầu: **${session.phrase}**\n\nNhập trực tiếp cụm từ bắt đầu bằng **${session.required}** vào channel này. Bot thả ✅ khi từ hợp lệ, sau đó người khác nối tiếp từ câu vừa được chấp nhận.`)
        .addFields(
          { name: 'Thưởng mỗi đáp án đúng', value: `${formatCoins(baseReward)} xu`, inline: true },
          { name: 'Thời gian', value: 'Không giới hạn', inline: true },
          { name: 'Reaction của bot', value: '✅ Từ hợp lệ và chuỗi được chuyển sang người tiếp theo.' },
          { name: 'Luân phiên', value: 'Người vừa nối đúng phải chờ một người khác nối đúng rồi mới được trả lời tiếp.' },
          { name: 'Thắng chuỗi', value: 'Nối từ cuối cùng khiến bot không còn đường đi để nhận x10 xu.' },
        )
        .setFooter({ text: 'Dùng /noitu boqua nếu không ai tìm được từ phù hợp' });
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'boqua') {
      const previous = getWordSession(guildId);
      if (!previous) return interaction.reply({ content: 'Channel chưa có phiên nối từ.', flags: MessageFlags.Ephemeral });
      const skipped = previous.phrase;
      const session = skipWordSession(guildId);
      return interaction.reply({ content: `⏭️ Đã bỏ qua **${skipped}**. Từ mới của bot: **${session.phrase}**\nHãy bắt đầu bằng **${session.required}**.` });
    }

    if (subcommand === 'ketthuc') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được kết thúc phiên chung.', flags: MessageFlags.Ephemeral });
      if (!endWordSession(guildId)) return interaction.reply({ content: 'Channel chưa có phiên nối từ.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '🛑 Admin đã kết thúc phiên nối từ.' });
    }
    return null;
  },
};

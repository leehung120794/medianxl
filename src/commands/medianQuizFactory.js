const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { startMedianQuiz, getMedianQuiz, skipMedianQuiz, endMedianQuiz, quizText } = require('../services/medianQuizService');
const { getGameReward } = require('../services/gameRewardService');
const { formatCoins } = require('../utils/economy');
const { requireGameChannel } = require('../utils/gameChannel');

function isAdmin(interaction) {
  const ids = String(process.env.ADMIN_USER_ID || '').split(/[,;\n]/).map(id => id.trim()).filter(Boolean);
  return ids.includes(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function createMedianQuizCommand(game, title) {
  return {
    data: new SlashCommandBuilder().setName(game).setDescription(`Game ${title} từ database Median XL`)
      .addSubcommand(command => command.setName('batdau').setDescription(`Bắt đầu phiên ${title}`))
      .addSubcommand(command => command.setName('boqua').setDescription('Hiện đáp án và chuyển câu mới'))
      .addSubcommand(command => command.setName('ketthuc').setDescription('Admin kết thúc phiên hiện tại')),
    async execute(interaction) {
      if (!interaction.guildId) return interaction.reply({ content: 'Game chỉ chơi được trong server.', flags: MessageFlags.Ephemeral });
      if (!await requireGameChannel(interaction, game)) return;
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'batdau') {
        if (getMedianQuiz(interaction.guildId, game)) return interaction.reply({ content: 'Channel đã có câu hỏi. Hãy nhập trực tiếp đáp án vào channel.', flags: MessageFlags.Ephemeral });
        const session = startMedianQuiz(interaction.guildId, game);
        if (!session) return interaction.reply({ content: 'Database chưa có đủ dữ liệu phù hợp cho game này.', flags: MessageFlags.Ephemeral });
        const baseReward = getGameReward(interaction.guildId, game);
        const reward = baseReward * (session.question.hard ? 10 : 1);
        const embed = new EmbedBuilder().setColor(0x3498DB)
          .setTitle(`🧩 ${title.toUpperCase()}`).setDescription(quizText(session.question))
          .addFields({ name: 'Cách chơi', value: 'Nhập trực tiếp base item hoặc con số level được hỏi trong channel này.' }, { name: 'Thưởng', value: `${formatCoins(reward)} xu`, inline: true })
          .setFooter({ text: `${session.question.hard ? 'Câu khó có 30 giây' : 'Câu thường không giới hạn thời gian'} • Dùng /${game} boqua nếu cần` });
        return interaction.reply({ embeds: [embed] });
      }
      if (subcommand === 'boqua') {
        const result = skipMedianQuiz(interaction.guildId, game);
        if (!result) return interaction.reply({ content: 'Channel chưa có phiên đang hoạt động.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: `⏭️ Đáp án vừa bỏ qua: **${result.skipped.answer}**\n\nCâu mới:\n${quizText(result.nextQuestion)}` });
      }
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Chỉ admin mới được kết thúc phiên chung.', flags: MessageFlags.Ephemeral });
      if (!endMedianQuiz(interaction.guildId, game)) return interaction.reply({ content: 'Channel chưa có phiên đang hoạt động.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: `🛑 Admin đã kết thúc phiên ${title}.` });
    },
  };
}

module.exports = { createMedianQuizCommand };

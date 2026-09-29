const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

function helpEmbed(prefix = process.env.COMMAND_PREFIX || '!') {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎮 HƯỚNG DẪN TRÒ CHƠI')
    .setDescription('Các lệnh dành cho người chơi. Game chỉ hoạt động trong channel đã được server thiết lập.')
    .addFields(
      {
        name: '🎲 Game đặt cược',
        value: [
          `• \`/baucua\` hoặc \`${prefix}baucua\` — bàn Bầu cua 30 giây`,
          `• \`/taixiu\` hoặc \`${prefix}taixiu\` — bàn Sic Bo 30 giây`,
          `• \`/oantuti chon:<bua|keo|bao> xu:<số>\``,
          `• \`${prefix}oantuti <bua|keo|bao> <số xu>\``,
          `• \`/blackjack xu:<số>\` hoặc \`${prefix}blackjack <số xu>\` — Rút, Dừng, Gấp đôi hoặc Tách bài`,
          `• \`/duangua\` hoặc \`${prefix}duangua\` — ván chung nhiều người, nhận cược 30 giây`,
          `• \`/mines xu:<số> min:<1–7>\` hoặc \`${prefix}mines <số xu> <số mìn>\``,
          `• \`/hardcore batdau xu:<số> class:<class>\` hoặc \`${prefix}hardcore <số xu> <class>\``,
        ].join('\n'),
      },
      {
        name: '☠️ Hardcore Run',
        value: `• \`/hardcore hoso\` · \`/hardcore top\` · \`/hardcore rates\`\n• \`${prefix}hardcore hoso\` · \`${prefix}hardcore top\` · \`${prefix}hardcore rates\`\nTầng 100 hoàn thành chính thức, sau đó có thể tiếp tục Overrun tới tầng 999.`,
      },
      {
        name: '🧠 Game trả lời trực tiếp',
        value: [
          `• \`/noitu batdau\` hoặc \`${prefix}noitu batdau\``,
          `• \`/noitu baotu tu:<cụm từ>\` hoặc \`${prefix}noitu baotu <cụm từ>\``,
          `• \`/noitu tudien\` hoặc \`${prefix}noitu tudien [trang]\``,
          `• \`/vuatiengviet batdau\` hoặc \`${prefix}vuatiengviet batdau\``,
          `• \`/doanitem batdau\` hoặc \`${prefix}doanitem batdau\``,
          'Nhập đáp án trực tiếp vào channel sau khi mở phiên.',
        ].join('\n'),
      },
      {
        name: '🔎 Tra cứu Median XL',
        value: `• \`/item query:<từ khóa>\` hoặc \`${prefix}item <từ khóa>\`\n• Lọc loại: \`${prefix}item <TU|SU|RW|SET|UMO|CYCLE|RELIC|TROPHY> <từ khóa>\``,
      },
      {
        name: '⏭️ Bỏ qua câu',
        value: [
          `• \`/noitu boqua\` · \`${prefix}noitu boqua\``,
          `• \`/vuatiengviet boqua\` · \`${prefix}vuatiengviet boqua\``,
          `• \`/doanitem boqua\` · \`${prefix}doanitem boqua\``,
        ].join('\n'),
      },
      {
        name: '🔥 Câu khó',
        value: 'Nối từ, Vua tiếng Việt và Đoán item thỉnh thoảng có câu khó trong 30 giây. Trả lời đúng nhận x10 xu; hết giờ bot tự chuyển về câu thường. Trong Nối từ, người đi từ cuối khiến bot hết đường nối cũng thắng x10 xu.',
      },
      {
        name: '💰 Xu và hồ sơ',
        value: [
          '• `/xu sodu` — xem số xu hiện tại',
          '• `/xu daily` — nhận xu mỗi ngày',
          '• `/xu top` — bảng xếp hạng',
          '• `/xu chuyen user:<người nhận> xu:<số>` — chuyển xu',
          '• `/hoso [user]` — xem hồ sơ game',
        ].join('\n'),
      },
      {
        name: '🏪 Cửa hàng và vật phẩm',
        value: [
          '• `/shop xem` · `/buy` — xem và mua vật phẩm',
          '• `/inventory [user]` · `/use` — xem kho, hiệu ứng đang bật và dùng đồ',
          '• `/collection [user]` · `/craft` — xem hoặc chế tạo thẻ Median XL',
          '• `/giftitem` — tặng vật phẩm có thể giao dịch',
          '• `/anxin` — gửi yêu cầu xin xu trong 30 giây',
        ].join('\n'),
      },
      {
        name: '📜 Tiến độ và sự kiện',
        value: [
          '• `/nhiemvu xem|nhan|diemdanh` — nhiệm vụ và chuỗi đăng nhập',
          '• `/sukien boss|nhan` — boss cộng đồng hằng tuần',
          '• `/xu lichsu` — 10 giao dịch xu gần nhất',
          '• `/xephang game` — bảng xếp hạng riêng cho từng game',
          '• `/xephang mua|nhan` — bảng điểm và thưởng top 10 mùa trước',
        ].join('\n'),
      },
    )
    .setFooter({ text: `Prefix hiện tại: ${prefix} • Danh sách này không hiển thị lệnh admin` });
}

module.exports = {
  data: new SlashCommandBuilder().setName('trochoi').setDescription('Xem toàn bộ lệnh trò chơi dành cho người chơi'),
  helpEmbed,
  async execute(interaction) {
    return interaction.reply({ embeds: [helpEmbed()], flags: MessageFlags.Ephemeral });
  },
};

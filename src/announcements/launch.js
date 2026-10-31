const { EmbedBuilder } = require("discord.js");

function launchEmbeds() {
  return [
    new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🎮 GAME HUB")
      .setDescription("Chọn trò chơi, đặt cược bằng xu và theo dõi kết quả trong hồ sơ.")
      .addFields(
        {
          name: "🎲 Trò chơi đang có",
          value: "Bầu cua · Tài xỉu · Xì dách · Poker · Đua ngựa · Dò mìn · Vua tiếng Việt",
        },
        {
          name: "📖 Bắt đầu",
          value: "`/batdau` xem hướng dẫn · `/huongdan` xem game · `/luat` xem luật từng game",
        },
        {
          name: "💰 Hồ sơ và xu",
          value: "`/hoso` xem hồ sơ · `/xu` xem số dư, lịch sử và chuyển xu · `/xephang` xem bảng xếp hạng",
        },
        {
          name: "🧰 Median XL",
          value: "`/item` tra cứu item · `/update` đồng bộ database item · `/backup` sao lưu dữ liệu bot",
        },
      )
      .setFooter({ text: "Chơi vừa sức và dùng đúng channel do admin thiết lập." }),
  ];
}

module.exports = { launchEmbeds };

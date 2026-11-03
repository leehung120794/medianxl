const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const cfg = require("../tuTien/config");
const svc = require("../services/tuTienService");

const color = 0xb89b62;
const fmt = (value) => Number(value || 0).toLocaleString("vi-VN");
const owner = (interaction) => interaction.user.id;
const btn = (customId, label, style = ButtonStyle.Primary, emoji) => {
  const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
  if (emoji) button.setEmoji(emoji);
  return button;
};
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const embed = (title, description) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
const current = (interaction) => svc.getCharacter(interaction.guildId, interaction.user.id);
const noCharacter = (interaction) => interaction.reply({
  content: "Bạn chưa có nhân vật. Dùng `/batdau` để bắt đầu hành trình.",
  flags: MessageFlags.Ephemeral,
});
function errorText(error) {
  const messages = {
    CHARACTER_REQUIRED: "Bạn chưa tạo nhân vật bằng `/batdau`.",
    SESSION_ALREADY_RUNNING: "Bạn đang có một phiên tu luyện hoặc bế quan chưa nhận thưởng.",
    NO_RUNNING_SESSION: "Bạn không có phiên nào đang chờ nhận thưởng.",
    SESSION_NOT_READY: "Phiên tu luyện chưa hoàn tất. Hãy quay lại khi hết thời gian.",
    SESSION_RUNNING: "Hãy nhận xong phiên tu luyện trước khi đột phá.",
    ACTIVITY_LIMIT_REACHED: "Bạn đã dùng hết lượt hoạt động này hôm nay.",
    ALREADY_CHECKED_IN: "Bạn đã điểm danh hôm nay rồi.",
    MAX_REALM_REACHED: "Bạn đã đạt cảnh giới tối đa trong bản hiện tại.",
    INSUFFICIENT_CULTIVATION: "Tu vi hiện tại chưa đủ điều kiện.",
    INSUFFICIENT_SPIRIT_STONE: "Linh thạch không đủ để thực hiện thao tác này.",
    INSUFFICIENT_DAO_HEART: "Đạo tâm không đủ để thực hiện đại đột phá.",
    QUEST_NOT_COMPLETE: "Nhiệm vụ chưa hoàn thành.",
    QUEST_ALREADY_CLAIMED: "Bạn đã nhận thưởng nhiệm vụ này hôm nay.",
    ITEM_NOT_OWNED: "Bạn không có vật phẩm này trong túi.",
  };
  return messages[error.message] || "Không thể hoàn thành thao tác. Hãy thử lại sau.";
}
function sendError(interaction, error) {
  return interaction.reply({ content: errorText(error), flags: MessageFlags.Ephemeral });
}
function profileText(character) {
  const root = cfg.rootById(character.spiritual_root_id);
  const nextRealm = character.realm_stage === 9 ? character.realm_order + 1 : character.realm_order;
  const nextStage = character.realm_stage === 9 ? 1 : character.realm_stage + 1;
  const needed = character.realm_order >= cfg.REALMS.length && character.realm_stage === 9
    ? cfg.requiredCultivation(character.realm_order, 9)
    : cfg.requiredCultivation(nextRealm, nextStage);
  const realm = svc.formatRealm(character);
  const progress = Math.min(100, Math.floor(character.cultivation / needed * 100));
  const session = svc.getCurrentSession(character.id);
  return `**Pháp danh:** ${character.dharma_name}
**Cảnh giới:** ${realm}
**Căn cốt:** ${root.name} · x${root.multiplier}
**Tu vi:** ${fmt(character.cultivation)} / ${fmt(needed)} (${progress}% đến tầng kế)
**Linh thạch:** ${fmt(character.spirit_stone)} · **Công đức:** ${fmt(character.merit)} · **Đạo tâm:** ${fmt(character.dao_heart)}
**Đột phá:** ${fmt(character.total_breakthroughs)} · **Đổi căn cốt:** ${fmt(character.root_changed_count)}
**Trạng thái:** ${session ? `${session.session_type === "retreat" ? "Bế quan" : "Tu luyện"} · kết thúc <t:${Math.floor(session.ends_at / 1000)}:R>` : "Đang tự do"}`;
}
function rootDescription(rootId) {
  const root = cfg.rootById(rootId);
  return `${root.name} · hệ số tu vi ×${root.multiplier}`;
}
function command(name, description, execute, addOptions) {
  const data = new SlashCommandBuilder().setName(name).setDescription(description);
  if (addOptions) addOptions(data);
  return { data, execute };
}

const commands = [
  command("batdau", "Tạo nhân vật tu tiên", async (i) => {
    try {
      const result = svc.createCharacter(i.guildId, i.user.id, i.user.globalName || i.user.username);
      if (!result.created)
        return i.reply({ content: `Bạn đã có nhân vật.\n${profileText(result.character)}`, flags: MessageFlags.Ephemeral });
      return i.reply({ embeds: [embed("🌱 HÀNH TRÌNH BẮT ĐẦU", `Đạo hữu **${result.character.dharma_name}** đã nhập môn.\n\n**Căn cốt:** ${rootDescription(result.root.id)}\n**Cảnh giới:** ${svc.formatRealm(result.character)}\n**Linh thạch khởi đầu:** 500\n\nDùng lệnh /chua để tham gia hoạt động, hoặc /nhanvat xem hồ sơ.`)], flags: MessageFlags.Ephemeral });
    } catch (error) { return sendError(i, error); }
  }),
  command("nhanvat", "Xem hồ sơ và trạng thái tu luyện", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    return i.reply({ embeds: [embed(`🧘 ${character.dharma_name}`, profileText(character))], flags: MessageFlags.Ephemeral });
  }),
  command("cancot", "Xem căn cốt và tỷ lệ xuất hiện", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    const list = cfg.ROOTS.map((root) => `${root.id === character.spiritual_root_id ? "➡️" : "•"} **${root.name}** · ${root.chance}% · x${root.multiplier}`).join("\n");
    return i.reply({ embeds: [embed(`🔮 CĂN CỐT · ${cfg.rootById(character.spiritual_root_id).name}`, `Căn cốt nhân tu vi từ tu luyện và hoạt động; không nhân linh thạch, công đức hay đạo tâm.\n\n${list}\n\nĐan Dược Nghịch Thiên có thể random lại căn cốt; kết quả có thể thấp hơn.`)], flags: MessageFlags.Ephemeral });
  }),
  command("chua", "Mở hoạt động tại chùa", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    const components = [
      row(...cfg.ACTIVITIES.slice(0, 5).map((a) => btn(`chu:activity:${a.id}:${owner(i)}`, a.name, ButtonStyle.Success, a.emoji))),
      row(...cfg.ACTIVITIES.slice(5).map((a) => btn(`chu:activity:${a.id}:${owner(i)}`, a.name, ButtonStyle.Success, a.emoji))),
    ];
    return i.reply({ embeds: [embed("🛕 HOẠT ĐỘNG CHÙA", `Chọn một hoạt động để nhận tu vi và tài nguyên. Tu vi được nhân theo căn cốt **${cfg.rootById(character.spiritual_root_id).multiplier}×**. Mỗi hoạt động có giới hạn lượt riêng theo ngày Việt Nam.`)], components, flags: MessageFlags.Ephemeral });
  }),
  ...["normal", "retreat"].map((type) => command(
    type === "normal" ? "tuluyen" : "bequan",
    type === "normal" ? "Bắt đầu một phiên tu luyện theo thời gian" : "Bắt đầu một phiên bế quan dài hạn",
    async (i) => {
      const character = current(i);
      if (!character) return noCharacter(i);
      const choices = cfg.SESSION_OPTIONS[type];
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`chu:session:${type}:${owner(i)}`)
        .setPlaceholder("Chọn thời lượng")
        .addOptions(choices.map((option) => ({
          label: `${option.label} · ${fmt(option.baseReward)} tu vi gốc`,
          value: String(option.seconds),
          description: `Thực nhận x${cfg.rootById(character.spiritual_root_id).multiplier} theo căn cốt`,
        })));
      return i.reply({ embeds: [embed(type === "normal" ? "📖 TU LUYỆN" : "🌙 BẾ QUAN", "Thời gian được tính bằng mốc UTC lưu trong database, nên phiên vẫn tiếp tục khi bot khởi động lại. Chỉ nhận được tu vi sau khi hết thời lượng.")], components: [row(menu)], flags: MessageFlags.Ephemeral });
    },
  )),
  command("nhantuvi", "Nhận tu vi từ phiên đã hoàn tất", async (i) => {
    try {
      const result = svc.claimCultivation(i.guildId, i.user.id);
      return i.reply({ embeds: [embed("✨ ĐÃ NHẬN TU VI", `Phiên **${result.session.session_type === "retreat" ? "Bế quan" : "Tu luyện"}** hoàn tất.\nTu vi gốc: **${fmt(result.session.base_reward)}**\nCăn cốt: **×${cfg.rootById(result.character.spiritual_root_id).multiplier}**\nNhận được: **+${fmt(result.amount)} tu vi**\nSố dư hiện tại: **${fmt(result.character.cultivation)} tu vi**`)], flags: MessageFlags.Ephemeral });
    } catch (error) { return sendError(i, error); }
  }),
  command("dotpha", "Xem điều kiện và thử đột phá", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    let p;
    try { p = svc.breakthroughPreview(character); } catch (error) { return sendError(i, error); }
    const from = svc.formatRealm(character);
    const to = `${cfg.REALMS[p.targetRealm - 1]} · Tầng ${p.targetStage}`;
    const description = `**Hiện tại:** ${from}\n**Mục tiêu:** ${to}\n**Tu vi cần:** ${fmt(p.required)} · hiện có ${fmt(character.cultivation)}\n**Linh thạch tiêu hao:** ${fmt(p.spiritStone)}\n**Đạo tâm cần:** ${fmt(p.daoHeart)} · hiện có ${fmt(character.dao_heart)}\n**Tỷ lệ thành công:** ${p.successPercent}%\n${p.major ? `**Nếu thất bại:** mất ${fmt(p.failLoss)} tu vi; không tụt cảnh giới. Linh thạch và đạo tâm tiêu hao được trừ mỗi lần thử.` : "Đột phá tiểu cảnh giới thành công 100%."}`;
    return i.reply({ embeds: [embed("⚡ ĐỘT PHÁ CẢNH GIỚI", description)], components: [row(btn(`chu:breakthrough:${owner(i)}`, "Xác nhận thử", ButtonStyle.Danger, "⚡"))], flags: MessageFlags.Ephemeral });
  }),
  command("nhiemvu", "Xem và nhận nhiệm vụ hằng ngày", async (i) => {
    try {
      const quests = svc.getDailyQuests(i.guildId, i.user.id);
      const description = quests.map((q) => `${q.claimed ? "✅" : q.progress >= q.target ? "🟢" : "▫️"} **${q.name}** · ${q.progress}/${q.target}\nThưởng: ${q.reward.cultivation || 0} tu vi gốc · ${q.reward.spiritStone || 0} linh thạch · ${q.reward.daoHeart || 0} đạo tâm`).join("\n\n");
      const buttons = quests.filter((q) => q.progress >= q.target && !q.claimed).map((q) => btn(`chu:quest:${q.id}:${owner(i)}`, `Nhận: ${q.name}`, ButtonStyle.Success));
      const rows = buttons.slice(0, 5);
      return i.reply({ embeds: [embed("📜 NHIỆM VỤ HẰNG NGÀY", description)], components: rows.length ? [row(...rows)] : [], flags: MessageFlags.Ephemeral });
    } catch (error) { return sendError(i, error); }
  }),
  command("diemdanh", "Điểm danh nhận linh thạch mỗi ngày", async (i) => {
    try {
      const result = svc.checkIn(i.guildId, i.user.id);
      return i.reply({ embeds: [embed("📅 ĐIỂM DANH THÀNH CÔNG", `Chuỗi điểm danh: **${result.streak} ngày**\nNhận **${fmt(result.spiritStone)} linh thạch**${result.merit ? ` và **${fmt(result.merit)} công đức**` : ""}.`)], flags: MessageFlags.Ephemeral });
    } catch (error) { return sendError(i, error); }
  }),
  command("cuahang", "Mở cửa hàng tu tiên", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    const item = cfg.ITEMS.dan_nghich_thien;
    return i.reply({ embeds: [embed("🏪 CỬA HÀNG", `**${item.name}** · ${fmt(item.price)} linh thạch\n${item.description}\n\nSố dư: **${fmt(character.spirit_stone)} linh thạch**`)], components: [row(btn(`chu:buy:${item.id}:${owner(i)}`, "Mua 1 viên", ButtonStyle.Success, "🛒"))], flags: MessageFlags.Ephemeral });
  }),
  command("tuido", "Xem vật phẩm đang sở hữu", async (i) => {
    try {
      const items = svc.getInventory(i.guildId, i.user.id);
      const description = items.length ? items.map((item) => `**${item.name} ×${item.quantity}**\n${item.description}`).join("\n\n") : "Túi đồ đang trống. Dùng `/cuahang` để xem vật phẩm.";
      const components = items.map((item) => btn(`chu:confirm-use:${item.id}:${owner(i)}`, `Dùng ${item.name}`, ButtonStyle.Primary));
      return i.reply({ embeds: [embed("🎒 TÚI ĐỒ", description)], components: components.length ? [row(...components.slice(0, 5))] : [], flags: MessageFlags.Ephemeral });
    } catch (error) { return sendError(i, error); }
  }),
  command("sudung", "Dùng Đan Dược Nghịch Thiên đổi căn cốt", async (i) => {
    const character = current(i);
    if (!character) return noCharacter(i);
    return i.reply({ embeds: [embed("⚠️ XÁC NHẬN DÙNG ĐAN", `Dùng Đan Dược Nghịch Thiên sẽ random lại căn cốt theo tỷ lệ hiện hành.\n\nCăn cốt hiện tại: **${rootDescription(character.spiritual_root_id)}**\n**Căn cốt mới có thể yếu hơn.** Bạn có chắc muốn dùng không?`)], components: [row(btn(`chu:use:dan_nghich_thien:${owner(i)}`, "Xác nhận sử dụng", ButtonStyle.Danger, "🧪"))], flags: MessageFlags.Ephemeral });
  }),
  command("bicanh", "Xem các địa điểm tu luyện", async (i) => {
    const places = [
      "🏛️ **Chính Điện** — lễ Phật, nhận công đức.",
      "🧘 **Thiền Đường** — ngồi thiền, tích lũy đạo tâm.",
      "🌳 **Vườn Bồ Đề** — địa điểm tu dưỡng.",
      "💧 **Linh Tuyền** — tĩnh tâm.",
      "🪷 **Vườn Hoa Sen** — chăm sóc hoa sen.",
      "⛰️ **Động Phủ** — bế quan.",
      "📚 **Tàng Kinh Các** — nơi mở rộng công pháp (giai đoạn sau).",
    ].join("\n");
    return i.reply({ embeds: [embed("🗺️ ĐỊA ĐIỂM", `${places}\n\nDùng lệnh /chua để thực hiện hoạt động; dùng /bequan để bế quan.`)], flags: MessageFlags.Ephemeral });
  }),
  command("trogiuptu", "Xem hướng dẫn hệ thống tu tiên", async (i) =>
    i.reply({ embeds: [embed("📘 HƯỚNG DẪN TU TIÊN", [
      "`/batdau` tạo nhân vật và random căn cốt.",
      "`/chua` làm hoạt động hằng ngày; `/nhiemvu` nhận thưởng nhiệm vụ.",
      "`/tuluyen` hoặc `/bequan` bắt đầu phiên tính theo thời gian; `/nhantuvi` nhận khi hoàn tất.",
      "`/dotpha` xem chi phí và tỷ lệ trước khi xác nhận.",
      "`/diemdanh` nhận linh thạch mỗi ngày.",
      "`/cuahang`, `/tuido`, `/sudung` quản lý Đan Dược Nghịch Thiên.",
      "`/nhanvat`, `/cancot`, `/bicanh` xem thông tin.",
      "Median XL vẫn dùng `/item`, `/update`; `/backup` giữ nguyên.",
    ].join("\n\n"))], flags: MessageFlags.Ephemeral }),
  ),
];

async function handleComponent(interaction) {
  const parts = String(interaction.customId || "").split(":");
  if (parts[0] !== "chu") return false;
  const action = parts[1];
  const userId = parts.at(-1);
  if (userId !== interaction.user.id) {
    await interaction.reply({ content: "Menu này thuộc về người chơi khác.", flags: MessageFlags.Ephemeral });
    return true;
  }
  try {
    if (action === "activity") {
      const result = svc.claimActivity(interaction.guildId, userId, parts[2]);
      const a = result.activity;
      return interaction.update({ embeds: [embed(`${a.emoji} ${a.name.toUpperCase()}`, `Nhận **+${fmt(result.actualCultivation)} tu vi** · ${a.merit ? `+${a.merit} công đức · ` : ""}${a.dao ? `+${a.dao} đạo tâm · ` : ""}Căn cốt ×${cfg.rootById(result.character.spiritual_root_id).multiplier}.\n\nTu vi hiện tại: **${fmt(result.character.cultivation)}**.`)], components: [] });
    }
    if (action === "session") {
      const session = svc.startCultivation(interaction.guildId, userId, parts[2], Number(interaction.values[0]));
      return interaction.update({ embeds: [embed("⏳ PHIÊN ĐÃ BẮT ĐẦU", `Hoàn tất <t:${Math.floor(session.ends_at / 1000)}:R>. Sau đó dùng lệnh /nhantuvi để nhận thưởng. Phiên vẫn chạy khi bot restart.`)], components: [] });
    }
    if (action === "claim") {
      const result = svc.claimCultivation(interaction.guildId, userId);
      return interaction.update({ embeds: [embed("✨ ĐÃ NHẬN TU VI", `Nhận **+${fmt(result.amount)} tu vi** từ ${result.session.session_type === "retreat" ? "bế quan" : "tu luyện"}. Số dư: **${fmt(result.character.cultivation)}**.`)], components: [] });
    }
    if (action === "breakthrough") {
      const result = svc.attemptBreakthrough(interaction.guildId, userId);
      const title = result.success ? "🎉 ĐỘT PHÁ THÀNH CÔNG" : "🌫️ ĐỘT PHÁ THẤT BẠI";
      const message = result.success
        ? `Đạo hữu đã đạt **${svc.formatRealm(result.character)}**. Tu vi sau đột phá: **${fmt(result.character.cultivation)}**.`
        : `Cảnh giới không thay đổi. Mất **${fmt(result.preview.failLoss)} tu vi**; linh thạch và đạo tâm đã tiêu hao như thông báo trước đó.`;
      return interaction.update({ embeds: [embed(title, message)], components: [] });
    }
    if (action === "quest") {
      const result = svc.claimDailyQuest(interaction.guildId, userId, parts[2]);
      return interaction.update({ embeds: [embed("🎁 ĐÃ NHẬN THƯỞNG", `**${result.quest.name}**\nTu vi thực nhận: **+${fmt(result.cultivation)}**.\nLinh thạch hiện có: **${fmt(result.character.spirit_stone)}**.`)], components: [] });
    }
    if (action === "buy") {
      const result = svc.buyItem(interaction.guildId, userId, parts[2]);
      return interaction.update({ embeds: [embed("🛒 MUA THÀNH CÔNG", `Đã mua **${result.item.name} ×${result.quantity}** với giá **${fmt(result.total)} linh thạch**. Số dư: **${fmt(result.character.spirit_stone)}**.`)], components: [] });
    }
    if (action === "confirm-use") {
      const inventory = svc.getInventory(interaction.guildId, userId);
      const item = inventory.find((entry) => entry.id === parts[2]);
      if (!item) throw new Error("ITEM_NOT_OWNED");
      return interaction.update({
        embeds: [embed("⚠️ XÁC NHẬN DÙNG ĐAN", `Dùng **${item.name}** sẽ random lại căn cốt theo tỷ lệ hiện hành. Căn cốt mới có thể yếu hơn. Xác nhận sử dụng?`)],
        components: [row(btn(`chu:use:${item.id}:${userId}`, "Xác nhận sử dụng", ButtonStyle.Danger, "🧪"))],
      });
    }
    if (action === "use") {
      const result = svc.useItem(interaction.guildId, userId, parts[2]);
      return interaction.update({ embeds: [embed("🧪 ĐAN DƯỢC ĐÃ DÙNG", `**${result.previousRoot.name}** → **${result.nextRoot.name}** · hệ số tu vi ×${result.nextRoot.multiplier}. Kết quả được ghi vào lịch sử căn cốt.`)], components: [] });
    }
  } catch (error) {
    await interaction.reply({ content: errorText(error), flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  return false;
}

module.exports = { commands, handleComponent };

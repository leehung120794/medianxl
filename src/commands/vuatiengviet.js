const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const {
  startVuaSession,
  getVuaSession,
  endVuaSession,
  vuaQuestionText,
  skipVuaSessionForPlayer,
  setVuaUiMessage,
} = require("../services/funGameService");
const { formatCoins } = require("../utils/economy");
const { requireGameChannel } = require("../utils/gameChannel");
const { channelHasGame } = require("../services/gameChannelService");
const { getGameReward } = require("../services/gameRewardService");

function isAdmin(interaction) {
  const ids = String(process.env.ADMIN_USER_ID || "")
    .split(/[,;\n]/)
    .map((id) => id.trim())
    .filter(Boolean);
  return (
    ids.includes(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

// Màu viền: câu khó đổi theo thời gian còn lại; kết thúc thì xám (bỏ qua/hết hạn) hoặc xanh dương (trả lời đúng).
const COLORS = Object.freeze({
  normal: 0x9b59b6,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  red: 0xe74c3c,
  gray: 0x7f8c8d,
  blue: 0x3498db,
});
function countdownBand(question, now = Date.now()) {
  if (!question?.hard || !question.expiresAt) return "normal";
  const remaining = (question.expiresAt - now) / 1000;
  if (remaining >= 30) return "green";
  if (remaining >= 10) return "yellow";
  return "red";
}
const OUTCOME_BANDS = Object.freeze({ correct: "blue", skipped: "gray", expired: "gray" });
function questionColor(question, outcome = null, now = Date.now()) {
  return COLORS[OUTCOME_BANDS[outcome] || countdownBand(question, now)];
}

function questionEmbed(guildId, question, notice = null, outcome = null) {
  const baseReward = getGameReward(guildId, "vuatiengviet");
  const reward = baseReward * (question.hard ? 10 : 1);
  return new EmbedBuilder()
    .setColor(questionColor(question, outcome))
    .setTitle("👑 VUA TIẾNG VIỆT")
    .setDescription(
      `Sắp xếp các chữ cái thành từ hoặc cụm từ có nghĩa:\n${vuaQuestionText(question)}`,
    )
    .addFields(
      { name: "Thưởng", value: `${formatCoins(reward)} :coin:`, inline: true },
      ...(question.hard
        ? [{ name: "Thưởng câu khó", value: "10 :gem:", inline: true }]
        : []),
      {
        name: "Thời gian",
        value: question.hard
          ? `${question.durationSeconds} giây`
          : "Không giới hạn",
        inline: true,
      },
      ...(notice
        ? [
            {
              name: "Cập nhật",
              value: String(notice).slice(0, 1024),
              inline: false,
            },
          ]
        : []),
    )
    .setFooter({
      text: question.hard
        ? "Nhập đáp án trong channel • Câu khó không thể bỏ qua"
        : "Nhập đáp án trong channel • Bỏ qua: giới hạn lượt/ngày, hồi chiêu 5 phút mỗi người",
    });
}

function controlRows(question) {
  const buttons = [];
  if (!question?.hard)
    buttons.push(
      new ButtonBuilder()
        .setCustomId("vuatiengviet:skip")
        .setLabel("Bỏ qua câu")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Secondary),
    );
  return buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [];
}

async function updateQuestionMessage(guildId, channel, notice = null) {
  const session = getVuaSession(guildId);
  if (!session || !channel?.isTextBased?.()) return null;
  const payload = {
    content: null,
    embeds: [questionEmbed(guildId, session.question, notice)],
    components: controlRows(session.question),
    allowedMentions: { parse: [] },
  };
  let message = null;
  if (session.uiMessageId && channel.messages?.fetch)
    message = await channel.messages
      .fetch(session.uiMessageId)
      .catch(() => null);
  if (message) return message.edit(payload);
  message = await channel.send(payload);
  setVuaUiMessage(guildId, channel.id, message.id);
  return message;
}

async function postNextQuestionMessage(guildId, channel, outcome = "correct") {
  const session = getVuaSession(guildId);
  if (!session || !channel?.isTextBased?.()) return null;
  const previousMessageId = session.uiMessageId;
  const message = await channel.send({
    content: null,
    embeds: [questionEmbed(guildId, session.question)],
    components: controlRows(session.question),
    allowedMentions: { parse: [] },
  });
  setVuaUiMessage(guildId, channel.id, message.id);
  if (
    previousMessageId &&
    previousMessageId !== message.id &&
    channel.messages?.fetch
  ) {
    const previousMessage = await channel.messages
      .fetch(previousMessageId)
      .catch(() => null);
    if (previousMessage) {
      const old = previousMessage.embeds?.[0];
      await previousMessage
        .edit({
          embeds: old
            ? [EmbedBuilder.from(old).setColor(COLORS[OUTCOME_BANDS[outcome] || "blue"])]
            : previousMessage.embeds,
          components: [],
        })
        .catch(() => null);
    }
  }
  return message;
}

async function updateEndedMessage(channel, session, userId) {
  if (!session?.uiMessageId || !channel?.messages?.fetch) return false;
  const message = await channel.messages
    .fetch(session.uiMessageId)
    .catch(() => null);
  if (!message) return false;
  const ended = new EmbedBuilder()
    .setColor(0x7f8c8d)
    .setTitle("👑 VUA TIẾNG VIỆT")
    .setDescription(`🛑 Phiên đã được kết thúc bởi <@${userId}>.`);
  await message.edit({
    content: null,
    embeds: [ended],
    components: [],
    allowedMentions: { parse: [] },
  });
  return true;
}

function skipErrorText(result) {
  if (result.error === "HARD_QUESTION") return "Câu khó không thể bỏ qua.";
  if (result.error === "LIMIT_REACHED")
    return `Bạn đã dùng hết **${result.limit} lượt bỏ qua** hôm nay.`;
  if (result.error === "COOLDOWN")
    return `Bạn đang hồi chiêu bỏ qua. Dùng lại <t:${Math.ceil(result.cooldownUntil / 1000)}:R>.`;
  return "Hiện chưa có phiên Vua Tiếng Việt.";
}

function skipStatusText(result) {
  return `⏭️ Đã bỏ qua câu · còn **${result.remaining}/${result.limit} lượt** hôm nay. Lượt tiếp theo sẵn sàng <t:${Math.ceil(result.cooldownUntil / 1000)}:R>.`;
}

const command = {
  data: new SlashCommandBuilder()
    .setName("vuatiengviet")
    .setDescription("Bắt đầu Vua tiếng Việt; quản lý câu hỏi bằng các nút"),
  async execute(interaction) {
    if (!interaction.guildId)
      return interaction.reply({
        content: "Game chỉ chơi được trong server.",
        flags: MessageFlags.Ephemeral,
      });
    if (!isAdmin(interaction))
      return interaction.reply({
        content: "Chỉ admin mới được mở phiên Vua Tiếng Việt.",
        flags: MessageFlags.Ephemeral,
      });
    if (!(await requireGameChannel(interaction, "vuatiengviet"))) return;
    const guildId = interaction.guildId;
    let session = getVuaSession(guildId);
    if (!session) session = startVuaSession(guildId);
    if (session.uiMessageId) {
      const existing =
        session.uiChannelId === interaction.channelId
          ? await interaction.channel.messages
              .fetch(session.uiMessageId)
              .catch(() => null)
          : null;
      if (existing) {
        const link = `https://discord.com/channels/${guildId}/${session.uiChannelId || interaction.channelId}/${session.uiMessageId}`;
        return interaction.reply({
          content: `Phiên Vua Tiếng Việt đang chạy: ${link}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    await interaction.reply({
      embeds: [questionEmbed(guildId, session.question)],
      components: controlRows(session.question),
    });
    const message = await interaction.fetchReply();
    setVuaUiMessage(guildId, interaction.channelId, message.id);
    return message;
  },
  async handleButton(interaction) {
    if (
      !interaction.guildId ||
      !channelHasGame(
        interaction.guildId,
        interaction.channelId,
        "vuatiengviet",
      )
    )
      return interaction.reply({
        content: "Các nút này chỉ dùng trong channel Vua tiếng Việt.",
        flags: MessageFlags.Ephemeral,
      });
    const [, action] = interaction.customId.split(":");
    const session = getVuaSession(interaction.guildId);
    if (!session)
      return interaction.reply({
        content: "Phiên Vua tiếng Việt đã kết thúc hoặc không còn hoạt động.",
        flags: MessageFlags.Ephemeral,
      });
    if (
      session.uiMessageId &&
      interaction.message?.id !== session.uiMessageId
    )
      return interaction.reply({
        content:
          "UI câu hỏi này đã cũ. Hãy dùng các nút trên tin câu hỏi mới nhất.",
        flags: MessageFlags.Ephemeral,
      });
    if (action !== "skip")
      return interaction.reply({
        content: "Thao tác không hợp lệ.",
        flags: MessageFlags.Ephemeral,
      });
    const result = skipVuaSessionForPlayer(
      interaction.guildId,
      interaction.user.id,
    );
    if (result.error)
      return interaction.reply({
        content: skipErrorText(result),
        flags: MessageFlags.Ephemeral,
      });
    await interaction.deferUpdate();
    const oldMessage = await interaction.channel.messages
      .fetch(session.uiMessageId)
      .catch(() => null);
    if (oldMessage)
      await oldMessage
        .edit({
          embeds: [
            questionEmbed(
              interaction.guildId,
              result.skipped,
              `⏭️ Đã bỏ qua · Đáp án: **${result.skipped.answer}**`,
              "skipped",
            ),
          ],
          components: [],
          allowedMentions: { parse: [] },
        })
        .catch(() => null);
    await postNextQuestionMessage(interaction.guildId, interaction.channel, "skipped");
    return interaction.followUp({
      content: skipStatusText(result),
      flags: MessageFlags.Ephemeral,
    });
  },
  questionEmbed,
  questionColor,
  countdownBand,
  COLORS,
  controlRows,
  isAdmin,
  updateQuestionMessage,
  postNextQuestionMessage,
};

const playerCommand = {
  data: new SlashCommandBuilder()
    .setName("vtv")
    .setDescription("Bắt đầu và quản lý Vua tiếng Việt")
    .addSubcommand((option) =>
      option
        .setName("batdau")
        .setDescription("Bắt đầu phiên Vua tiếng Việt (chỉ admin)"),
    )
    .addSubcommand((option) =>
      option
        .setName("boqua")
        .setDescription("Bỏ qua câu hiện tại bằng một lượt cá nhân"),
    )
    .addSubcommand((option) =>
      option
        .setName("ketthuc")
        .setDescription("Kết thúc phiên hiện tại (chỉ admin)"),
    ),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === "batdau")
      return command.execute(interaction);
    if (!interaction.guildId)
      return interaction.reply({
        content: "Lệnh này chỉ dùng trong server.",
        flags: MessageFlags.Ephemeral,
      });
    if (!(await requireGameChannel(interaction, "vuatiengviet"))) return;
    if (interaction.options.getSubcommand() === "ketthuc") {
      if (!isAdmin(interaction))
        return interaction.reply({
          content: "Chỉ admin mới được kết thúc phiên.",
          flags: MessageFlags.Ephemeral,
        });
      const session = getVuaSession(interaction.guildId);
      if (!session)
        return interaction.reply({
          content: "Hiện chưa có phiên Vua Tiếng Việt.",
          flags: MessageFlags.Ephemeral,
        });
      endVuaSession(interaction.guildId);
      await updateEndedMessage(
        interaction.channel,
        session,
        interaction.user.id,
      );
      return interaction.reply({
        content: "🛑 Đã kết thúc phiên Vua Tiếng Việt.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!getVuaSession(interaction.guildId))
      return interaction.reply({
        content:
          "Hiện chưa có phiên Vua Tiếng Việt. Hãy nhờ admin bắt đầu bằng `/vtv batdau`.",
        flags: MessageFlags.Ephemeral,
      });
    const result = skipVuaSessionForPlayer(
      interaction.guildId,
      interaction.user.id,
    );
    if (result.error)
      return interaction.reply({
        content: skipErrorText(result),
        flags: MessageFlags.Ephemeral,
      });
    const session = getVuaSession(interaction.guildId);
    const oldMessage = session?.uiMessageId
      ? await interaction.channel.messages
          .fetch(session.uiMessageId)
          .catch(() => null)
      : null;
    if (oldMessage)
      await oldMessage
        .edit({
          embeds: [
            questionEmbed(
              interaction.guildId,
              result.skipped,
              `⏭️ Đã bỏ qua · Đáp án: **${result.skipped.answer}**`,
              "skipped",
            ),
          ],
          components: [],
          allowedMentions: { parse: [] },
        })
        .catch(() => null);
    await postNextQuestionMessage(interaction.guildId, interaction.channel, "skipped");
    return interaction.reply({
      content: skipStatusText(result),
      flags: MessageFlags.Ephemeral,
    });
  },
};

module.exports = { ...command, playerCommand };

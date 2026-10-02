'use strict';

const crypto = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getAccount } = require('./economyService');
const { getGameBetLimit } = require('./gameBetLimitService');
const { formatCoins } = require('../utils/economy');
const {
  MIN_BET, MAX_BET, CLASSES, startHardcore, getHardcoreByUser, setMessageId, hardcoreEmbed, hardcoreRows,
} = require('./hardcoreService');

const SETUP_TTL_MS = 5 * 60 * 1000;
const setups = new Map();
const setupByUser = new Map();

function setupKey(guildId, userId) { return `${guildId}:${userId}`; }
function removeSetup(setup) {
  if (!setup) return;
  if (setup.timer) clearTimeout(setup.timer);
  setups.delete(setup.token);
  if (setupByUser.get(setupKey(setup.guildId, setup.userId)) === setup.token) setupByUser.delete(setupKey(setup.guildId, setup.userId));
}
function touchSetup(setup) {
  if (setup.timer) clearTimeout(setup.timer);
  setup.expiresAt = Date.now() + SETUP_TTL_MS;
  setup.timer = setTimeout(() => removeSetup(setup), SETUP_TTL_MS);
  setup.timer.unref?.();
  return setup;
}
function createSetup({ guildId, channelId, userId }) {
  const key = setupKey(guildId, userId);
  removeSetup(setups.get(setupByUser.get(key)));
  const setup = {
    token: crypto.randomBytes(6).toString('hex'), guildId: String(guildId), channelId: String(channelId), userId: String(userId),
    classKey: null, stake: null, createdAt: Date.now(), expiresAt: 0,
  };
  setups.set(setup.token, setup); setupByUser.set(key, setup.token);
  return touchSetup(setup);
}
function getSetup(token) {
  const setup = setups.get(String(token));
  if (setup && setup.expiresAt <= Date.now()) { removeSetup(setup); return null; }
  return setup || null;
}
function classLine([key, value]) {
  return `${value.emoji} **${value.name}** · ${value.hp} HP · ${value.damageMin}–${value.damageMax} sát thương · ${value.defense} Defense · ${value.skill}`;
}
function setupPanel(setup, status = null) {
  const balance = getAccount(setup.guildId, setup.userId).balance;
  const maxBet = Math.min(MAX_BET, getGameBetLimit(setup.guildId, 'hardcore'));
  const selectedClass = setup.classKey ? CLASSES[setup.classKey] : null;
  const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('⚔️ SINH TỒN · CHUẨN BỊ RUN')
    .setDescription([
      '**1. Chọn nhân vật** để xem chỉ số và kỹ năng.',
      '**2. Nhập xu** để đặt mức cược.',
      '**3. Bắt đầu** khi đã chọn xong; xu chỉ được giữ khi xác nhận.',
      status ? `\n${status}` : null,
    ].filter(Boolean).join('\n'))
    .addFields(
      { name: '💰 Số dư', value: `${formatCoins(balance)} xu`, inline: true },
      { name: '🎟️ Cược đã chọn', value: setup.stake ? `${formatCoins(setup.stake)} xu` : 'Chưa nhập', inline: true },
      { name: '📏 Giới hạn cược', value: `${formatCoins(MIN_BET)}–${formatCoins(maxBet)} xu`, inline: true },
      { name: selectedClass ? `${selectedClass.emoji} Nhân vật đã chọn` : '🧙 Chọn một trong 7 nhân vật', value: selectedClass ? classLine([setup.classKey, selectedClass]) : Object.entries(CLASSES).map(classLine).join('\n'), inline: false },
      { name: '📖 Ký hiệu', value: '❤️ HP · ⚔️ sát thương · 🛡️ phòng thủ · 🎯 chính xác · 💨 né · 💢 chí mạng · 🔮 kháng phép', inline: false },
    )
    .setFooter({ text: 'Bảng chuẩn bị hết hạn sau 5 phút không thao tác.' });

  const select = new StringSelectMenuBuilder().setCustomId(`hardcore-setup-class:${setup.token}`)
    .setPlaceholder('Chọn nhân vật và xem kỹ năng')
    .addOptions(Object.entries(CLASSES).map(([key, value]) => new StringSelectMenuOptionBuilder()
      .setLabel(value.name).setValue(key).setEmoji(value.emoji)
      .setDescription(`${value.hp} HP · ${value.damageMin}–${value.damageMax} damage · ${value.skill}`)
      .setDefault(key === setup.classKey)));
  const ready = Boolean(setup.classKey && setup.stake);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hardcore-setup-bet:${setup.token}`).setLabel('Nhập xu').setEmoji('💰').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`hardcore-setup-start:${setup.token}`).setLabel('Bắt đầu').setEmoji('⚔️').setStyle(ButtonStyle.Success).setDisabled(!ready),
    new ButtonBuilder().setCustomId(`hardcore-setup-cancel:${setup.token}`).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), buttons] };
}
async function respond(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  return interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
}
function ownedSetup(interaction) {
  const token = interaction.customId.split(':').at(-1);
  const setup = getSetup(token);
  if (!setup) return { error: 'Bảng chuẩn bị đã hết hạn. Hãy dùng lại `/choi sinhton batdau`.' };
  if (setup.userId !== String(interaction.user.id) || setup.guildId !== String(interaction.guildId)) return { error: 'Đây không phải bảng chuẩn bị của bạn.' };
  return { setup };
}
async function openHardcoreSetup(interaction) {
  if (getHardcoreByUser(interaction.guildId, interaction.user.id)) {
    return interaction.reply({ content: 'Bạn đang có một lượt Sinh tồn chưa kết thúc. Dùng `/choi sinhton tieptuc`.', flags: MessageFlags.Ephemeral });
  }
  const setup = createSetup({ guildId: interaction.guildId, channelId: interaction.channelId, userId: interaction.user.id });
  return interaction.reply({ ...setupPanel(setup), flags: MessageFlags.Ephemeral });
}
async function handleSetupClass(interaction) {
  const checked = ownedSetup(interaction); if (checked.error) return respond(interaction, checked.error);
  const classKey = interaction.values?.[0];
  if (!CLASSES[classKey]) return respond(interaction, 'Nhân vật không hợp lệ.');
  checked.setup.classKey = classKey; touchSetup(checked.setup);
  return interaction.update(setupPanel(checked.setup, `✅ Đã chọn **${CLASSES[classKey].name}**.`));
}
async function handleSetupButton(interaction) {
  const checked = ownedSetup(interaction); if (checked.error) return respond(interaction, checked.error);
  const setup = checked.setup;
  const action = interaction.customId.split(':')[0].replace('hardcore-setup-', '');
  if (action === 'cancel') {
    removeSetup(setup);
    return interaction.update({ content: 'Đã hủy bảng chuẩn bị Sinh tồn.', embeds: [], components: [] });
  }
  if (action === 'bet') {
    const maxBet = Math.min(MAX_BET, getGameBetLimit(setup.guildId, 'hardcore'));
    const input = new TextInputBuilder().setCustomId('stake').setLabel(`Tiền cược (${MIN_BET}–${maxBet} xu)`)
      .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(6).setPlaceholder('Ví dụ: 1000');
    if (setup.stake) input.setValue(String(setup.stake));
    return interaction.showModal(new ModalBuilder().setCustomId(`hardcore-setup-modal:${setup.token}`).setTitle('Nhập tiền cược Sinh tồn')
      .addComponents(new ActionRowBuilder().addComponents(input)));
  }
  if (action !== 'start') return respond(interaction, 'Thao tác không hợp lệ.');
  if (!setup.classKey || !setup.stake) return respond(interaction, 'Hãy chọn nhân vật và nhập tiền cược trước.');
  if (setup.starting) return respond(interaction, 'Run đang được khởi tạo, vui lòng chờ bảng game xuất hiện.');
  setup.starting = true;
  try {
    await interaction.deferUpdate();
    const started = startHardcore({ guildId: setup.guildId, channelId: setup.channelId, userId: setup.userId, stake: setup.stake, classKey: setup.classKey });
    removeSetup(setup);
    await interaction.editReply({ embeds: [hardcoreEmbed(started.state, setup.userId, null, started.session.id)], components: hardcoreRows(started.session.id, started.state), content: null });
    if (interaction.message?.id) setMessageId(started.session.id, interaction.message.id);
    return started;
  } catch (error) {
    setup.starting = false; touchSetup(setup);
    const text = error.message === 'ACTIVE_SESSION' ? 'Bạn đang có một lượt Sinh tồn chưa kết thúc.'
      : error.code === 'INSUFFICIENT_FUNDS' ? 'Số dư hiện tại không đủ cho mức cược này.'
        : error.message === 'BET_LIMIT' ? `Giới hạn cược Sinh tồn hiện tại là **${formatCoins(error.maxBet)} xu**.`
          : 'Không thể bắt đầu run lúc này. Hãy nhập lại tiền cược.';
    if (interaction.deferred || interaction.replied) return interaction.editReply({ ...setupPanel(setup, `❌ ${text}`), content: null });
    return respond(interaction, text);
  }
}
async function handleSetupModal(interaction) {
  const checked = ownedSetup(interaction); if (checked.error) return respond(interaction, checked.error);
  const setup = checked.setup;
  const raw = String(interaction.fields.getTextInputValue('stake') || '').trim();
  const stake = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const maxBet = Math.min(MAX_BET, getGameBetLimit(setup.guildId, 'hardcore'));
  const balance = getAccount(setup.guildId, setup.userId).balance;
  if (!Number.isSafeInteger(stake) || stake < MIN_BET || stake > maxBet) return respond(interaction, `Tiền cược phải từ **${formatCoins(MIN_BET)}** đến **${formatCoins(maxBet)} xu**.`);
  if (stake > balance) return respond(interaction, `Bạn chỉ có **${formatCoins(balance)} xu**.`);
  setup.stake = stake; touchSetup(setup);
  return interaction.update(setupPanel(setup, `✅ Đã đặt cược **${formatCoins(stake)} xu**. Xu chưa bị trừ.`));
}

module.exports = {
  SETUP_TTL_MS, createSetup, getSetup, setupPanel, openHardcoreSetup,
  handleSetupClass, handleSetupButton, handleSetupModal,
};

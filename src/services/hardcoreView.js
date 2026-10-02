const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { formatCoins } = require('../utils/economy');
const { baseMultiplier, potentialPayout, payoutLoss } = require('./hardcoreEngine');
const { resultBlock, coins } = require('../utils/rewardText');
const emojiMap = require('../discordEmojiMap');
const { rarityLabel, normalizeEquipment, effectText } = require('./hardcoreEquipment');
const { MODIFIERS, regionForFloor, modifierStacks } = require('./hardcoreWorld');

const icon = (name, fallback = '•') => emojiMap[`:${name}:`] || fallback;

function hpBar(current, maximum, size = 10) {
  const ratio = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}
function damageTypeText(type) { return { physical: '⚔️ Vật lý', magic: '🔮 Phép', mixed: '🌓 Hỗn hợp' }[type] || '🌓 Hỗn hợp'; }
function battleText(state) {
  const enemy = state.encounter;
  const classInfo = { amazon: 'Amazon', assassin: 'Assassin', barbarian: 'Barbarian', druid: 'Druid', necromancer: 'Necromancer', paladin: 'Paladin', sorceress: 'Sorceress' }[state.classKey] || state.className;
  const intent = enemy.nextAttackType || enemy.damageType || 'physical';
  const mechanic = enemy.mechanicDescription ? `\n${icon('warning')} ${enemy.mechanicDescription}` : '';
  return [
    `### ${icon('japanese_goblin', '👹')} ${enemy.name} · ${rankLabel(enemy.rank)}`,
    `${icon('heart')} \`${hpBar(enemy.hp, enemy.maxHp)}\` **${formatCoins(enemy.hp)}/${formatCoins(enemy.maxHp)} HP**`,
    `${icon('crossed_swords')} ${formatCoins(enemy.damageMin)}–${formatCoins(enemy.damageMax)} · ${damageTypeText(enemy.damageType)} · ${icon('shield')} ${formatCoins(enemy.defense)} Defense`,
    `🎯 **Đòn kế tiếp:** ${damageTypeText(intent)}${mechanic}`,
    '',
    `### ${classInfo}`,
    `${icon('heart')} \`${hpBar(state.hp, state.maxHp)}\` **${formatCoins(state.hp)}/${formatCoins(state.maxHp)} HP**`,
    `${icon('sparkles')} Energy **${state.energy}/${state.maxEnergy}** · ${icon('test_tube')} **${state.potions}** bình · ${icon('mirror')} **${state.escapeTokens}** vé`,
    `${icon('crossed_swords')} ${formatCoins(state.damageMin)}–${formatCoins(state.damageMax)} · ${icon('shield')} ${formatCoins(state.defense)} Defense · ${icon('crystal_ball')} ${state.resistance}% Resist`,
  ].join('\n');
}
function battleColor(state, result) {
  if (result) return result.outcome === 'win' ? 0x2ECC71 : 0xE74C3C;
  if (state.encounter?.rank === 'final_boss') return 0x7B241C;
  if (['boss', 'ancient_mimic'].includes(state.encounter?.rank)) return 0x8E44AD;
  const ratio = state.maxHp > 0 ? state.hp / state.maxHp : 0;
  if (ratio <= 0.3) return 0xE74C3C;
  if (ratio <= 0.6) return 0xF1C40F;
  return 0x2ECC71;
}

function rankLabel(rank) { return { normal: 'Thường', elite: 'Elite', boss: 'BOSS', final_boss: 'BOSS CUỐI', mimic: 'Mimic', ancient_mimic: 'Ancient Mimic' }[rank] || rank; }
function encounterText(state) {
  const encounter = state.encounter;
  if (state.phase === 'upgrade') return `${icon('gift')} **NÂNG CẤP SAU MỐC TẦNG ${encounter.milestone}**\nChọn đúng một nút để nhận nâng cấp trong phần còn lại của run. +HP tăng giới hạn tối đa và hồi 30 HP; Rút thưởng chốt payout.`;
  if (state.phase === 'summit') return `${icon('trophy')} **ĐÃ CHINH PHỤC TẦNG 999**\nĐây là giới hạn Sinh tồn. Bấm **Rút thưởng** để nhận payout hiện tại.`;
  if (encounter.type === 'combat') {
    const skillHint = {
      amazon: 'Barrage bắn hai phát liên tiếp.',
      assassin: 'Shadow Step gây thêm sát thương và né phản công.',
      barbarian: 'Iron Will gây thêm sát thương vật lý.',
      druid: 'Wild Regeneration tấn công và hồi 12% HP tối đa.',
      necromancer: 'Totem Ward gây sát thương phép và đỡ đòn phản công.',
      paladin: 'Divine Shield tấn công rồi phòng thủ trước đòn phản công.',
      sorceress: 'Arcane Burst gây sát thương phép mạnh.',
    }[state.classKey] || 'Dùng kỹ năng riêng của class.';
    const mechanic = encounter.mechanicDescription ? `\n${icon('warning')} **Cơ chế boss:** ${encounter.mechanicDescription}` : '';
    const damageType = { physical: 'Vật lý', magic: 'Phép', mixed: 'Hỗn hợp' }[encounter.damageType] || 'Hỗn hợp';
    return `${icon('crossed_swords')} **${encounter.name}** · ${rankLabel(encounter.rank)}\n${icon('heart')} ${formatCoins(encounter.hp)}/${formatCoins(encounter.maxHp)} HP · ${icon('crossed_swords')} ${formatCoins(encounter.damageMin)}–${formatCoins(encounter.damageMax)} · **${damageType}** · ${icon('shield')} ${formatCoins(encounter.defense)}${mechanic}\n**Tấn công:** đánh và hồi 1 năng lượng. **Phòng thủ:** Defense x2, chặn thêm 40% sát thương, miễn chí mạng và hồi 1 năng lượng. **Kỹ năng:** tốn 2 năng lượng — ${skillHint}\n**Bình máu:** hồi 35% HP tối đa; quái vẫn đánh trả nếu còn sống.`;
  }
  if (encounter.type === 'chest') return `${icon('package')} **HÒM BÍ ẨN**\n${encounter.inspected ? 'Đã kiểm tra một lần; kết quả có thể không phát hiện được Mimic.' : 'Kiểm tra một lần để thử phát hiện Mimic; Mở để nhận đồ hoặc có thể phải đánh Mimic; Bán để lấy thêm 15% tiền cược vào payout.'}${encounter.revealed ? `\n${icon('warning')} Mimic đã bị phát hiện: **Tránh Mimic** để đi tiếp an toàn.` : ''}`;
  if (encounter.type === 'shrine') return `${icon('moyai')} **SHRINE KHÔNG RÕ NGUỒN GỐC**\n**Chạm Shrine** để nhận hiệu ứng ngẫu nhiên (có cả hiệu ứng gây hại), hoặc **Bỏ qua** để đi tiếp.`;
  if (encounter.type === 'rngesus') return `${icon('skull')} **RNGesus · HP ∞ · KHÔNG THỂ BỊ ĐÁNH BẠI**\nChiến đấu là chết. Bỏ chạy: 75% sống; nếu thất bại, Vé Thoát Hiểm tự dùng làm bảo hiểm. Hối lộ: mất 40% payout, hiện tương đương **${formatCoins(payoutLoss(state, 0.6))} xu**. Cầu nguyện: 10% nhận trang bị SSR trở lên, nếu trượt sẽ chết. Vé: chủ động tiêu thụ 1 vé để thoát.`;
  if (encounter.type === 'trap') {
    const names = { tax_collector: '🧾 TAX COLLECTOR', potion_thief: '🦹 KẺ TRỘM BÌNH MÁU', wrong_portal: '🌀 WRONG PORTAL' };
    const breakChance = Math.round((encounter.luckyBreakChance ?? Math.min(0.3, Math.max(0, state.luck || 0) * 0.015)) * 1000) / 10;
    const goodChance = Math.round((encounter.portalGoodChance ?? 0.5) * 1000) / 10;
    const detail = encounter.kind === 'tax_collector' ? `Đi tiếp sẽ giảm payout 15%, hiện tương đương **${formatCoins(payoutLoss(state, 0.85))} xu**.`
      : encounter.kind === 'potion_thief' ? 'Đi tiếp có thể mất 1 bình máu.'
        : `Portal có **${goodChance}%** dẫn tới khu vực có lợi; phần còn lại có thể làm mất tối đa **${formatCoins(payoutLoss(state, 0.9))} xu payout**, gây hiệu ứng Rift xấu, giữ nguyên tầng rồi buộc đấu một Elite được đánh phủ đầu.`;
    const luck = encounter.kind === 'wrong_portal' ? `\n⚖️ Portal tốt **${goodChance}%** · Portal xấu **${100 - goodChance}%** · Luck không ảnh hưởng.`
      : `\n🍀 Luck hiện tại: **${state.luck}** · Lucky Break **${breakChance}%**.`;
    return `**${names[encounter.kind]}**\nChọn **Chấp nhận số phận** để xử lý: ${detail}${luck}`;
  }
  if (encounter.type === 'surprise') {
    if (encounter.kind === 'blacksmith') return `🔨 **THỢ RÈN LANG THANG**\nNâng **${encounter.itemName} Lv.${encounter.itemLevel}** thêm 1 cấp với giá **${formatCoins(encounter.cost)} xu từ payout hiện tại**. Cấp mới cộng lại hiệu ứng của item.`;
    if (encounter.kind === 'purifier') return `✨ **TU SĨ GIẢI NGUYỀN**\nGiải lời nguyền của **${encounter.itemName} Lv.${encounter.itemLevel}** với giá **${formatCoins(encounter.cost)} xu từ payout hiện tại**. Item giữ hiệu ứng có lợi và trở thành SSR; các hiệu ứng phạt được hoàn tác.`;
    if (encounter.kind === 'wandering_healer') return `🧙 **NGƯỜI CHỮA TRỊ LANG THANG**\nNhận miễn phí tối đa **${formatCoins(encounter.heal)} HP** và 1 bình máu, hoặc bỏ qua.`;
    if (encounter.kind === 'treasure_goblin') {
      const chance = Math.round((encounter.successChance ?? 0.6) * 1000) / 10;
      return `🪙 **TREASURE GOBLIN**\nĐuổi theo để có **${chance}%** cơ hội cộng **${formatCoins(encounter.reward)} xu** vào payout. Nếu hụt, nó cuỗm **${formatCoins(payoutLoss(state, 1 - encounter.penaltyRate))} xu** theo payout hiện tại. Luck tăng 1% cơ hội mỗi điểm, tối đa 80%.`;
    }
    if (encounter.kind === 'altar_of_sacrifice') return `🩸 **ALTAR OF SACRIFICE**\nHiến tối đa **${encounter.hpCost} HP** để nhận +3 sát thương, hoặc hiến **${formatCoins(encounter.payoutCost)} xu payout** để nhận +3 Defense. Event không thể trực tiếp giảm HP xuống dưới 1.`;
    if (encounter.kind === 'cursed_gambler') return `🎲 **CURSED GAMBLER**\nChọn cược 10% hoặc 25% payout. Tỷ lệ thắng **50%**; thắng nhận lại gấp đôi tiền đã đặt, thua mất toàn bộ khoản cược.`;
    if (encounter.kind === 'lost_adventurer') return `🧭 **LOST ADVENTURER**\nDùng 1 bình máu để cứu và nhận trang bị R/SR, hoặc cướp đồ ngay để nhận R nhưng có **25%** khả năng dính UR bị nguyền.`;
    if (encounter.kind === 'blood_fountain') return '🩸 **BLOOD FOUNTAIN**\nUống máu: 60% hồi đầy HP · 25% nhận +15 HP tối đa · 15% đánh thức Blood Mimic.';
    if (encounter.kind === 'horadric_forge') return `⚒️ **HORADRIC FORGE**\nNghiền 1 cấp **${encounter.itemName} Lv.${encounter.itemLevel}** để đổi lấy chỉ số. Hiệu ứng item đã hấp thụ trước đó vẫn được giữ.`;
    if (encounter.kind === 'rift_merchant') return `🛒 **RIFT MERCHANT**\nChọn mua đúng một món bằng payout:\n${encounter.offers.map((offer, index) => `**${index + 1}. ${offer.name}:** ${formatCoins(offer.cost)} xu`).join('\n')}`;
    if (encounter.kind === 'mirror_of_fate') return '🪞 **MIRROR OF FATE**\nSức mạnh: tăng 10% damage nhưng mất 10% HP tối đa. Phòng thủ: +8 Defense, −2 damage. Đập gương: 20% nhận +2 Luck, còn lại phải đấu Mirror Clone.';
    if (encounter.kind === 'treasure_room') {
      const reveal = encounter.revealedColor ? `\n👁️ Đã kiểm tra: hòm **${encounter.revealedColor}** ${encounter.revealedColor === encounter.mimicColor ? 'là Mimic' : 'an toàn'}.` : '';
      return `💎 **TREASURE ROOM**\nĐỏ thiên về sát thương · Xanh thiên về phòng thủ · Vàng thiên về payout và Luck. Một hòm là Mimic; bạn được kiểm tra một lần.${reveal}`;
    }
    if (encounter.kind === 'rift_contract') {
      const text = { no_potion: 'Không dùng bình máu → nhận một trang bị SSR.', no_skill: 'Không dùng kỹ năng → +50% tiền cược vào payout.', no_defend: 'Không phòng thủ → +5 sát thương.' }[encounter.contractKind];
      return `📜 **RIFT CONTRACT**\nTrong 3 tầng tiếp theo: **${text}** Vi phạm chỉ làm mất phần thưởng hợp đồng.`;
    }
    if (encounter.kind === 'class_shrine') {
      const text = { amazon: 'Barrage có 20% bắn phát thứ ba.', barbarian: 'Dưới 30% HP nhận +8 Defense.', assassin: 'Chắc chắn né đòn phản công kế tiếp.', druid: 'Hồi 5% HP sau mỗi tầng.', necromancer: 'Chặn hoàn toàn đòn trúng kế tiếp.', paladin: '+10 Resistance khi nhận phép.', sorceress: 'Kỹ năng kế tiếp không tốn Energy.' }[state.classKey];
      return `⛩️ **CLASS SHRINE · ${state.className || state.classKey}**\nTrong tối đa 3 tầng: **${text}**`;
    }
    return '🚪 **THE DOOR THAT SHOULD NOT EXIST**\nCửa sáng thiên về hồi phục · cửa vàng thiên về payout · cửa đen thiên về SSR. Mỗi cánh cửa đều có thể dẫn tới kết quả ngược lại.';
  }
  return '🕳️ **PHÒNG TRỐNG**\nBấm **Đi tiếp** để vượt tầng. Có thể rút thưởng thay vì tiếp tục.';
}
function chaosLabel(state) {
  const chance = state.lastChaosChance || 0;
  if (!chance) return `${icon('large_green_circle')} Chaos: Yên`;
  if (chance < 0.01) return `${icon('large_green_circle')} Chaos: Thấp`;
  if (chance < 0.03) return `${icon('large_yellow_circle')} Chaos: Bất ổn`;
  return `${icon('red_circle')} Chaos: NGUY HIỂM${state.lastChaosSpike ? ' · SPIKE' : ''}`;
}
function signed(value, percent = false) {
  const amount = percent ? Math.round(value * 100) : value;
  return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatCoins(Math.abs(amount))}${percent ? '%' : ''}`;
}
function change(state, key, percent = false) {
  const amount = state.lastStatChanges?.[key] || 0;
  return amount ? ` (${signed(amount, percent)})` : '';
}
function statLine(state) {
  const hpChange = state.lastStatChanges?.hp || 0;
  const maxHpChange = state.lastStatChanges?.maxHp || 0;
  const hpDelta = hpChange || maxHpChange ? ` (${signed(hpChange)}/${signed(maxHpChange)})` : '';
  const minChange = state.lastStatChanges?.damageMin || 0;
  const maxChange = state.lastStatChanges?.damageMax || 0;
  const damageDelta = minChange || maxChange ? ` (${minChange === maxChange ? signed(minChange) : `${signed(minChange)}/${signed(maxChange)}`})` : '';
  return [
    `${icon('heart')} ${formatCoins(state.hp)}/${formatCoins(state.maxHp)}${hpDelta}`,
    `${icon('crossed_swords')} ${formatCoins(state.damageMin)}–${formatCoins(state.damageMax)}${damageDelta}`,
    `${icon('shield')} ${formatCoins(state.defense)}${change(state, 'defense')}`,
    `${icon('sparkles')} ${state.energy}/${state.maxEnergy}${change(state, 'energy')}`,
    `${icon('dart')} ${Math.round(state.critChance * 100)}%${change(state, 'critChance', true)}`,
    `${icon('dash')} ${state.evasion}${change(state, 'evasion')}`,
    `${icon('crystal_ball')} ${state.resistance}%${change(state, 'resistance')}`,
    `${icon('four_leaf_clover')} ${state.luck}${change(state, 'luck')}`,
  ].join(' · ');
}
function equipmentLines(state, itemCatalog) {
  const owned = normalizeEquipment(state.items);
  const definitions = new Map(Object.values(itemCatalog).flat().map(item => [item.name, item]));
  return owned.map(item => {
    const definition = definitions.get(item.name);
    const source = definition ? { ...definition, ...item, effects: item.effects || definition.effects,
      curse: item.purified ? null : (item.curse || definition.curse) } : item;
    const label = `${item.typeCode || rarityLabel(item.rarity)}${item.purified ? ' · Đã giải nguyền' : ''}`;
    return `• **${item.name} Lv.${item.level}** [${label}] — ${effectText(source, item.level)}`;
  });
}
function equipmentSummary(state) {
  const owned = normalizeEquipment(state.items);
  if (!owned.length) return 'Chưa có trang bị.';
  const levels = owned.reduce((sum, item) => sum + item.level, 0);
  const cursed = owned.filter(item => item.rarity === 'cursed' && !item.purified).length;
  return `**${owned.length} món · ${levels} tổng cấp**${cursed ? ` · ${cursed} đang bị nguyền` : ''}\nBấm **Trang bị** để xem công dụng và chuyển trang.`;
}
function temporaryEffectText(state) {
  const parts = [];
  if (state.contract) parts.push(`📜 Hợp đồng ${state.contract.failed ? 'đã vi phạm' : 'đang giữ'} · còn ${Math.max(0, state.contract.targetCleared - state.cleared)} tầng`);
  if (state.classBlessing) parts.push(`⛩️ Class Shrine · còn ${Math.max(0, state.classBlessing.targetCleared - state.cleared)} tầng`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}
function equipmentEmbed(state, itemCatalog, page = 0) {
  const lines = equipmentLines(state, itemCatalog);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(lines.length / pageSize));
  const safePage = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  const visible = lines.slice(safePage * pageSize, safePage * pageSize + pageSize);
  return new EmbedBuilder().setColor(0x3498DB).setTitle(`${icon('school_satchel')} TRANG BỊ TRONG RUN`)
    .setDescription(visible.length ? visible.join('\n\n').slice(0, 4000) : 'Run này chưa có trang bị.')
    .setFooter({ text: `Trang ${safePage + 1}/${pages} · ${lines.length} món · Trang bị biến mất khi run kết thúc` });
}
function equipmentRows(sessionId, state, page = 0) {
  const count = normalizeEquipment(state.items).length;
  const pages = Math.max(1, Math.ceil(count / 8));
  const safePage = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hardcore-items:${sessionId}:${safePage - 1}`).setLabel('Trang trước').setEmoji(icon('arrow_left')).setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
    new ButtonBuilder().setCustomId(`hardcore-items:${sessionId}:${safePage + 1}`).setLabel('Trang sau').setEmoji(icon('arrow_right')).setStyle(ButtonStyle.Secondary).setDisabled(safePage >= pages - 1),
  )];
}
function modifierText(state) {
  const active = [...new Set(Array.isArray(state.modifiers) ? state.modifiers : [])];
  if (!active.length) return 'Chưa có modifier; modifier đầu tiên xuất hiện sau tầng 10.';
  return active.map(key => {
    const definition = MODIFIERS[key] || { name: key, description: 'Hiệu ứng Rift không xác định.' };
    const stacks = modifierStacks(state, key);
    return `• **${definition.name}${stacks > 1 ? ` x${stacks}` : ''}** — ${definition.description}`;
  }).join('\n').slice(0, 1024);
}
function modifierEffectText(key, stacks) {
  if (key === 'stone_skin') return `Defense quái **+${stacks * 10}%** khi encounter được tạo.`;
  if (key === 'elemental_dominion') return `Damage quái **+${stacks * 4}%** · cơ hội dùng phép **+${stacks * 4} điểm %**.`;
  if (key === 'bloodlust') return `Quái còn không quá 50% HP gây thêm **${stacks * 8}% damage**.`;
  if (key === 'unstable_rift') {
    const chestShift = Math.min(16, stacks * 2);
    const mimic = Math.min(30, 15 + stacks * 3);
    const ancient = Math.min(8, 3 + stacks);
    const legendary = Math.min(70, 35 + stacks * 5);
    return `Chuyển **${chestShift}%** encounter quái thường sang hòm · tổng Mimic **${mimic}%** (Ancient **${ancient}%**) · SSR trong hòm kho báu **${legendary}%**.`;
  }
  if (key === 'fortified') return `HP tối đa của quái mới **+${stacks * 10}%**.`;
  if (key === 'swift_horror') return `Quái mới nhận **+${stacks * 3} Accuracy** và **+${stacks} Evasion**.`;
  if (key === 'soul_drain') return `Mỗi đòn quái đánh trúng rút **${stacks >= 5 ? 2 : 1} Energy**.`;
  if (key === 'cursed_ground') return `Resistance hiệu dụng của bạn giảm **${stacks * 4}** khi nhận damage phép.`;
  return 'Không xác định được hiệu ứng.';
}
function riftDetailEmbed(state) {
  const active = [...new Set(Array.isArray(state.modifiers) ? state.modifiers : [])];
  const embed = new EmbedBuilder().setColor(0x71368A).setTitle('🌀 RIFT MODIFIER')
    .setDescription(`Modifier mới xuất hiện sau mỗi 10 tầng. Có đủ 8 loại rồi mới bắt đầu lặp và cộng dồn.\n\n**Tổng cộng dồn hiện tại:** ${state.modifiers?.length || 0}`);
  if (!active.length) return embed.addFields({ name: 'Chưa có hiệu ứng', value: 'Modifier đầu tiên được nhận sau khi vượt tầng 10.' });
  return embed.addFields(active.map(key => {
    const stacks = modifierStacks(state, key);
    return { name: `${MODIFIERS[key]?.name || key}${stacks > 1 ? ` ×${stacks}` : ''}`, value: modifierEffectText(key, stacks), inline: false };
  }));
}
function statsDetailEmbed(state) {
  const itemEffects = [
    state.potionPower ? `Bình máu ${state.potionPower > 0 ? '+' : ''}${Math.round(state.potionPower * 100)}% HP` : null,
    state.bossDamage ? `Boss damage +${Math.round(state.bossDamage * 100)}%` : null,
    state.eliteDamage ? `Elite damage +${Math.round(state.eliteDamage * 100)}%` : null,
    state.mimicDetection ? `Phát hiện Mimic +${Math.round(state.mimicDetection * 100)}%` : null,
    state.goblinChance ? `Bắt Goblin +${Math.round(state.goblinChance * 100)}%` : null,
    state.legendaryFind ? `Tỉ lệ SSR +${Math.round(state.legendaryFind * 100)}%` : null,
    state.floorHpLoss ? `Mất ${Math.round(state.floorHpLoss * 100)}% HP/tầng` : null,
    state.mimicChance ? `Gặp Mimic +${Math.round(state.mimicChance * 100)}%` : null,
    state.damageTaken ? `Nhận damage +${Math.round(state.damageTaken * 100)}%` : null,
  ].filter(Boolean);
  return new EmbedBuilder().setColor(0x3498DB).setTitle('📊 CHỈ SỐ CHI TIẾT')
    .setDescription(statLine(state))
    .addFields(
      { name: 'Tiến trình', value: `Tầng ${state.floor} · đã vượt ${state.cleared} · hạ ${state.bosses} boss`, inline: false },
      { name: 'Rift Modifier', value: modifierText(state), inline: false },
      { name: 'Tài nguyên', value: `${state.potions} bình máu · ${state.escapeTokens} Vé Thoát Hiểm · ${state.luck} Luck`, inline: false },
      { name: 'Hiệu ứng trang bị', value: itemEffects.join(' · ') || 'Không có hiệu ứng đặc biệt.', inline: false },
    );
}
function enemyDetailEmbed(state) {
  const enemy = state.encounter;
  if (enemy?.type !== 'combat') return new EmbedBuilder().setColor(0x95A5A6).setTitle('ℹ️ THÔNG TIN TÌNH HUỐNG').setDescription(encounterText(state));
  return new EmbedBuilder().setColor(['boss', 'final_boss'].includes(enemy.rank) ? 0x8E44AD : 0xE67E22)
    .setTitle(`👹 ${enemy.name} · ${rankLabel(enemy.rank)}`)
    .addFields(
      { name: 'Sinh lực', value: `${formatCoins(enemy.hp)}/${formatCoins(enemy.maxHp)} HP`, inline: true },
      { name: 'Sát thương', value: `${formatCoins(enemy.damageMin)}–${formatCoins(enemy.damageMax)} · ${damageTypeText(enemy.damageType)}`, inline: true },
      { name: 'Phòng thủ', value: `${formatCoins(enemy.defense)} Defense · ${enemy.resistance}% Resist · ${enemy.evasion} Evasion`, inline: true },
      { name: 'Ý định', value: `Đòn kế tiếp: **${damageTypeText(enemy.nextAttackType || enemy.damageType)}**`, inline: false },
      { name: 'Cơ chế', value: enemy.mechanicDescription || 'Không có cơ chế riêng.', inline: false },
    );
}
function hardcoreEmbed(state, userId, result, classes, sessionId = null, itemCatalog = {}) {
  const classInfo = classes[state.classKey]; const payout = potentialPayout(state);
  const region = regionForFloor(state.floor);
  const combat = state.encounter?.type === 'combat' && state.phase !== 'upgrade';
  const classIcon = { amazon: icon('bow_and_arrow', '🏹'), barbarian: icon('axe', '🪓'), assassin: icon('dagger_knife', '🗡️'), druid: icon('wolf', '🐺'), necromancer: icon('skull', '💀'), paladin: icon('fleur_de_lis', '⚜️'), sorceress: icon('crystal_ball', '🔮') }[state.classKey] || classInfo.emoji;
  const embed = new EmbedBuilder().setColor(combat ? battleColor(state, result) : result ? (result.outcome === 'win' ? 0x2ECC71 : 0xE74C3C) : state.floor > 100 ? 0x9B59B6 : 0xE67E22)
    .setTitle(`${classIcon} SINH TỒN · TẦNG ${state.floor}${state.floor > 100 ? ' · OVERRUN' : ''}`)
    .setDescription(combat ? `${icon('bust_in_silhouette')} <@${userId}> · **${region.name}**\n\n${battleText(state)}` : `${icon('bust_in_silhouette')} <@${userId}> · **${region.name}**\n\n**${icon('warning')} Tình huống hiện tại**\n${encounterText(state)}`);
  if (combat) embed.addFields(
      { name: `${icon('compass')} Tiến trình`, value: `Đã vượt ${state.cleared} · Boss ${state.bosses} · Modifier ${Array.isArray(state.modifiers) ? state.modifiers.length : 0} · ${chaosLabel(state)}${temporaryEffectText(state)}`, inline: false },
      { name: `${icon('moneybag')} Rút thưởng`, value: state.cleared ? `**${formatCoins(payout)} :coin:** · x${baseMultiplier(state).toFixed(2)}${state.payoutSpent ? ` · đã dùng ${formatCoins(state.payoutSpent)} xu` : ''}` : 'Chưa thể rút', inline: false },
      { name: `${icon('school_satchel')} Trang bị`, value: equipmentSummary(state), inline: false },
      { name: `${icon('scroll')} Lượt vừa rồi`, value: String(state.lastLog || 'Run bắt đầu.').slice(0, 1024), inline: false },
    );
  else embed.addFields(
      { name: `${icon('bar_chart')} Chỉ số · thay đổi trong lượt vừa rồi`, value: statLine(state), inline: false },
      { name: `${icon('compass')} Tiến trình`, value: `Đã vượt ${state.cleared} · Boss ${state.bosses} · ${icon('test_tube')} ${state.potions}${change(state, 'potions')} · ${icon('mirror')} ${state.escapeTokens}${change(state, 'escapeTokens')} · ${chaosLabel(state)}${temporaryEffectText(state)}`, inline: false },
      { name: '🌀 Rift Modifier đang hoạt động', value: modifierText(state), inline: false },
      { name: `${icon('moneybag')} Rút thưởng`, value: state.cleared ? `**${formatCoins(payout)} :coin:** · x${baseMultiplier(state).toFixed(2)}${state.payoutSpent ? ` · đã dùng ${formatCoins(state.payoutSpent)} xu cho sự kiện` : ''}` : 'Chưa thể rút', inline: false },
      { name: `${icon('school_satchel')} Trang bị`, value: equipmentSummary(state), inline: false },
      { name: `${icon('scroll')} Diễn biến`, value: String(state.lastLog || '—').slice(0, 1024), inline: false },
    );
  if (result) {
    const won = result.reason === 'cashout' || result.reason === 'summit';
    const reason = won ? `rút thưởng tầng ${state.floor}` : result.reason === 'forfeit' ? 'bỏ run' : `💀 tử trận tầng ${state.floor}`;
    embed.addFields({ name: `${icon('checkered_flag')} KẾT QUẢ`, value: resultBlock({ userId, outcome: result.outcome, stake: state.stake, payout: result.payout, result, reason }) });
    if (result.achievements?.length) embed.addFields({ name: `${icon('sports_medal')} Thành tựu mới`, value: result.achievements.map(item => `**${item.name}**`).join('\n') });
  } else embed.setFooter({ text: `${sessionId ? `Mã ván: ${sessionId} • ` : ''}Lượt ${state.turn} • Cược ${formatCoins(state.stake)} :coin: • Tầng 100 hoàn thành • Tối đa 999` });
  return embed;
}
function button(sessionId, turn, action, label, emoji, style, disabled = false) {
  return new ButtonBuilder().setCustomId(`hardcore:${sessionId}:${turn}:${action}`).setLabel(label).setEmoji(icon(emoji)).setStyle(style).setDisabled(disabled);
}
function hardcoreRows(sessionId, state, disabled, classes) {
  if (disabled) return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`replay:hardcore:${state.stake}:${state.classKey}`).setLabel('Chơi lại').setEmoji(icon('repeat')).setStyle(ButtonStyle.Success))];
  const withEquipment = rows => [...rows, new ActionRowBuilder().addComponents(
    button(sessionId, state.turn, 'items', `Trang bị (${normalizeEquipment(state.items).length})`, 'school_satchel', ButtonStyle.Secondary),
    button(sessionId, state.turn, 'rift_info', 'Rift Modifier', 'cyclone', ButtonStyle.Secondary),
    ...(state.encounter?.type === 'combat' ? [button(sessionId, state.turn, 'stats', 'Chỉ số', 'bar_chart', ButtonStyle.Secondary), button(sessionId, state.turn, 'enemy_info', 'Thông tin quái', 'information_source', ButtonStyle.Secondary)] : []),
  )];
  const turn = state.turn; const retreat = button(sessionId, turn, 'retreat', state.cleared ? 'Rút thưởng' : 'Bỏ run', state.cleared ? 'moneybag' : 'waving_white_flag', ButtonStyle.Danger);
  if (state.phase === 'summit') return withEquipment([new ActionRowBuilder().addComponents(retreat)]);
  if (state.phase === 'upgrade') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'upgrade_attack', '+5 Damage', 'crossed_swords', ButtonStyle.Primary), button(sessionId, turn, 'upgrade_hp', '+30 HP', 'heart', ButtonStyle.Success), button(sessionId, turn, 'upgrade_defense', '+6 Defense', 'shield', ButtonStyle.Secondary), button(sessionId, turn, 'upgrade_luck', '+2 Luck', 'four_leaf_clover', ButtonStyle.Secondary), retreat)]);
  const type = state.encounter.type;
  if (type === 'combat') {
    const freeSkill = state.classKey === 'sorceress' && state.classBlessing && state.cleared >= state.classBlessing.startCleared && state.cleared <= state.classBlessing.targetCleared;
    return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'attack', 'Tấn công', 'crossed_swords', ButtonStyle.Primary), button(sessionId, turn, 'defend', 'Phòng thủ', 'shield', ButtonStyle.Secondary), button(sessionId, turn, 'skill', classes[state.classKey].skill, 'sparkles', ButtonStyle.Success, state.energy < 2 && !freeSkill), button(sessionId, turn, 'potion', `Bình máu (${state.potions})`, 'test_tube', ButtonStyle.Secondary, state.potions <= 0), retreat)]);
  }
  if (type === 'chest') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'open', 'Mở hòm', 'unlock', ButtonStyle.Primary), button(sessionId, turn, 'inspect', 'Kiểm tra', 'eye', ButtonStyle.Secondary, state.encounter.inspected), button(sessionId, turn, 'sell', 'Bán hòm', 'dollar', ButtonStyle.Success), button(sessionId, turn, 'leave', 'Tránh Mimic', 'door', ButtonStyle.Secondary, !state.encounter.revealed), retreat)]);
  if (type === 'shrine') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'touch', 'Chạm Shrine', 'moyai', ButtonStyle.Primary), button(sessionId, turn, 'ignore', 'Bỏ qua', 'walking', ButtonStyle.Secondary), retreat)]);
  if (type === 'rngesus') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'fight', 'Chiến đấu', 'crossed_swords', ButtonStyle.Danger), button(sessionId, turn, 'flee', 'Bỏ chạy 75%', 'running', ButtonStyle.Primary), button(sessionId, turn, 'bribe', `Hối lộ (-${formatCoins(payoutLoss(state, 0.6))} xu)`, 'money_with_wings', ButtonStyle.Secondary), button(sessionId, turn, 'pray', 'Cầu nguyện 10%', 'pray', ButtonStyle.Success), button(sessionId, turn, 'escape_token', `Vé (${state.escapeTokens})`, 'mirror', ButtonStyle.Secondary, state.escapeTokens <= 0))]);
  if (type === 'surprise') {
    const skip = button(sessionId, turn, 'event_skip', 'Bỏ qua', 'walking', ButtonStyle.Secondary);
    const kind = state.encounter.kind;
    if (kind === 'altar_of_sacrifice') return withEquipment([new ActionRowBuilder().addComponents(
      button(sessionId, turn, 'altar_hp', `Hiến ${state.encounter.hpCost} HP`, 'heart', ButtonStyle.Danger),
      button(sessionId, turn, 'altar_payout', `Hiến ${formatCoins(state.encounter.payoutCost)} xu`, 'money_with_wings', ButtonStyle.Primary, state.encounter.payoutCost <= 0), skip, retreat)]);
    if (kind === 'cursed_gambler') return withEquipment([new ActionRowBuilder().addComponents(
      button(sessionId, turn, 'gamble_10', `Cược ${formatCoins(state.encounter.cost10)} xu`, 'game_die', ButtonStyle.Primary),
      button(sessionId, turn, 'gamble_25', `Cược ${formatCoins(state.encounter.cost25)} xu`, 'game_die', ButtonStyle.Danger), skip, retreat)]);
    if (kind === 'lost_adventurer') return withEquipment([new ActionRowBuilder().addComponents(
      button(sessionId, turn, 'adventurer_rescue', 'Cứu (-1 bình)', 'test_tube', ButtonStyle.Success, state.potions <= 0),
      button(sessionId, turn, 'adventurer_rob', 'Cướp đồ', 'dagger_knife', ButtonStyle.Danger), skip, retreat)]);
    if (kind === 'blood_fountain') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'blood_drink', 'Uống máu', 'drop_of_blood', ButtonStyle.Danger), skip, retreat)]);
    if (kind === 'horadric_forge') {
      const rewards = new ActionRowBuilder().addComponents(
        button(sessionId, turn, 'salvage_attack', '+3 Damage', 'crossed_swords', ButtonStyle.Primary),
        button(sessionId, turn, 'salvage_defense', '+4 Defense', 'shield', ButtonStyle.Secondary),
        button(sessionId, turn, 'salvage_hp', '+10 HP', 'heart', ButtonStyle.Success),
        button(sessionId, turn, 'salvage_token', '+1 Vé', 'mirror', ButtonStyle.Success, !['legendary', 'cursed'].includes(state.encounter.itemRarity)));
      return withEquipment([rewards, new ActionRowBuilder().addComponents(skip, retreat)]);
    }
    if (kind === 'rift_merchant') return withEquipment([new ActionRowBuilder().addComponents(
      ...state.encounter.offers.map((offer, index) => button(sessionId, turn, `merchant_${index}`, `${offer.name} (-${formatCoins(offer.cost)})`, 'moneybag', ButtonStyle.Primary)), skip, retreat)]);
    if (kind === 'mirror_of_fate') return withEquipment([new ActionRowBuilder().addComponents(
      button(sessionId, turn, 'mirror_attack', 'Chọn sức mạnh', 'crossed_swords', ButtonStyle.Danger),
      button(sessionId, turn, 'mirror_defense', 'Chọn phòng thủ', 'shield', ButtonStyle.Primary),
      button(sessionId, turn, 'mirror_smash', 'Đập gương', 'hammer', ButtonStyle.Secondary), skip, retreat)]);
    if (kind === 'treasure_room') {
      const colorLabel = color => `${{ red: 'Hòm đỏ', blue: 'Hòm xanh', gold: 'Hòm vàng' }[color]}${state.encounter.revealedColor === color ? (state.encounter.mimicColor === color ? ' · MIMIC' : ' · AN TOÀN') : ''}`;
      return withEquipment([new ActionRowBuilder().addComponents(
        ...['red', 'blue', 'gold'].map(color => button(sessionId, turn, `treasure_${color}`, colorLabel(color), 'package', color === 'red' ? ButtonStyle.Danger : color === 'blue' ? ButtonStyle.Primary : ButtonStyle.Success)),
        button(sessionId, turn, 'treasure_inspect', 'Kiểm tra', 'eye', ButtonStyle.Secondary, state.encounter.inspected), retreat)]);
    }
    if (kind === 'rift_contract') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'contract_accept', 'Ký hợp đồng', 'scroll', ButtonStyle.Success), skip, retreat)]);
    if (kind === 'class_shrine') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'class_blessing', 'Nhận cường hóa', 'sparkles', ButtonStyle.Success), skip, retreat)]);
    if (kind === 'strange_doors') return withEquipment([new ActionRowBuilder().addComponents(
      button(sessionId, turn, 'door_light', 'Cửa sáng', 'sunny', ButtonStyle.Secondary),
      button(sessionId, turn, 'door_gold', 'Cửa vàng', 'moneybag', ButtonStyle.Success),
      button(sessionId, turn, 'door_dark', 'Cửa đen', 'new_moon', ButtonStyle.Danger), skip, retreat)]);
    const action = state.encounter.kind === 'blacksmith' ? 'forge' : state.encounter.kind === 'purifier' ? 'purify' : 'event_accept';
    const label = state.encounter.kind === 'blacksmith' ? `Rèn +1 (-${formatCoins(state.encounter.cost)} xu)`
      : state.encounter.kind === 'purifier' ? `Giải nguyền (-${formatCoins(state.encounter.cost)} xu)`
        : state.encounter.kind === 'wandering_healer' ? 'Nhận hồi phục'
          : `Đuổi theo (rủi ro -${formatCoins(payoutLoss(state, 1 - state.encounter.penaltyRate))} xu)`;
    return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, action, label, state.encounter.kind === 'blacksmith' ? 'hammer' : state.encounter.kind === 'purifier' ? 'sparkles' : state.encounter.kind === 'wandering_healer' ? 'heart' : 'moneybag', ButtonStyle.Success), skip, retreat)]);
  }
  let continueLabel = type === 'trap' ? 'Chấp nhận số phận' : 'Đi tiếp';
  if (type === 'trap' && state.encounter.kind === 'tax_collector') continueLabel = `Nộp thuế (-${formatCoins(payoutLoss(state, 0.85))} xu)`;
  if (type === 'trap' && state.encounter.kind === 'wrong_portal') continueLabel = `Đi vào (rủi ro -${formatCoins(payoutLoss(state, 0.9))} xu)`;
  return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'continue', continueLabel, 'arrow_right', ButtonStyle.Primary), retreat)]);
}
module.exports = { hpBar, damageTypeText, battleText, battleColor, rankLabel, encounterText, chaosLabel, equipmentSummary, equipmentEmbed, equipmentRows, modifierEffectText, riftDetailEmbed, statsDetailEmbed, enemyDetailEmbed, hardcoreEmbed, hardcoreRows };

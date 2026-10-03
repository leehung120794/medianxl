const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { formatCoins } = require('../utils/economy');
const { baseMultiplier, potentialPayout: enginePotentialPayout, payoutLoss: enginePayoutLoss, hitChance: legacyHitChance, defenseReduction: legacyDefenseReduction, magicAfterResistance } = require('./hardcoreEngine');
const { STAT_VERSION, totalAttributes, equipmentBonuses, deriveStats, v2DefenseReduction, v2HitChance } = require('./hardcoreStats');
const { SKILL_MANA_COST, basicAttackManaRestore, skillDamagePreview } = require('./hardcoreClassInfo');
const { resultBlock, coins } = require('../utils/rewardText');
const emojiMap = require('../discordEmojiMap');
const { rarityLabel, itemEffects, normalizeEquipment, effectText } = require('./hardcoreEquipment');
const { MODIFIERS, regionForFloor, modifierStacks, effectiveModifierStacks, riftModifierEffects } = require('./hardcoreWorld');

const icon = (name, fallback = '•') => emojiMap[`:${name}:`] || fallback;
function potentialPayout(state) {
  return Math.max(0, Math.min(10_000_000,
    Math.floor(enginePotentialPayout(state) * (1 + Math.max(-0.5, Number(state.paradoxBloodBonus) || 0)))));
}
function payoutLoss(state, factor) { return Math.max(0, potentialPayout(state) - potentialPayout({ ...state, payoutFactor: state.payoutFactor * factor })); }

function hpBar(current, maximum, size = 10) {
  const ratio = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}
function damageTypeText(type) { return { physical: '⚔️ Vật lý', magic: '🔮 Phép', mixed: '🌓 Hỗn hợp' }[type] || '🌓 Hỗn hợp'; }
function skillBattleText(state) {
  const preview = skillDamagePreview(state);
  if (!preview) return null;
  const free = state.classKey === 'sorceress' && state.classBlessing && state.cleared >= state.classBlessing.startCleared && state.cleared <= state.classBlessing.targetCleared;
  const resource = state.statVersion === STAT_VERSION ? 'Mana' : 'Energy';
  const cost = free ? `0 ${resource} nhờ Shrine` : `${preview.cost} ${resource}`;
  const shielded = state.encounter.mechanic === 'rift_shield' && (state.encounter.attackAttempts || 0) % 3 === 0;
  const range = preview.min === preview.max ? formatCoins(preview.min) : `${formatCoins(preview.min)}–${formatCoins(preview.max)}`;
  const damage = shielded ? '**0 damage** · Rift Shield sẽ chặn đòn kế tiếp'
    : `**${range} damage**${preview.hits > 1 ? ` nếu đủ ${preview.hits} phát trúng` : ''}${preview.type === 'physical' ? ' · chưa tính Crit' : ''}`;
  return `✨ **${preview.skill}** (${cost}): ${damage}\n${preview.summary}`;
}

function transition(before, after, formatter = formatCoins) {
  return `${formatter(before)}→**${formatter(after)}**`;
}
function numberPercent(value) { return `${Math.round(value * 1000) / 10}%`; }
function activeClassBlessing(state, classKey = state.classKey) {
  const blessing = state.classBlessing;
  return Boolean(blessing && blessing.classKey === classKey && state.cleared >= blessing.startCleared && state.cleared <= blessing.targetCleared);
}
function combatIncomingPreview(state) {
  const enemy = state.encounter;
  if (!enemy || enemy.type !== 'combat') return null;
  const rift = riftModifierEffects(state, enemy);
  const frenzy = enemy.mechanic === 'frenzy' ? Math.min(5, enemy.frenzyStacks || 0) : 0;
  const multiplier = rift.bloodlustDamageMultiplier + frenzy * 0.08;
  const rawMin = Math.max(1, Math.floor(enemy.damageMin * multiplier));
  const rawMax = Math.max(2, Math.floor(enemy.damageMax * multiplier));
  const taken = 1 + (Number(state.damageTaken) || 0);
  const reverse = state.statVersion === STAT_VERSION && state.activeParadox?.kind === 'reverse';
  const barbarianBonus = activeClassBlessing(state, 'barbarian') && state.hp <= state.maxHp * 0.3 ? 8 : 0;
  const effectiveDefense = (reverse ? Math.floor((state.damageMin + state.damageMax) / 2) : state.defense) + barbarianBonus;
  const physicalReduction = state.statVersion === STAT_VERSION
    ? v2DefenseReduction(effectiveDefense, state.floor)
    : legacyDefenseReduction(effectiveDefense, state.floor);
  const physical = [rawMin, rawMax].map(raw => Math.max(1, Math.floor(Math.max(1, Math.floor(raw * (1 - physicalReduction))) * taken)));
  const effectiveResistance = state.resistance + (activeClassBlessing(state, 'paladin') ? 10 : 0) - rift.cursedResistancePenalty;
  const magic = [rawMin, rawMax].map(raw => Math.max(1, Math.floor(magicAfterResistance(raw, effectiveResistance) * taken)));
  const chance = state.statVersion === STAT_VERSION
    ? v2HitChance(enemy.accuracy, state.evasion)
    : legacyHitChance(enemy.accuracy, state.evasion);
  const hit = Math.round(chance * 1000) / 10;
  const type = enemy.nextAttackType || enemy.damageType || 'physical';
  return { type, range: type === 'magic' ? magic : physical, hit };
}
function checkpointPreview(state) {
  if (state.statVersion !== STAT_VERSION) return statLine(state);
  const current = deriveStats(state);
  const definitions = [
    ['strength', '💪 +5 STR'], ['dexterity', '🎯 +5 DEX'], ['vitality', '❤️ +5 VIT'], ['energy', '🔮 +5 ENE'],
  ];
  return definitions.map(([key, label]) => {
    const projected = deriveStats({ ...state, attributes: { ...(state.attributes || {}), [key]: (state.attributes?.[key] || 0) + 5 } });
    const changes = [];
    if (projected.maxHp !== current.maxHp) changes.push(`HP ${transition(current.maxHp, projected.maxHp)}`);
    if (projected.damageMin !== current.damageMin || projected.damageMax !== current.damageMax) changes.push(`⚔️ ${current.damageMin}–${current.damageMax}→**${projected.damageMin}–${projected.damageMax}**`);
    if (projected.spellMin !== current.spellMin || projected.spellMax !== current.spellMax) changes.push(`✨ ${current.spellMin}–${current.spellMax}→**${projected.spellMin}–${projected.spellMax}**`);
    if (projected.defense !== current.defense) changes.push(`DEF ${transition(current.defense, projected.defense)}`);
    if (projected.accuracy !== current.accuracy) changes.push(`ACC ${transition(current.accuracy, projected.accuracy)}`);
    if (projected.evasion !== current.evasion) changes.push(`EVA ${transition(current.evasion, projected.evasion)}`);
    if (projected.critChance !== current.critChance) changes.push(`Crit ${transition(current.critChance, projected.critChance, numberPercent)}`);
    if (projected.resistance !== current.resistance) changes.push(`RES ${transition(current.resistance, projected.resistance, value => `${value}%`)}`);
    if (projected.maxMana !== current.maxMana) changes.push(`Mana ${transition(current.maxMana, projected.maxMana)}`);
    if (projected.potionRate !== current.potionRate) changes.push(`Bình ${transition(current.potionRate, projected.potionRate, numberPercent)}`);
    return `**${label}:** ${changes.join(' · ')}`;
  }).join('\n');
}
function checkpointCurrentStats(state) {
  if (state.statVersion !== STAT_VERSION) return statLine(state);
  const stats = deriveStats(state);
  return [
    `❤️ HP **${state.hp}/${stats.maxHp}** · ⚔️ **${stats.damageMin}–${stats.damageMax}** · ✨ **${stats.spellMin}–${stats.spellMax}**`,
    `🛡️ DEF **${stats.defense}** · ACC **${stats.accuracy}** · EVA **${stats.evasion}** · Crit **${numberPercent(stats.critChance)}**`,
    `🔮 RES **${stats.resistance}%** · Mana **${state.energy}/${stats.maxMana}** · Bình **${numberPercent(stats.potionRate)}**`,
  ].join('\n');
}
function shrineCatalogText(state) {
  if (state.statVersion !== STAT_VERSION) return [
    'Mỗi loại có tỷ lệ xuất hiện ngang nhau:',
    '💚 **Healing:** hồi đầy HP.',
    '🛡️ **Armor:** +3 Defense.',
    '🩸 **Blood:** mất 15 HP, +4 damage.',
    '✨ **Experience:** payout +25% tiền cược.',
    '☣️ **Corrupted:** +7 damage, −4 Defense.',
    '🤡 **Fake:** nhận 30% Max HP damage, tối thiểu 10.',
  ].join('\n');
  return [
    'Mỗi loại có tỷ lệ xuất hiện ngang nhau (**16,7%**):',
    '💚 **Healing:** hồi đầy HP.',
    '🛡️ **Armor:** +5 STR hoặc +5 VIT.',
    '🩸 **Blood:** +8 STR, −5 VIT.',
    '✨ **Experience:** payout +25% tiền cược.',
    '☣️ **Corrupted:** +12 STR, −8 VIT.',
    '🤡 **Fake:** nhận 30% Max HP damage, tối thiểu 10.',
  ].join('\n');
}
function battleText(state) {
  const enemy = state.encounter;
  const classInfo = { amazon: 'Amazon', assassin: 'Assassin', barbarian: 'Barbarian', druid: 'Druid', necromancer: 'Necromancer', paladin: 'Paladin', sorceress: 'Sorceress' }[state.classKey] || state.className;
  const intent = enemy.nextAttackType || enemy.damageType || 'physical';
  const incoming = combatIncomingPreview(state);
  const incomingRange = incoming.range[0] === incoming.range[1] ? formatCoins(incoming.range[0]) : `${formatCoins(incoming.range[0])}–${formatCoins(incoming.range[1])}`;
  const mechanic = enemy.mechanicDescription ? `\n${icon('warning')} ${enemy.mechanicDescription}` : '';
  return [
    `### ${icon('japanese_goblin', '👹')} ${enemy.name} · ${rankLabel(enemy.rank)}`,
    `${icon('heart')} \`${hpBar(enemy.hp, enemy.maxHp)}\` **${formatCoins(enemy.hp)}/${formatCoins(enemy.maxHp)} HP**`,
    `${icon('crossed_swords')} ${formatCoins(enemy.damageMin)}–${formatCoins(enemy.damageMax)} · ${damageTypeText(enemy.damageType)} · ${icon('shield')} ${formatCoins(enemy.defense)} Defense`,
    `🎯 **Đòn kế tiếp:** ${damageTypeText(intent)}${mechanic}`,
    `📉 **Dự báo nhận:** ${incomingRange} HP · ${incoming.hit}% trúng · **chưa tính Crit và chưa Phòng thủ**`,
    '',
    `### ${classInfo}`,
    `${icon('heart')} \`${hpBar(state.hp, state.maxHp)}\` **${formatCoins(state.hp)}/${formatCoins(state.maxHp)} HP**`,
    `${icon('sparkles')} ${state.statVersion === STAT_VERSION ? 'Mana' : 'Energy'} **${state.energy}/${state.maxEnergy}** · ${icon('test_tube')} **${state.potions}** bình · ${icon('mirror')} **${state.escapeTokens}** vé`,
    `${icon('crossed_swords')} ${formatCoins(state.damageMin)}–${formatCoins(state.damageMax)} · ${icon('shield')} ${formatCoins(state.defense)} Defense · ${icon('crystal_ball')} ${state.resistance}% Resist`,
    skillBattleText(state),
  ].filter(Boolean).join('\n');
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
  if (state.phase === 'upgrade') return state.statVersion === STAT_VERSION
    ? `${icon('gift')} **PHÂN BỔ THUỘC TÍNH · TẦNG ${encounter.milestone}**\nChọn +5 STR, DEX, VIT hoặc ENE. HP đã được hồi đầy và bạn đã nhận 2 bình máu.`
    : `${icon('gift')} **NÂNG CẤP SAU MỐC TẦNG ${encounter.milestone}**\nChọn đúng một nút để nhận nâng cấp trong phần còn lại của run. +HP tăng giới hạn tối đa và hồi 30 HP; Rút thưởng chốt payout.`;
  if (state.phase === 'paradox') return `🌀 **RIFT PARADOX · 5 TẦNG**\n**Máu là tiền:** mất 1% Max HP do địch tăng payout 1%; hồi 1% làm giảm tương ứng.\n**Ngược đời:** đổi vai trò sức tấn công thường và Defense. Kỹ năng phép không đổi.`;
  if (state.phase === 'severance') return `✂️ **RIFT SEVERANCE**\nChọn một Rift Modifier có hại để xóa toàn bộ stack. Unstable Rift không thể bị xóa.`;
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
    const rules = state.statVersion === STAT_VERSION
      ? '**Tấn công:** vật lý; Sorceress/Necromancer hồi 70% Max Mana, class vật lý hồi 40% (làm tròn xuống, tối thiểu 1). **Phòng thủ:** DEF x2 với vật lý, +15 RES với phép, giảm thêm 15%, miễn Crit, hồi 1 Mana. **Kỹ năng:** tốn 2 Mana.'
      : '**Tấn công:** đánh và hồi 1 năng lượng. **Phòng thủ:** Defense x2, chặn thêm 40% sát thương, miễn chí mạng và hồi 1 năng lượng. **Kỹ năng:** tốn 2 năng lượng.';
    return `${icon('crossed_swords')} **${encounter.name}** · ${rankLabel(encounter.rank)}\n${icon('heart')} ${formatCoins(encounter.hp)}/${formatCoins(encounter.maxHp)} HP · ${icon('crossed_swords')} ${formatCoins(encounter.damageMin)}–${formatCoins(encounter.damageMax)} · **${damageType}** · ${icon('shield')} ${formatCoins(encounter.defense)}${mechanic}\n${rules} — ${skillHint}\n**Bình máu:** hồi ${Math.round((state.potionRate || 0.35) * 100)}% HP tối đa; quái vẫn đánh trả nếu còn sống.`;
  }
  if (encounter.type === 'chest') return `${icon('package')} **HÒM BÍ ẨN**\n${encounter.inspected ? 'Đã kiểm tra một lần; kết quả có thể không phát hiện được Mimic.' : 'Kiểm tra một lần để thử phát hiện Mimic; Mở để nhận đồ hoặc có thể phải đánh Mimic; Bán để lấy thêm 15% tiền cược vào payout.'}${encounter.revealed ? `\n${icon('warning')} Mimic đã bị phát hiện: **Tránh Mimic** để đi tiếp an toàn.` : ''}`;
  if (encounter.type === 'shrine') return `${icon('moyai')} **SHRINE KHÔNG RÕ NGUỒN GỐC**\n**Chạm Shrine** để nhận hiệu ứng ngẫu nhiên (có cả hiệu ứng gây hại), hoặc **Bỏ qua** để đi tiếp.`;
  if (encounter.type === 'rngesus') return `${icon('skull')} **RNGesus · HP ∞ · KHÔNG THỂ BỊ ĐÁNH BẠI**\nChiến đấu là chết. Bỏ chạy: 75% sống; nếu thất bại, Vé Thoát Hiểm tự dùng làm bảo hiểm. Hối lộ: mất 40% payout, hiện tương đương **${formatCoins(payoutLoss(state, 0.6))} xu**. Cầu nguyện: 10% nhận trang bị SSR trở lên, nếu trượt sẽ chết. Vé: chủ động tiêu thụ 1 vé để thoát.`;
  if (encounter.type === 'grave_echo') return `🪦 **${encounter.isNemesis ? 'SERVER NEMESIS' : 'GRAVE ECHO'}: ${encounter.name}**\n${encounter.classKey} · chết ở tầng ${encounter.deathFloor} · cấp ${encounter.level} · đã kết liễu ${encounter.kills} người.\nCầu nguyện hồi 15% HP. Cướp mộ lấy một item nhưng có 50% đánh thức bóng ma. Khiêu chiến gọi bản mạnh hơn 25%.`;
  if (encounter.type === 'karma') return `🕯️ **THE TOWER REMEMBERS**\nBạn có nhớ lựa chọn **${encounter.action}** từ sự kiện ${encounter.source} không? Tháp thì nhớ. Kết quả đã được khóa từ lúc quyết định ban đầu.`;
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
    if (encounter.kind === 'rift_duelist') return encounter.stage === 'choose'
      ? '🎭 **RIFT DUELIST**\nChọn đấu một ván lấy thuộc tính hoặc thắng 3/5 ván lấy trang bị. Tay đối thủ đã được khóa; Luck không gợi ý kết quả.'
      : `🎭 **RIFT DUELIST · ${encounter.mode === 'stat' ? 'THUỘC TÍNH' : 'TRANG BỊ'}**\nĐã chơi ${encounter.round}/${encounter.mode === 'stat' ? 1 : 5} · thắng ${encounter.wins}. Chọn Búa, Bao hoặc Kéo.`;
    if (encounter.kind.endsWith('_item_shop')) {
      const currency = { payout: 'payout của run', hp: 'HP hiện tại (giá khóa theo Max HP lúc gặp)', diamond: 'kim cương tài khoản' }[encounter.currency];
      return `🛒 **${encounter.currency === 'hp' ? 'BLOOD SHOP' : encounter.currency === 'diamond' ? 'DIAMOND SHOP' : 'RIFT SHOP'}**\nMua đúng một món bằng ${currency}:\n${encounter.offers.map((offer, index) => `**${index + 1}. ${offer.item.name} [${rarityLabel(offer.rarity)}]:** ${formatCoins(offer.cost)}`).join('\n')}`;
    }
    if (encounter.kind === 'blacksmith') return `🔨 **THỢ RÈN LANG THANG**\nTrả **${formatCoins(encounter.cost)} xu payout** để tăng **${encounter.itemName} Lv.${encounter.itemLevel} → Lv.${encounter.itemLevel + 1}**. Bot áp lại toàn bộ chỉ số có lợi của item thêm một lần. Nếu đây là UR chưa giải nguyền, lời nguyền cũng cộng thêm một lần.`;
    if (encounter.kind === 'purifier') return `✨ **TU SĨ GIẢI NGUYỀN**\nTrả **${formatCoins(encounter.cost)} xu payout** để giải toàn bộ lời nguyền đang cộng dồn trên **${encounter.itemName} Lv.${encounter.itemLevel}**. Bot hoàn lại phần chỉ số thực tế đã bị phạt, giữ nguyên mọi buff và đổi item thành SSR; các lần rèn sau chỉ cộng buff.`;
    if (encounter.kind === 'wandering_healer') return `🧙 **NGƯỜI CHỮA TRỊ LANG THANG**\nNhận miễn phí tối đa **${formatCoins(encounter.heal)} HP** và 1 bình máu, hoặc bỏ qua.`;
    if (encounter.kind === 'treasure_goblin') {
      const chance = Math.round((encounter.successChance ?? 0.6) * 1000) / 10;
      return `🪙 **TREASURE GOBLIN**\nĐuổi theo để có **${chance}%** cơ hội cộng **${formatCoins(encounter.reward)} xu** vào payout. Nếu hụt, nó cuỗm **${formatCoins(payoutLoss(state, 1 - encounter.penaltyRate))} xu** theo payout hiện tại. Luck tăng 1% cơ hội mỗi điểm, tối đa 80%.`;
    }
    if (encounter.kind === 'altar_of_sacrifice') return state.statVersion === STAT_VERSION
      ? `🩸 **ALTAR OF SACRIFICE**\nHiến tối đa **${encounter.hpCost} HP** để nhận +6 thuộc tính damage chính, hoặc hiến **${formatCoins(encounter.payoutCost)} payout** để nhận +6 VIT. Event không thể trực tiếp giảm HP xuống dưới 1.`
      : `🩸 **ALTAR OF SACRIFICE**\nHiến tối đa **${encounter.hpCost} HP** để nhận +3 sát thương, hoặc hiến **${formatCoins(encounter.payoutCost)} xu payout** để nhận +3 Defense. Event không thể trực tiếp giảm HP xuống dưới 1.`;
    if (encounter.kind === 'cursed_gambler') return `🎲 **CURSED GAMBLER**\nChọn cược 10% hoặc 25% payout. Tỷ lệ thắng **50%**; thắng nhận lại gấp đôi tiền đã đặt, thua mất toàn bộ khoản cược.`;
    if (encounter.kind === 'lost_adventurer') return `🧭 **LOST ADVENTURER**\nDùng 1 bình máu để cứu và nhận trang bị R/SR, hoặc cướp đồ ngay để nhận R nhưng có **25%** khả năng dính UR bị nguyền.`;
    if (encounter.kind === 'blood_fountain') return '🩸 **BLOOD FOUNTAIN**\nUống máu: 60% hồi đầy HP · 25% nhận +15 HP tối đa · 15% đánh thức Blood Mimic.';
    if (encounter.kind === 'horadric_forge') {
      const after = encounter.itemLevel > 1 ? `item còn **Lv.${encounter.itemLevel - 1}**` : 'item **biến mất khỏi danh sách trang bị**';
      const token = ['legendary', 'cursed'].includes(encounter.itemRarity) ? ' hoặc **+1 Vé Thoát Hiểm**' : '';
      const curseWarning = encounter.itemRarity === 'cursed' ? ' ⚠️ Nếu UR chưa giải nguyền, **curse của cấp bị nghiền cũng tồn tại đến hết run và không còn giải được nếu item biến mất**.' : '';
      const choices = state.statVersion === STAT_VERSION ? '**+6 thuộc tính damage chính**, **+7 STR/VIT**, **+4 VIT**' : '**+3 Damage**, **+4 Defense**, **+10 Max HP và HP hiện tại**';
      return `⚒️ **HORADRIC FORGE**\nNghiền 1 cấp **${encounter.itemName} Lv.${encounter.itemLevel}**; sau đó ${after}. **Buff mà cấp bị nghiền đã cộng vào nhân vật vẫn được giữ đến hết run** và được tính ở mục “đã hấp thụ”. Bạn còn nhận thêm đúng một bonus: ${choices}${token}.${curseWarning}`;
    }
    if (encounter.kind === 'rift_merchant') return `🛒 **RIFT MERCHANT**\nChọn mua đúng một món bằng payout:\n${encounter.offers.map((offer, index) => `**${index + 1}. ${offer.name}:** ${formatCoins(offer.cost)} xu`).join('\n')}`;
    if (encounter.kind === 'mirror_of_fate') return state.statVersion === STAT_VERSION
      ? '🪞 **MIRROR OF FATE**\nSức mạnh: +10 thuộc tính damage chính. Phòng thủ: +8 VIT và +5 thuộc tính phòng thủ phụ. Đập gương: 20% nhận +2 Luck, còn lại phải đấu Mirror Clone.'
      : '🪞 **MIRROR OF FATE**\nSức mạnh: tăng 10% damage nhưng mất 10% HP tối đa. Phòng thủ: +8 Defense, −2 damage. Đập gương: 20% nhận +2 Luck, còn lại phải đấu Mirror Clone.';
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
  const percent = Math.round(chance * 1000) / 10;
  if (!chance) return `${icon('large_green_circle')} Chaos: Yên · 0%`;
  if (chance < 0.01) return `${icon('large_green_circle')} Chaos: Thấp · ${percent}%`;
  if (chance < 0.03) return `${icon('large_yellow_circle')} Chaos: Bất ổn · ${percent}%`;
  return `${icon('red_circle')} Chaos: NGUY HIỂM · ${percent}%${state.lastChaosSpike ? ' · SPIKE' : ''}`;
}
function chaosExplanation(state) {
  if (state.floor < 5 && !(state.lastChaosChance > 0)) return `${chaosLabel(state)}\nChaos là cảnh báo xác suất gặp RNGesus, không phải debuff. RNGesus chỉ bắt đầu xuất hiện từ tầng 5.`;
  const dry = Math.max(0, Number(state.rngesusDry) || 0);
  const base = state.floor < 10 ? 0.3 : state.floor < 20 ? 0.6 : 1;
  return `${chaosLabel(state)}\n**Bất ổn/Nguy hiểm chỉ là mức cảnh báo, không trừ chỉ số.** Lần roll gần nhất dùng xác suất trên; base tầng này ${base}%, chuỗi chưa gặp ${dry} lượt. Mỗi lượt trượt cộng 0,05 điểm %, còn Chaos Spike có thể cộng 4–10 điểm %; xác suất cuối cap 12%.`;
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
  const attrs = state.statVersion === STAT_VERSION ? totalAttributes(state) : null;
  return [
    attrs ? `💪 STR ${attrs.strength} · 🎯 DEX ${attrs.dexterity} · ❤️ VIT ${attrs.vitality} · 🔮 ENE ${attrs.energy}` : null,
    `${icon('heart')} ${formatCoins(state.hp)}/${formatCoins(state.maxHp)}${hpDelta}`,
    `${icon('crossed_swords')} ${formatCoins(state.damageMin)}–${formatCoins(state.damageMax)}${damageDelta}`,
    `${icon('shield')} ${formatCoins(state.defense)}${change(state, 'defense')}`,
    `${icon('sparkles')} ${state.energy}/${state.maxEnergy}${change(state, 'energy')}`,
    `${icon('dart')} ${Math.round(state.critChance * 100)}%${change(state, 'critChance', true)}`,
    `${icon('dash')} ${state.evasion}${change(state, 'evasion')}`,
    `${icon('crystal_ball')} ${state.resistance}%${change(state, 'resistance')}`,
    `${icon('four_leaf_clover')} ${state.luck}${change(state, 'luck')}`,
  ].filter(Boolean).join(' · ');
}
function equipmentLines(state, itemCatalog) {
  const owned = normalizeEquipment(state.items);
  const definitions = new Map(Object.values(itemCatalog).flat().map(item => [item.name, item]));
  return owned.map(item => {
    const definition = definitions.get(item.name);
    const source = definition ? { ...definition, ...item, effects: item.effects || definition.effects,
      curse: item.purified ? null : (item.curse || definition.curse) } : item;
    const label = `${item.typeCode || rarityLabel(item.rarity)}${item.purified ? ' · Đã giải nguyền' : ''}`;
    const attributes = item.attributes && state.statVersion === STAT_VERSION
      ? Object.entries(item.attributes).filter(([, value]) => value).map(([key, value]) => `${{ strength: 'STR', dexterity: 'DEX', vitality: 'VIT', energy: 'ENE' }[key] || key} ${value > 0 ? '+' : ''}${value * item.level}`).join(' · ')
      : '';
    const curse = state.statVersion === STAT_VERSION && !item.purified && source.curseText ? ` · **Nguyền:** ${source.curseText} mỗi cấp` : '';
    return `• **${item.name} Lv.${item.level}** [${label}] — ${attributes || effectText(source, item.level)}${curse}`;
  });
}
function equipmentSummary(state) {
  const owned = normalizeEquipment(state.items);
  const absorbed = state.absorbedItemStats || {};
  if (!owned.length && !absorbed.levels) return 'Chưa có trang bị.';
  if (state.statVersion === STAT_VERSION) {
    const totals = equipmentBonuses(owned);
    const stats = [['strength', 'STR'], ['dexterity', 'DEX'], ['vitality', 'VIT'], ['energy', 'ENE']]
      .map(([key, label]) => totals[key] ? `${label} ${totals[key] > 0 ? '+' : ''}${Math.floor(totals[key])}` : null).filter(Boolean);
    const specials = [totals.bossDamage ? `Boss +${Math.round(totals.bossDamage * 100)}%` : null,
      totals.eliteDamage ? `Elite +${Math.round(totals.eliteDamage * 100)}%` : null,
      totals.potionPower ? `Potion ${totals.potionPower > 0 ? '+' : ''}${Math.round(totals.potionPower * 100)}%` : null,
      totals.luck ? `Luck ${totals.luck > 0 ? '+' : ''}${totals.luck}` : null,
      totals.flatMana ? `Max Mana ${totals.flatMana > 0 ? '+' : ''}${totals.flatMana}` : null].filter(Boolean);
    const levels = owned.reduce((sum, item) => sum + item.level, 0);
    const cursed = owned.filter(item => item.rarity === 'cursed' && !item.purified).length;
    return `${owned.length} món · ${levels} tổng cấp${cursed ? ` · ${cursed} UR đang nguyền` : ''}\n${stats.join(' · ') || 'Không có cộng thuộc tính trực tiếp.'}${specials.length ? `\n${specials.join(' · ')}` : ''}`;
  }
  const levels = owned.reduce((sum, item) => sum + item.level, 0);
  const cursed = owned.filter(item => item.rarity === 'cursed' && !item.purified).length;
  const totals = { ...(absorbed.effects || {}) };
  let payoutFactor = Number.isFinite(absorbed.payoutFactor) ? absorbed.payoutFactor : 1;
  let defenseSet = Boolean(absorbed.defenseSet);
  for (const item of owned) {
    const level = Math.max(1, item.level || 1);
    const sets = [itemEffects(item)];
    if (!item.purified && item.curse?.effects) sets.push(item.curse.effects);
    for (const effects of sets) for (const [key, raw] of Object.entries(effects || {})) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (key === 'bonusPenalty') payoutFactor *= (1 - value) ** level;
      else if (key === 'defenseSet') defenseSet = true;
      else totals[key] = (totals[key] || 0) + value * level;
    }
  }
  const number = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatCoins(Math.abs(value))}`;
  const percent = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.round(Math.abs(value) * 100)}%`;
  const main = [
    totals.maxHp ? `❤️ HP ${number(totals.maxHp)}` : null,
    totals.attack ? `⚔️ ATK ${number(totals.attack)}` : null,
    totals.defense ? `🛡️ DEF ${number(totals.defense)}` : null,
    totals.resistance ? `🔮 RES ${number(totals.resistance)}` : null,
    totals.accuracy ? `🎯 ACC ${number(totals.accuracy)}` : null,
    totals.evasion ? `💨 EVA ${number(totals.evasion)}` : null,
    totals.critChance ? `💢 CRIT ${percent(totals.critChance)}` : null,
    totals.luck ? `🍀 Luck ${number(totals.luck)}` : null,
    totals.maxEnergy ? `✨ Energy ${number(totals.maxEnergy)}` : null,
  ].filter(Boolean);
  const special = [
    totals.potionPower ? `Bình ${percent(totals.potionPower)}` : null,
    totals.bossDamage ? `Boss DMG ${percent(totals.bossDamage)}` : null,
    totals.eliteDamage ? `Elite DMG ${percent(totals.eliteDamage)}` : null,
    totals.mimicDetection ? `Dò Mimic ${percent(totals.mimicDetection)}` : null,
    totals.goblinChance ? `Bắt Goblin ${percent(totals.goblinChance)}` : null,
    totals.legendaryFind ? `SSR ${percent(totals.legendaryFind)}` : null,
    totals.floorHpLoss ? `HP/tầng −${Math.round(Math.abs(totals.floorHpLoss) * 100)}%` : null,
    totals.mimicChance ? `Mimic ${percent(totals.mimicChance)}` : null,
    totals.damageTaken ? `Damage nhận ${percent(totals.damageTaken)}` : null,
    payoutFactor < 1 ? `Payout −${Math.round((1 - payoutFactor) * 100)}%` : null,
    defenseSet ? 'Có lời nguyền đặt DEF khi nhặt' : null,
  ].filter(Boolean);
  const granted = [totals.potions ? `🧪 ${number(totals.potions)} bình` : null, totals.escapeTokens ? `🎫 ${number(totals.escapeTokens)} vé` : null,
    totals.heal ? `❤️ đã hồi ${number(totals.heal)} HP khi nhặt` : null].filter(Boolean);
  return [
    `**${owned.length} món · ${levels} tổng cấp**${absorbed.levels ? ` · ${absorbed.levels} cấp đã nghiền` : ''}${cursed ? ` · ${cursed} đang bị nguyền` : ''}${absorbed.cursedLevels ? ` · ⚠️ ${absorbed.cursedLevels} curse đã hấp thụ` : ''}`,
    main.length ? `**Tổng chỉ số item:** ${main.join(' · ')}` : null,
    special.length ? `**Hiệu ứng đặc biệt:** ${special.join(' · ')}` : null,
    granted.length ? `**Đã cấp khi nhặt:** ${granted.join(' · ')}` : null,
    'Bấm **Trang bị** để xem từng món.',
  ].filter(Boolean).join('\n').slice(0, 1024);
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
    return `• **${definition.name}${stacks > 1 ? ` x${stacks}` : ''}** — ${modifierEffectText(key, stacks, state)}`;
  }).join('\n').slice(0, 1024);
}
function modifierEffectText(key, stacks, state = null) {
  const v2 = state?.statVersion === STAT_VERSION;
  const power = v2 ? effectiveModifierStacks(stacks) : stacks;
  const rounded = value => Math.round(value * 10) / 10;
  if (key === 'stone_skin') return `Defense quái **+${rounded(power * (v2 ? 8 : 10))}%** khi encounter được tạo.`;
  if (key === 'elemental_dominion') return `Damage quái **+${rounded(power * (v2 ? 3 : 4))}%** · cơ hội dùng phép tăng cùng mức.`;
  if (key === 'bloodlust') return `Quái còn không quá 50% HP gây thêm **${rounded(power * (v2 ? 6 : 8))}% damage**.`;
  if (key === 'unstable_rift') {
    const chestShift = Math.min(16, stacks * 2);
    const mimic = Math.min(30, 15 + stacks * 3);
    const ancient = Math.min(8, 3 + stacks);
    const legendary = Math.min(70, 35 + stacks * 5);
    return `Chuyển **${chestShift}%** encounter quái thường sang hòm · tổng Mimic **${mimic}%** (Ancient **${ancient}%**) · SSR trong hòm kho báu **${legendary}%**.`;
  }
  if (key === 'fortified') return `HP tối đa của quái mới **+${rounded(power * (v2 ? 8 : 10))}%**.`;
  if (key === 'swift_horror') return state?.statVersion === STAT_VERSION
    ? `Quái mới nhận **+${Math.round(power * 3)} Accuracy** và **+${Math.round(power * 1.5)} Evasion**.`
    : `Quái mới nhận **+${stacks * 3} Accuracy** và **+${stacks} Evasion**.`;
  if (key === 'soul_drain') return state?.statVersion === STAT_VERSION
    ? `Mỗi combat có **${Math.min(3, Math.ceil(stacks / 4))} charge Soul Drain**; mỗi đòn trúng tiêu 1 charge và rút 1 Mana.`
    : `Mỗi đòn quái đánh trúng rút **${stacks >= 5 ? 2 : 1} Energy**.`;
  if (key === 'cursed_ground') return `Resistance hiệu dụng của bạn giảm **${v2 ? Math.round(power * 3) : stacks * 4}** khi nhận damage phép.`;
  return 'Không xác định được hiệu ứng.';
}
function riftDetailEmbed(state) {
  const active = [...new Set(Array.isArray(state.modifiers) ? state.modifiers : [])];
  const embed = new EmbedBuilder().setColor(0x71368A).setTitle('🌀 RIFT MODIFIER')
    .setDescription(`Modifier mới xuất hiện sau mỗi 10 tầng. Có đủ 8 loại rồi mới bắt đầu lặp và cộng dồn.\n\n**Tổng cộng dồn hiện tại:** ${state.modifiers?.length || 0}`);
  if (!active.length) return embed.addFields({ name: 'Chưa có hiệu ứng', value: 'Modifier đầu tiên được nhận sau khi vượt tầng 10.' });
  return embed.addFields(active.map(key => {
    const stacks = modifierStacks(state, key);
    return { name: `${MODIFIERS[key]?.name || key}${stacks > 1 ? ` ×${stacks}` : ''}`, value: modifierEffectText(key, stacks, state), inline: false };
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
      ...(state.phase === 'upgrade' ? [
        { name: `${icon('bar_chart')} Chỉ số hiện tại`, value: checkpointCurrentStats(state), inline: false },
        { name: `${icon('gift')} Tăng điểm · chỉ hiển thị thay đổi`, value: checkpointPreview(state), inline: false },
      ] : []),
      ...(state.encounter?.type === 'shrine' ? [{ name: `${icon('moyai')} Các Shrine có thể gặp`, value: shrineCatalogText(state), inline: false }] : []),
      { name: `${icon('compass')} Tiến trình & Chaos`, value: `Đã vượt ${state.cleared} · Boss ${state.bosses} · ${icon('test_tube')} ${state.potions}${change(state, 'potions')} · ${icon('mirror')} ${state.escapeTokens}${change(state, 'escapeTokens')}${temporaryEffectText(state)}\n${chaosExplanation(state)}`, inline: false },
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
    button(sessionId, state.turn, 'stats', 'Chỉ số', 'bar_chart', ButtonStyle.Secondary),
    ...(state.encounter?.type === 'combat' ? [button(sessionId, state.turn, 'enemy_info', 'Thông tin quái', 'information_source', ButtonStyle.Secondary)] : []),
  )];
  const turn = state.turn; const retreat = button(sessionId, turn, 'retreat', state.cleared ? 'Rút thưởng' : 'Bỏ run', state.cleared ? 'moneybag' : 'waving_white_flag', ButtonStyle.Danger);
  if (state.phase === 'summit') return withEquipment([new ActionRowBuilder().addComponents(retreat)]);
  if (state.phase === 'upgrade') return withEquipment([new ActionRowBuilder().addComponents(
    button(sessionId, turn, 'upgrade_attack', state.statVersion === STAT_VERSION ? '+5 STR' : '+5 Damage', 'crossed_swords', ButtonStyle.Primary),
    button(sessionId, turn, 'upgrade_hp', state.statVersion === STAT_VERSION ? '+5 VIT' : '+30 HP', 'heart', ButtonStyle.Success),
    button(sessionId, turn, 'upgrade_defense', state.statVersion === STAT_VERSION ? '+5 DEX' : '+6 Defense', 'shield', ButtonStyle.Secondary),
    button(sessionId, turn, 'upgrade_luck', state.statVersion === STAT_VERSION ? '+5 ENE' : '+2 Luck', 'sparkles', ButtonStyle.Secondary), retreat)]);
  if (state.phase === 'paradox') return withEquipment([new ActionRowBuilder().addComponents(
    button(sessionId, turn, 'paradox_blood', 'Máu là tiền', 'drop_of_blood', ButtonStyle.Danger),
    button(sessionId, turn, 'paradox_reverse', 'Ngược đời', 'arrows_counterclockwise', ButtonStyle.Primary), retreat)]);
  if (state.phase === 'severance') return withEquipment([new ActionRowBuilder().addComponents(
    ...state.encounter.choices.slice(0, 4).map((key, index) => button(sessionId, turn, `sever_${index}`, MODIFIERS[key]?.name || key, 'scissors', ButtonStyle.Secondary)), retreat)]);
  const type = state.encounter.type;
  if (type === 'combat') {
    const freeSkill = state.classKey === 'sorceress' && state.classBlessing && state.cleared >= state.classBlessing.startCleared && state.cleared <= state.classBlessing.targetCleared;
    const attackMana = basicAttackManaRestore(state);
    const resource = state.statVersion === STAT_VERSION ? 'Mana' : 'Energy';
    return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'attack', `Tấn công (+${attackMana} ${resource})`, 'crossed_swords', ButtonStyle.Primary), button(sessionId, turn, 'defend', `Phòng thủ (+1 ${resource})`, 'shield', ButtonStyle.Secondary), button(sessionId, turn, 'skill', `${classes[state.classKey].skill} (-${freeSkill ? 0 : SKILL_MANA_COST})`, 'sparkles', ButtonStyle.Success, state.energy < SKILL_MANA_COST && !freeSkill), button(sessionId, turn, 'potion', `Bình máu (${state.potions})`, 'test_tube', ButtonStyle.Secondary, state.potions <= 0), retreat)]);
  }
  if (type === 'chest') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'open', 'Mở hòm', 'unlock', ButtonStyle.Primary), button(sessionId, turn, 'inspect', 'Kiểm tra', 'eye', ButtonStyle.Secondary, state.encounter.inspected), button(sessionId, turn, 'sell', 'Bán hòm', 'dollar', ButtonStyle.Success), button(sessionId, turn, 'leave', 'Tránh Mimic', 'door', ButtonStyle.Secondary, !state.encounter.revealed), retreat)]);
  if (type === 'shrine') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'touch', 'Chạm Shrine', 'moyai', ButtonStyle.Primary), button(sessionId, turn, 'ignore', 'Bỏ qua', 'walking', ButtonStyle.Secondary), retreat)]);
  if (type === 'rngesus') return withEquipment([new ActionRowBuilder().addComponents(button(sessionId, turn, 'fight', 'Chiến đấu', 'crossed_swords', ButtonStyle.Danger), button(sessionId, turn, 'flee', 'Bỏ chạy 75%', 'running', ButtonStyle.Primary), button(sessionId, turn, 'bribe', `Hối lộ (-${formatCoins(payoutLoss(state, 0.6))} xu)`, 'money_with_wings', ButtonStyle.Secondary), button(sessionId, turn, 'pray', 'Cầu nguyện 10%', 'pray', ButtonStyle.Success), button(sessionId, turn, 'escape_token', `Vé (${state.escapeTokens})`, 'mirror', ButtonStyle.Secondary, state.escapeTokens <= 0))]);
  if (type === 'grave_echo') return withEquipment([new ActionRowBuilder().addComponents(
    button(sessionId, turn, 'grave_pray', 'Cầu nguyện', 'pray', ButtonStyle.Success),
    button(sessionId, turn, 'grave_rob', 'Cướp mộ', 'dagger_knife', ButtonStyle.Danger),
    button(sessionId, turn, 'grave_challenge', 'Khiêu chiến', 'crossed_swords', ButtonStyle.Primary),
    button(sessionId, turn, 'grave_leave', 'Bỏ đi', 'walking', ButtonStyle.Secondary), retreat)]);
  if (type === 'karma') return withEquipment([new ActionRowBuilder().addComponents(
    button(sessionId, turn, 'karma_resolve', 'Đối mặt quá khứ', 'hourglass_flowing_sand', ButtonStyle.Danger), retreat)]);
  if (type === 'surprise') {
    const skip = button(sessionId, turn, 'event_skip', 'Bỏ qua', 'walking', ButtonStyle.Secondary);
    const kind = state.encounter.kind;
    if (kind === 'rift_duelist') {
      if (state.encounter.stage === 'choose') return withEquipment([new ActionRowBuilder().addComponents(
        button(sessionId, turn, 'duelist_stat', '1 ván · lấy stat', 'bar_chart', ButtonStyle.Primary),
        button(sessionId, turn, 'duelist_gear', 'Thắng 3/5 · lấy đồ', 'school_satchel', ButtonStyle.Danger), skip, retreat)]);
      return withEquipment([new ActionRowBuilder().addComponents(
        button(sessionId, turn, 'rps_rock', 'Búa', 'fist', ButtonStyle.Secondary),
        button(sessionId, turn, 'rps_paper', 'Bao', 'raised_hand', ButtonStyle.Primary),
        button(sessionId, turn, 'rps_scissors', 'Kéo', 'v', ButtonStyle.Danger), retreat)]);
    }
    if (kind.endsWith('_item_shop')) return withEquipment([new ActionRowBuilder().addComponents(
      ...state.encounter.offers.map((offer, index) => button(sessionId, turn, `shop_buy_${index}`, `${offer.item.name} (${formatCoins(offer.cost)})`, 'shopping_cart', ButtonStyle.Primary)), skip, retreat)]);
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
        button(sessionId, turn, 'salvage_attack', state.statVersion === STAT_VERSION ? 'Nghiền → +6 stat damage' : 'Nghiền → +3 Damage', 'crossed_swords', ButtonStyle.Primary),
        button(sessionId, turn, 'salvage_defense', state.statVersion === STAT_VERSION ? `Nghiền → +7 ${(state.encounter.attributeRoll || 'vitality').toUpperCase()}` : 'Nghiền → +4 Defense', 'shield', ButtonStyle.Secondary),
        button(sessionId, turn, 'salvage_hp', state.statVersion === STAT_VERSION ? 'Nghiền → +4 VIT' : 'Nghiền → +10 HP', 'heart', ButtonStyle.Success),
        button(sessionId, turn, 'salvage_token', 'Nghiền → +1 Vé', 'mirror', ButtonStyle.Success, !['legendary', 'cursed'].includes(state.encounter.itemRarity)));
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
module.exports = { hpBar, damageTypeText, battleText, combatIncomingPreview, checkpointCurrentStats, shrineCatalogText, battleColor, rankLabel, encounterText, chaosLabel, chaosExplanation, equipmentSummary, equipmentEmbed, equipmentRows, modifierEffectText, riftDetailEmbed, statsDetailEmbed, enemyDetailEmbed, hardcoreEmbed, hardcoreRows };

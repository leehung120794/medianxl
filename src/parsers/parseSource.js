const crypto = require('node:crypto');
const { cleanText, splitLines, parseRequirements, parseSockets, parseLimit, normalizeSearch, sourceMeta } = require('../utils/text');

function hash(value) { return crypto.createHash('sha1').update(value).digest('hex'); }

function makeItem({ sourceSlug, sourceUrl, name, baseType = null, groupName = null, tierOrVariant = null, lines, imageUrl = null, applyText = null }) {
  const meta = sourceMeta(sourceSlug);
  const stats = lines.filter(line => !/^Tier\s+\d+$/i.test(line) && !/^(Mystic Orb|Right-Click to Apply|Relic)$/i.test(line));
  const rawText = lines.join('\n');
  return {
    source_slug: sourceSlug, source_type: meta.source_type, type_code: meta.type_code,
    name: cleanText(name), base_type: baseType, group_name: groupName, tier_or_variant: tierOrVariant,
    requirements: parseRequirements(lines), stats, socket_count: parseSockets(lines), limit_per_item: parseLimit(lines),
    apply_text: applyText, image_url: imageUrl ? new URL(imageUrl, sourceUrl).href : null, source_url: sourceUrl, raw_text: rawText,
    search_text: normalizeSearch([name, baseType, groupName, tierOrVariant, ...lines].filter(Boolean).join(' ')),
    content_hash: hash(`${sourceSlug}|${name}|${baseType}|${groupName}|${tierOrVariant}|${rawText}`),
    updated_at: new Date().toISOString(),
  };
}

function elementsFromTable($, sourceSlug, sourceUrl) {
  const items = [];
  let groupName = null;
  $('h1,h2,h3,h4,p.genbig,table').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag !== 'table') {
      const heading = cleanText($(el).text());
      if (heading && !/^(tiered uniques|sacred uniques|runewords|sets|unique mystic orbs|list of runewords)$/i.test(heading)) groupName = heading;
      return;
    }
    const sacredGroupBases = { Amulets: 'Amulet', Rings: 'Ring', Jewels: 'Jewel', 'Arrow Quivers': 'Arrow Quiver', 'Crossbow Quivers': 'Crossbow Quiver' };
    const tableBaseType = sourceSlug === 'sacreduniques'
      ? cleanText($(el).find('tr').first().children('th').first().text()) || sacredGroupBases[groupName] || null
      : null;
    $(el).find('tr').each((_, tr) => {
      $(tr).find('td,th').each((__, cell) => {
        const html = $(cell).html() || '';
        const lines = splitLines(html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
        if (lines.length < 3) return;
        const name = lines[0];
        if (!name || name.length > 100 || /^(item|ring|amulet|quiver|armor|weapon|weapons|bows|crossbows)/i.test(name)) return;
        if (/^(required level|item level|socketed|one-hand damage|two-hand damage|adds|defense|tier\s+\d+)/i.test(name)) return;
        const raw = lines.join('\n');
        const imageUrl = $(cell).find('img').first().attr('src') || $(tr).find('img').first().attr('src') || null;
        const baseType = sourceSlug === 'umos' ? 'Mystic Orb' : tableBaseType || (lines[1] && !/^(tier\s+\d+|required|item level|(?:throw|one-hand|two-hand) damage|defense|chance to block|adds)/i.test(lines[1]) ? lines[1] : null);
        const variant = sourceSlug === 'sacreduniques' ? (raw.match(/\b(SSSU|SSU|SU)\b/)?.[1] || null) : (raw.match(/\b(Tier\s+[1-9])\b/i)?.[1] || null);
        items.push(makeItem({ sourceSlug, sourceUrl, name, baseType, groupName, tierOrVariant: variant, lines, imageUrl, applyText: sourceSlug === 'umos' ? 'Right-Click to Apply' : null }));
      });
    });
  });
  return items;
}

function parseUmos($, sourceUrl) {
  const items = [];
  let groupName = null;
  $('h1,h2,h3,h4,table').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag !== 'table') {
      const heading = cleanText($(el).text());
      if (heading && !/unique mystic orbs/i.test(heading)) groupName = heading;
      return;
    }
    $(el).find('tr').each((_, tr) => {
      $(tr).find('th,td').each((__, cell) => {
        const html = $(cell).html() || '';
        const lines = splitLines(html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
        if (lines.length < 3 || /^(Ring|Item|Armor|Weapon)/i.test(lines[0])) return;
        const name = lines[0];
        const stats = lines.slice(1);
        items.push(makeItem({ sourceSlug: 'umos', sourceUrl, name, baseType: 'Mystic Orb', groupName, lines: [name, ...stats], applyText: 'Right-Click to Apply', imageUrl: $(cell).find('img').first().attr('src') || $(tr).find('img').first().attr('src') || null }));
      });
    });
  });
  return dedupe(items);
}

const RELIC_GENERIC_TARGETS = /^(?:all skills?|amazon skill levels?|assassin skill levels?|barbarian skill levels?|druid skill levels?|necromancer skill levels?|paladin skill levels?|sorceress skill levels?|strength|dexterity|vitality|energy|life|mana|stamina|minimum damage|maximum damage|light radius|spell focus|defense|experience gained|summon(?:ed)? (?:minion )?(?:damage|life|attack rating|elemental resistances?))$/i;

function relicSkillName(lines) {
  const body = lines.filter(line => !/^Relic$/i.test(line) && !/^Required Level/i.test(line));
  const namedEffect = body.find(line => {
    const match = line.match(/^([^:]{2,70}):\s*.+/);
    return match && !/[\d%+()-]/.test(match[1]) && !/^(?:chance to cast|when struck|on attack|on kill|reanimate as)$/i.test(match[1].trim());
  });
  if (namedEffect) return cleanText(namedEffect.split(':')[0]);

  const grantedSkills = body.map(line => {
    const match = line.match(/^\+\s*(?:\([^)]+\)|\d+)\s+to\s+(.+?)(?:\s+\([^)]+ only\))?$/i);
    return match ? cleanText(match[1]) : null;
  }).filter(Boolean).filter(name => !RELIC_GENERIC_TARGETS.test(name));
  return grantedSkills.at(-1) || null;
}

function parseRelics($, sourceUrl) {
  const items = [];
  $('table tr').each((_, tr) => {
    $(tr).find('td').each((__, cell) => {
      const html = $(cell).html() || '';
      const lines = splitLines(html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
      if (lines.length < 3 || !/^Relic$/i.test(lines[0])) return;
      const name = relicSkillName(lines);
      if (!name) return;
      items.push(makeItem({ sourceSlug: 'relics', sourceUrl, name, baseType: 'Relic', groupName: 'Relics', lines, imageUrl: $(cell).find('img').first().attr('src') || $(tr).find('img').first().attr('src') || null }));
    });
  });
  return dedupe(items);
}

function parseTieredUniques($, sourceUrl) {
  const items = [];
  $('table.uniques').each((_, table) => {
    const header = cleanText($(table).find('th.item-unique').first().text());
    if (!header) return;
    const match = header.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    const name = cleanText(match ? match[1] : header);
    const baseType = cleanText(match ? match[2] : '') || null;
    const groupName = cleanText($(table).prevAll('p.genbig').first().text()) || null;
    $(table).find('tr').each((__, tr) => {
      $(tr).children('td').each((___, cell) => {
        if (!$(cell).find('.item-basic, .item-magic').length) return;
        const html = $(cell).html() || '';
        const lines = splitLines(html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
        if (!lines.length || !/^Tier\s+\d+$/i.test(lines[0])) return;
        const tier = lines[0];
        const imageUrl = $(table).find('img').first().attr('src') || null;
        items.push(makeItem({ sourceSlug: 'tiereduniques', sourceUrl, name, baseType, groupName, tierOrVariant: tier, lines, imageUrl }));
      });
    });
  });
  return dedupe(items);
}

function parseRunewords($, sourceUrl) {
  const items = [];
  $('table.runewords_table tr').each((_, tr) => {
    const name = cleanText($(tr).find('td.item-name .item-unique').first().text());
    if (!name) return;
    const runeSequence = cleanText($(tr).find('td.item-name .item-runeword').first().text());
    const level = cleanText($(tr).find('td.item-level').first().text());
    const baseType = cleanText($(tr).children('td').eq(4).text()) || null;
    const runeNames = $(tr).find('.item-eruneword').map((_, el) => cleanText($(el).text())).get();
    const statsHtml = $(tr).children('td').last().html() || '';
    const stats = splitLines(statsHtml.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
    const lines = [runeSequence, `Required Level: ${level}`, `Runes: ${runeNames.join(' · ')}`, ...stats].filter(Boolean);
    items.push(makeItem({ sourceSlug: 'runewords', sourceUrl, name, baseType, groupName: baseType, tierOrVariant: runeSequence, lines, imageUrl: $(tr).find('img').first().attr('src') || null }));
  });
  return dedupe(items);
}

function parseNymyrsLight($, sourceUrl) {
  const dungeon = $('h4').filter((_, el) => /^Nymyr's Light$/i.test(cleanText($(el).text()))).first().closest('.ubersmall');
  if (!dungeon.length) return [];
  const reward = dungeon.find('.charms > div').first();
  if (!reward.length) return [];
  const html = reward.html() || '';
  const lines = splitLines(html.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
  const name = cleanText(reward.find('.item-unique').first().text()) || 'The Sleep';
  const imageUrl = reward.find('img').first().attr('src') || dungeon.find('img').first().attr('src') || null;
  const detail = dungeon.find('p').filter((_, el) => /Reward/i.test($(el).text())).first().text();
  const dungeonInfo = dungeon.find('.uberdetail').text();
  const intro = [detail, dungeonInfo].filter(Boolean).map(cleanText);
  const awakening = [];
  dungeon.find('table.sleeptable td').each((_, cell) => {
    const cellHtml = $(cell).html() || '';
    const cellLines = splitLines(cellHtml.replace(/<br\s*\/?>(?=.)/gi, '\n').replace(/<[^>]+>/g, ' '));
    if (cellLines.length >= 2) {
      const trophy = cellLines[0];
      awakening.push(`Awakening — ${trophy}: ${cellLines.slice(1).join(' | ')}`);
    }
  });
  return [makeItem({ sourceSlug: 'nymyrs_light', sourceUrl, name, baseType: 'Dungeon Charm', groupName: "Nymyr's Light", tierOrVariant: 'Reward', lines: [...intro, ...lines, ...awakening], imageUrl })];
}

function parseHtml(html, sourceSlug, sourceUrl) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  if (sourceSlug === 'umos') return parseUmos($, sourceUrl);
  if (sourceSlug === 'tiereduniques') return parseTieredUniques($, sourceUrl);
  if (sourceSlug === 'runewords') return parseRunewords($, sourceUrl);
  if (sourceSlug === 'relics') return parseRelics($, sourceUrl);
  if (sourceSlug === 'nymyrs_light') return parseNymyrsLight($, sourceUrl);
  const items = elementsFromTable($, sourceSlug, sourceUrl);
  if (items.length) return dedupe(items);
  return parseTextFallback($, sourceSlug, sourceUrl);
}

function parseTextFallback($, sourceSlug, sourceUrl) {
  const lines = splitLines($('body').text());
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || /^(Home|Game|Community|Multiplayer|Download|Donate|Menu)$/i.test(line)) continue;
    if (/^(Tier \d+|Mystic Orb|Right-Click to Apply|Socketed|Required Level|Item Level|Limit per item)/i.test(line)) continue;
    const next = lines.slice(i + 1, i + 12);
    if (next.some(x => /Required Level|Limit per item|Socketed|Right-Click to Apply/i.test(x))) {
      items.push(makeItem({ sourceSlug, sourceUrl, name: line, lines: [line, ...next], baseType: sourceSlug === 'umos' ? 'Mystic Orb' : null }));
    }
  }
  return dedupe(items);
}

function dedupe(items) { return [...new Map(items.map(item => [item.content_hash, item])).values()]; }
module.exports = { parseHtml, relicSkillName };

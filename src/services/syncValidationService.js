const { normalizeSearch, sourceMeta } = require("../utils/text");

const BASELINES = {
  tiereduniques: 100,
  sacreduniques: 100,
  runewords: 50,
  sets: 50,
  umos: 10,
  cycles: 5,
  relics: 50,
  trophies: 5,
  nymyrs_light: 1,
};

const GENERIC_NAMES = new Set([
  "item",
  "relic",
  "ring",
  "amulet",
  "weapon",
  "armor",
  "set",
  "cycle",
  "trophy",
]);

function suspiciousItem(item) {
  const name = normalizeSearch(item?.name);
  if (!name || name.length < 2 || GENERIC_NAMES.has(name))
    return "invalid name";
  if (!item.source_url || !item.content_hash || !item.search_text)
    return "missing required field";
  if (
    item.source_slug === "relics" &&
    /^(?:adds? |\+|-|\(|\d+%|[a-z ]+ resist\b)/i.test(item.name)
  )
    return "relic name looks like a stat";
  if (
    item.source_slug === "sacreduniques" &&
    (!item.base_type ||
      /^(?:.*damage:|defense:|chance to block:)$/i.test(item.base_type.trim()))
  )
    return "invalid sacred unique base item";
  return null;
}

function validateSourceItems(sourceSlug, items, previousCount = 0) {
  const errors = [];
  const warnings = [];
  const expectedType = sourceMeta(sourceSlug).type_code;
  const minimum = BASELINES[sourceSlug] || 1;
  if (!Array.isArray(items) || items.length < minimum)
    errors.push(`count ${items?.length || 0} is below baseline ${minimum}`);
  if (previousCount > 0 && items.length < Math.ceil(previousCount * 0.6))
    errors.push(
      `count dropped from ${previousCount} to ${items.length} (>40%)`,
    );

  const hashes = new Set();
  let suspicious = 0;
  let wrongType = 0;
  for (const item of items || []) {
    if (item.type_code !== expectedType) wrongType += 1;
    if (hashes.has(item.content_hash))
      errors.push(`duplicate content hash: ${item.content_hash}`);
    hashes.add(item.content_hash);
    if (suspiciousItem(item)) suspicious += 1;
  }
  if (wrongType) errors.push(`${wrongType} items have an unexpected type code`);
  const suspiciousLimit = Math.max(1, Math.floor((items?.length || 0) * 0.02));
  if (suspicious > suspiciousLimit)
    errors.push(
      `${suspicious} suspicious items exceed limit ${suspiciousLimit}`,
    );
  else if (suspicious) warnings.push(`${suspicious} suspicious item(s)`);
  if (previousCount > 0 && items.length > previousCount * 1.75)
    warnings.push(`count increased from ${previousCount} to ${items.length}`);

  return {
    ok: errors.length === 0,
    count: items?.length || 0,
    previousCount,
    errors,
    warnings,
  };
}

module.exports = { BASELINES, validateSourceItems, suspiciousItem };

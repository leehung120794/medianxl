const { searchItems: rawSearch, getItemById } = require("../db");
const { normalizeSearch } = require("../utils/text");

const TYPES = new Set([
  "ALL",
  "TU",
  "SU",
  "RW",
  "SET",
  "UMO",
  "CYCLE",
  "RELIC",
  "TROPHY",
  "SLEEP",
]);
function score(item, query) {
  const q = normalizeSearch(query);
  const name = normalizeSearch(item.name);
  const base = normalizeSearch(item.base_type || "");
  const group = normalizeSearch(item.group_name || "");
  const variant = normalizeSearch(item.tier_or_variant || "");
  if (name === q) return 100000;
  if (name.startsWith(q)) return 90000;
  if (name.includes(q)) return 80000;
  if (base === q) return 70000;
  if (base.includes(q)) return 60000;
  if (group.includes(q) || variant.includes(q)) return 50000;
  return 1000;
}
function tierNumber(item) {
  const match = String(item.tier_or_variant || "").match(/tier\s*(\d+)/i);
  return match ? Number(match[1]) : -1;
}
function keepHighestTierUniques(items) {
  const highest = new Map();
  const others = [];
  for (const item of items) {
    if (item.type_code !== "TU") {
      others.push(item);
      continue;
    }
    const key = `${normalizeSearch(item.name)}|${normalizeSearch(item.base_type || "")}`;
    const current = highest.get(key);
    if (!current || tierNumber(item) > tierNumber(current))
      highest.set(key, item);
  }
  return [...others, ...highest.values()];
}
function validType(type) {
  const value = String(type || "ALL").toUpperCase();
  return TYPES.has(value) ? value : "ALL";
}
function rank(items, query) {
  return keepHighestTierUniques(items).sort(
    (a, b) => score(b, query) - score(a, query) || a.name.localeCompare(b.name),
  );
}
function searchItems({ query, type = "ALL", limit = 50 }) {
  const q = normalizeSearch(query);
  if (!q) return [];
  return rank(
    rawSearch({ query: q, type: validType(type), limit: 10000 }),
    q,
  ).slice(0, Math.max(1, Math.min(Number(limit) || 50, 100)));
}
function autocompleteItems({ query = "", type = "ALL", limit = 25 }) {
  const q = normalizeSearch(query);
  const found = rawSearch({ query: q, type: validType(type), limit: 1000 });
  return rank(found, q).slice(
    0,
    Math.max(1, Math.min(Number(limit) || 25, 25)),
  );
}

module.exports = {
  searchItems,
  autocompleteItems,
  getItemById,
  keepHighestTierUniques,
};

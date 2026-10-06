const DIACRITICS = /[\u0300-\u036f]/g;

function normalizeSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9+%'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Game answers must keep Vietnamese accents. Search remains accent-insensitive,
// but accepting an unaccented answer changes the word in Vietnamese word games.
function normalizeVietnamese(value = "") {
  return String(value)
    .normalize("NFC")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLines(value = "") {
  return cleanText(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseNumberAfter(label, text) {
  const match = text.match(new RegExp(`${label}\\s*:?\\s*([0-9]+)`, "i"));
  return match ? Number(match[1]) : null;
}

function parseRequirements(lines) {
  const text = lines.join("\n");
  return {
    requiredLevel: parseNumberAfter("Required Level", text),
    requiredStrength: parseNumberAfter("Required Strength", text),
    requiredDexterity: parseNumberAfter("Required Dexterity", text),
    itemLevel: parseNumberAfter("Item Level", text),
  };
}

function parseSockets(lines) {
  const match = lines
    .find((value) => /socketed/i.test(value))
    ?.match(/socketed\s*\((\d+)\)/i);
  return match ? Number(match[1]) : null;
}

function parseLimit(lines) {
  const match = lines
    .find((value) => /limit per item/i.test(value))
    ?.match(/limit per item\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function sourceMeta(sourceSlug) {
  const sources = {
    tiereduniques: { source_type: "tiered_unique", type_code: "TU" },
    sacreduniques: { source_type: "sacred_unique", type_code: "SU" },
    runewords: { source_type: "runeword", type_code: "RW" },
    sets: { source_type: "set_piece", type_code: "SET" },
    umos: { source_type: "unique_mystic_orb", type_code: "UMO" },
    cycles: { source_type: "cycle", type_code: "CYCLE" },
    relics: { source_type: "relic", type_code: "RELIC" },
    trophies: { source_type: "trophy", type_code: "TROPHY" },
    nymyrs_light: { source_type: "dungeon_reward", type_code: "SLEEP" },
  };
  return sources[sourceSlug] || { source_type: "unknown", type_code: "ITEM" };
}

module.exports = {
  normalizeSearch,
  normalizeVietnamese,
  cleanText,
  splitLines,
  parseRequirements,
  parseSockets,
  parseLimit,
  sourceMeta,
};

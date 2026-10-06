const { parseHtml } = require("../parsers/parseSource");
const { replaceSource, countItems, countSource } = require("../db");
const { validateSourceItems } = require("./syncValidationService");

const SOURCES = [
  ["tiereduniques", "https://docs.median-xl.com/doc/items/tiereduniques"],
  ["sacreduniques", "https://docs.median-xl.com/doc/items/sacreduniques"],
  ["runewords", "https://docs.median-xl.com/doc/items/runewords"],
  ["sets", "https://docs.median-xl.com/doc/items/sets"],
  ["umos", "https://docs.median-xl.com/doc/wiki/umos"],
  ["cycles", "https://docs.median-xl.com/doc/wiki/cycles"],
  ["relics", "https://docs.median-xl.com/doc/wiki/relics"],
  ["trophies", "https://docs.median-xl.com/doc/wiki/trophies"],
  ["nymyrs_light", "https://docs.median-xl.com/doc/quests/dungeons"],
];

async function fetchSource(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": process.env.SYNC_USER_AGENT || "median-xl-discord-bot/1.0",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function syncAll(logger = console) {
  const report = [];
  for (const [slug, url] of SOURCES) {
    try {
      const html = await fetchSource(url);
      const items = parseHtml(html, slug, url);
      const validation = validateSourceItems(slug, items, countSource(slug));
      if (!validation.ok)
        throw new Error(
          `Validation failed; old data preserved: ${validation.errors.join("; ")}`,
        );
      replaceSource(slug, items);
      report.push({ slug, ok: true, count: items.length, validation });
      logger.info?.({ slug, count: items.length, validation }, "source synced");
    } catch (error) {
      report.push({ slug, ok: false, error: error.message });
      logger.error?.({ slug, error: error.message }, "source sync failed");
    }
  }
  return { report, totals: countItems() };
}

module.exports = { SOURCES, syncAll };

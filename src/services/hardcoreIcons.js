"use strict";
const { appEmoji } = require("../utils/appEmoji");
const icon = (key, fallback) => appEmoji(key, fallback);
const E = {
  get coin() {
    return icon("coin", "🪙");
  },
  get hp() {
    return icon("HP", "❤️");
  },
  get attack() {
    return icon("PHYS", "⚔️");
  },
  get defense() {
    return icon("DEF", "🛡️");
  },
  get mana() {
    return icon("MANA", "💧");
  },
  get magic() {
    return icon("ELE", "🔮");
  },
  get res() {
    return icon("RES", "🔮");
  },
  get shrine() {
    return icon("event_shrine", "🗿");
  },
  get chest() {
    return icon("event_chest", "📦");
  },
  get rift() {
    return icon("rift", "🌀");
  },
  get luck() {
    return icon("LUCK", "🍀");
  },
  // Resolve new application emojis at render time, after startup loads their IDs.
  get crit() {
    return icon("CRIT", "💥");
  },
  get accuracy() {
    return icon("ACC", "🎯");
  },
  get evasion() {
    return icon("EVA", "💨");
  },
  get backpack() {
    return icon("backpack", "🎒");
  },
  get checkpoint() {
    return icon("checkpoint", "🏕️");
  },
  get potion() {
    return icon("potion", "🧪");
  },
  get ticket() {
    return icon("ticket_rngesus", "🎫");
  },
  get str() {
    return icon("STR", "💪");
  },
  get dex() {
    return icon("DEX", "🗡️");
  },
  get vit() {
    return icon("VIT", "❤️");
  },
  get ene() {
    return icon("ENE", "🔮");
  },
};
function dynamicIcons(names, fallback) {
  const result = {};
  for (const [key, name] of Object.entries(names))
    Object.defineProperty(result, key, {
      enumerable: true,
      get: () => icon(name, fallback),
    });
  return Object.freeze(result);
}
const SKILL_ICONS = dynamicIcons(
  {
    amazon: "skill_barrage",
    barbarian: "skill_ironwill",
    assassin: "skill_shadowstep",
    sorceress: "skill_arcaneburst",
    druid: "skill_windgeneration",
    necromancer: "skill_totemward",
    paladin: "skill_devineshield",
  },
  "✨",
);
const RIFT_ICONS = dynamicIcons(
  Object.fromEntries(
    [
      "stone_skin",
      "elemental_dominion",
      "bloodlust",
      "unstable_rift",
      "fortified",
      "swift_horror",
      "soul_drain",
      "cursed_ground",
    ].map((key) => [key, `rift_${key}`]),
  ),
  "🌀",
);
function eventIcon(key) {
  const aliases = {
    shrine: "event_shrine",
    class_shrine: "event_shrine",
    chest: "event_chest",
    treasure_room: "event_treasure_room",
    upgrade: "checkpoint",
    summit: "event_boss",
    final_boss: "event_boss",
  };
  return icon(
    aliases[key] || `event_${key}`,
    key === "boss_chest" ? E.chest : "⚠️",
  );
}
function treasureChestIcon(color) {
  return icon(`chest_${color}`, { red: "🟥", blue: "🟦", gold: "🟨" }[color]);
}
function paradoxIcon(id) {
  const fallback = {
    blood_pact: "🩸",
    mana_fracture: "🔷",
    inverted_armor: "🛡️",
    inverted_magic: "🔮",
    hunger: "🍖",
    time_debt: "⏳",
    blood_mirror: "🪞",
    unstable_soul: "👻",
  };
  return icon(`paradox_${id}`, fallback[id] || E.rift);
}
module.exports = {
  E,
  SKILL_ICONS,
  RIFT_ICONS,
  eventIcon,
  treasureChestIcon,
  paradoxIcon,
};

"use strict";
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
require.cache[require.resolve("better-sqlite3")].exports = function () {
  return new Database(":memory:");
};
require("../src/db");
require.cache[require.resolve("better-sqlite3")].exports = Database;
const core = require("../src/services/hardcoreV2");
const stats = require("../src/services/hardcoreStats");
const view = require("../src/services/hardcoreV2View");
const bag = require("../src/services/hardcoreInventoryService");
const { E } = require("../src/services/hardcoreIcons");

const session = { id: "economy-rework", guild_id: "g", user_id: "u" };
const rng = () => 0;
function state(encounter = { type: "empty", name: "Trống" }) {
  const s = stats.createState("sorceress", 10_000);
  Object.assign(s, { floor: 7, cleared: 6, encounter });
  stats.recompute(s);
  return s;
}

// Ticket catalog uses short names, distinct icons and complete behavior text.
assert.deepEqual(
  bag.TICKETS.map((x) => x.name),
  ["Vé thoát", "Vé cầu nguyện", "Vé hồi sinh"],
);
assert.match(bag.TICKETS[1].text, /30% lên 60%.*toàn bộ run/);
assert.match(bag.TICKETS[2].text, /50% Max HP.*tầng đó.*tầng kế tiếp/);
assert.equal(new Set([E.escapeTicket, E.prayerTicket, E.reviveTicket]).size, 3);

// Fixed deductions round up, never go negative, and cannot reduce future gains.
{
  const s = state();
  s.payoutSpent = core.rawPayout(s) - 1;
  const charged = core.deductCurrentPayout(s, 0.15, "tax");
  assert.equal(charged, 1);
  assert.equal(core.payout(s), 0);
  assert.equal(core.deductCurrentPayout(s, 0.15, "tax"), 0);
  assert.equal(s.payoutTaxPaid, 1);
  s.bonus += 100;
  assert.equal(core.payout(s), 100);
}

// Blacksmith preview and result expose the exact level and keep a cleansed UR clean.
{
  const s = state();
  const definition = core.ITEMS.cursed[0];
  const item = core.receiveItem(s, definition, 1, 1);
  s.lastReceivedItems = [];
  s.encounter = {
    type: "surprise",
    kind: "blacksmith",
    name: "Blacksmith",
    targetId: definition.id,
  };
  const text = view.encounterText(s);
  assert.match(text, /Cấp:\*\*? 1 → \*\*2/);
  assert.match(text, /vẫn sạch, không thêm nguyền/);
  assert.match(text, /12% payout gốc/);
  core.act(s, session, "event_smith", rng);
  assert.equal(item.level, 2);
  assert.equal(item.cleansedLevels, 2);
  assert.match(s.lastLog, /Lv\.1 → Lv\.2/);
  assert.ok(s.payoutServiceSpent > 0);
}

// Paid actions cannot be invoked at zero payout, including stale button abuse.
{
  const s = state();
  const definition = core.ITEMS.legendary[0];
  core.receiveItem(s, definition);
  s.encounter = {
    type: "surprise",
    kind: "blacksmith",
    name: "Blacksmith",
    targetId: definition.id,
  };
  s.payoutSpent = core.rawPayout(s);
  assert.equal(
    core.actions(s).find((x) => x.action === "event_smith").disabled,
    true,
  );
  assert.throws(
    () => core.act(s, session, "event_smith", rng),
    /INVALID_ACTION/,
  );
  assert.equal(s.items[0].level, 1);
}

// The wealth challenge charges the locked real wager and awards 150% initial stake.
{
  const s = state({
    type: "surprise",
    kind: "sacrifice",
    name: "Altar of Sacrifice",
    roll: 0,
  });
  const before = core.payout(s);
  const expectedWager = Math.ceil(core.rawPayout(s) * 0.25);
  core.act(s, session, "event_sacrifice_wealth", rng);
  assert.equal(s.payoutWagered, expectedWager);
  assert.equal(s.bonus, Math.floor(s.stake * 1.5));
  assert.ok(core.payout(s) > before);
}

// Purifier previews every removed curse and potion capacity, then records service cost.
{
  const s = state();
  const definition = core.ITEMS.cursed.find(
    (x) => x.curse?.effects.potionCapacityLoss,
  );
  assert.ok(definition, "catalog needs a potion-capacity cursed item");
  const item = core.receiveItem(s, definition, 2);
  s.lastReceivedItems = [];
  s.encounter = {
    type: "surprise",
    kind: "purifier",
    name: "Purifier",
    targetId: definition.id,
  };
  const text = view.encounterText(s);
  assert.match(text, /Gỡ 2 lớp nguyền/);
  assert.match(text, /Sức chứa bình:/);
  assert.match(text, /10% payout gốc/);
  core.act(s, session, "event_cleanse", rng);
  assert.equal(item.cleansedLevels, 2);
  assert.match(s.lastLog, /Sức chứa bình|sức chứa bình/);
  assert.ok(s.payoutServiceSpent > 0);
}

// Rift Severance buttons are icon-only and Unstable Rift cannot be selected.
{
  const s = state();
  s.phase = "severance";
  s.modifiers = { stone_skin: 2, bloodlust: 1, unstable_rift: 5 };
  const actions = core.actions(s);
  assert.deepEqual(
    actions.map((x) => x.action),
    ["sever_stone_skin", "sever_bloodlust"],
  );
  assert.ok(actions.every((x) => x.label === "\u200b" && x.riftKey));
  const payload = view
    .rows("session", s)
    .flatMap((row) => row.toJSON().components);
  const sever = payload.filter((x) => x.custom_id?.includes(":sever_"));
  assert.equal(sever.length, 2);
  assert.ok(sever.every((x) => x.label === "\u200b" && x.emoji));
}

console.log(
  "Hardcore economy/UI rework passed: tickets, forge, purifier and Rift Severance.",
);

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "discordbot-item-"));
process.env.DB_PATH = path.join(testRoot, "test.sqlite");

const database = require("../src/db");
const inserted = database.seedBundledMedianItems();
assert(
  inserted >= 2_000,
  "Catalog Median XL đóng gói phải có ít nhất 2.000 item",
);
assert.equal(
  database.seedBundledMedianItems(),
  0,
  "Không được ghi đè catalog đã tồn tại hoặc vừa sync",
);

const {
  searchItems,
  autocompleteItems,
} = require("../src/services/searchService");
const { detailEmbeds } = require("../src/utils/embeds");
const itemCommand = require("../src/commands/item");
const { COMMAND_FILES, loadCommands } = require("../src/commandRegistry");

const results = searchItems({
  query: "required level",
  type: "ALL",
  limit: 20,
});
assert(results.length > 0, "Tìm theo stat phải trả về item");
assert(results.every((item) => Array.isArray(item.stats)));
assert(autocompleteItems({ query: results[0].name, limit: 25 }).length > 0);
assert.equal(detailEmbeds(results[0])[0].toJSON().title, results[0].name);
assert.equal(itemCommand.data.toJSON().name, "item");
assert(
  COMMAND_FILES.includes("item"),
  "/item phải được đăng ký cùng bot chính",
);
assert(
  loadCommands().some((command) => command.data.toJSON().name === "item"),
  "Registry thực tế phải nạp được /item",
);

async function testPrefix() {
  const slashReplies = [];
  await itemCommand.execute({
    user: { id: "slash-user" },
    options: {
      getString: (name) => (name === "query" ? "Ophiophagus" : "SU"),
    },
    reply: async (payload) => {
      slashReplies.push(payload);
      return payload;
    },
  });
  assert.equal(slashReplies.length, 1);
  assert.equal(slashReplies[0].embeds[0].toJSON().title, "Ophiophagus");

  let captured = null;
  const replies = [];
  const command = {
    data: itemCommand.data,
    async execute(interaction) {
      captured = {
        query: interaction.options.getString("query", true),
        type: interaction.options.getString("type"),
      };
      await interaction.reply("ok");
    },
  };
  const message = {
    guildId: "guild",
    content: "!item SU sacred armor required level",
    author: { id: "user", bot: false },
    client: { commands: new Map([["item", command]]) },
    reply: async (payload) => {
      replies.push(payload);
      return { edit: async () => {}, delete: async () => {} };
    },
  };
  const handled =
    await require("../src/services/slashPrefixService").handleSlashPrefix(
      message,
    );
  assert.equal(handled, true);
  assert.deepEqual(captured, {
    query: "sacred armor required level",
    type: "SU",
  });
  assert.equal(replies.length, 1);
}

testPrefix()
  .then(() => {
    database.db.close();
    fs.rmSync(testRoot, { recursive: true, force: true });
    console.log(
      JSON.stringify({ ok: true, medianItems: inserted, prefix: true }),
    );
  })
  .catch((error) => {
    database.db.close();
    fs.rmSync(testRoot, { recursive: true, force: true });
    throw error;
  });

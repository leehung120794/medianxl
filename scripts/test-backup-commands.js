"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "bot-backup-commands-"));
assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
const backupDir = path.join(root, "backups");
fs.mkdirSync(backupDir, { recursive: true });
const liveName = "game-bot-2026-10-30T10-10-10-123Z.sqlite";
process.env.DB_PATH = path.join(backupDir, liveName);
process.env.DB_BACKUP_DIR = backupDir;
process.env.ADMIN_USER_ID = "admin-user";
process.env.DB_BACKUP_DISCORD_USER_ID = require("../src/discordBackupConfig.json").recipientId;

const { db } = require("../src/db");
db.exec("CREATE TABLE backup_command_probe(value TEXT); INSERT INTO backup_command_probe VALUES('live')");
const backupCommand = require("../src/commands/backup");
const timestamp = "2026-10-30T10-10-11-123Z";
const oldSnapshot = path.join(backupDir, `game-bot-${timestamp}-12345678.sqlite`);
const partial = `${oldSnapshot}.partial`;
const compressed = `${oldSnapshot}.discord-0123456789abcdef.gz`;
const unrelated = path.join(backupDir, "keep-me.txt");
fs.writeFileSync(oldSnapshot, "old snapshot");
fs.writeFileSync(partial, "incomplete snapshot");
fs.writeFileSync(compressed, "temporary archive");
fs.writeFileSync(unrelated, "not a backup");

function interaction({ admin = true, confirm = true, subcommand = "xoa" } = {}) {
  const replies = [];
  return {
    user: { id: admin ? "admin-user" : "someone-else" },
    memberPermissions: { has: () => false },
    options: {
      getBoolean: () => confirm,
      getSubcommand: () => subcommand,
    },
    replies,
    reply: async (payload) => replies.push(payload),
    deferReply: async () => {},
    editReply: async (payload) => replies.push(payload),
  };
}

async function main() {
  assert.equal(backupCommand.data.toJSON().name, "backup");
  const denied = interaction({ admin: false });
  await backupCommand.execute(denied);
  assert.match(denied.replies[0].content, /Chỉ admin/);
  assert(fs.existsSync(oldSnapshot));

  const cancelled = interaction({ confirm: false });
  await backupCommand.execute(cancelled);
  assert(fs.existsSync(oldSnapshot));

  const confirmed = interaction();
  await backupCommand.execute(confirmed);
  assert.match(confirmed.replies[0].content, /Database đang chạy.*không bị xóa/);
  assert(!fs.existsSync(oldSnapshot));
  assert(!fs.existsSync(partial));
  assert(!fs.existsSync(compressed));
  assert(fs.existsSync(unrelated));
  assert(fs.existsSync(process.env.DB_PATH), "live database must be preserved");
  assert.equal(db.prepare("SELECT value FROM backup_command_probe").get().value, "live");

  const delivery = require("../src/services/discordBackupService");
  delivery.setBackupDiscordClient({
    user: { id: "111111111111111111" },
    rest: {
      post: async (route, request) => {
        if (route === "/users/@me/channels") return { id: "987654321012345678" };
        assert.equal(route, "/channels/987654321012345678/messages");
        assert(request.files?.length);
        return { id: "900000000000000001" };
      },
    },
  });
  const manualBackup = interaction({ subcommand: "gui" });
  await backupCommand.execute(manualBackup);
  assert.match(manualBackup.replies[0].content, /Đã tạo, gửi và kiểm tra backup/);
  assert.equal(
    fs
      .readdirSync(backupDir)
      .filter((name) => name.endsWith(".sqlite") && name !== liveName).length,
    0,
    "manual send removes the delivered snapshot",
  );
  assert(fs.existsSync(process.env.DB_PATH), "manual send must preserve live database");

  const syncServicePath = require.resolve("../src/services/syncService");
  const originalSyncModule = require.cache[syncServicePath];
  require.cache[syncServicePath] = {
    id: syncServicePath,
    filename: syncServicePath,
    loaded: true,
    exports: {
      syncAll: async () => ({
        totals: [
          { type_code: "TU", count: 100 },
          { type_code: "SU", count: 23 },
        ],
        report: [
          { slug: "sets", ok: true },
          { slug: "relics", ok: false, error: "Validation failed" },
        ],
      }),
    },
  };
  const updateCommand = require("../src/commands/update");
  const updateInteraction = interaction();
  await updateCommand.execute(updateInteraction);
  assert.equal(updateCommand.data.toJSON().name, "update");
  assert.match(updateInteraction.replies[0].content, /1\/2\*\* nguồn/);
  assert.match(updateInteraction.replies[0].content, /123 item/);
  assert.doesNotMatch(updateInteraction.replies[0].content, /\[object Object\]/);
  assert.match(updateInteraction.replies[0].content, /relics/);
  if (originalSyncModule) require.cache[syncServicePath] = originalSyncModule;
  else delete require.cache[syncServicePath];

  console.log(JSON.stringify({ ok: true, cases: ["admin and confirmation gates", "only backup artifacts deleted", "live database preserved", "manual backup upload and cleanup", "update command reports partial sync"] }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

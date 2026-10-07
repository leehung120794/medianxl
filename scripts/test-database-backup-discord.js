"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "backup-discord-"));
process.env.DB_PATH = path.join(directory, "test.sqlite");
process.env.DB_BACKUP_DIR = path.join(directory, "backups");

const database = require("../src/db");
const {
  nextDailyBackupAt,
  sendBackupToDiscord,
  runAndSendDatabaseBackup,
} = require("../src/services/databaseBackupService");

async function main() {
  assert.equal(
    nextDailyBackupAt(
      new Date("2026-10-06T23:59:59.000Z"),
      7,
      "Asia/Bangkok",
    ).toISOString(),
    "2026-10-07T00:00:00.000Z",
  );
  assert.equal(
    nextDailyBackupAt(
      new Date("2026-10-07T00:00:00.000Z"),
      7,
      "Asia/Bangkok",
    ).toISOString(),
    "2026-10-08T00:00:00.000Z",
  );

  const source = path.join(directory, "sample.sqlite");
  const expected = Buffer.from("sqlite-backup-test");
  fs.writeFileSync(source, expected);
  let fetchedId = null;
  let payload = null;
  let uploaded = null;
  const client = {
    users: {
      async fetch(id) {
        fetchedId = id;
        return {
          async send(value) {
            payload = value;
            uploaded = zlib.gunzipSync(
              fs.readFileSync(value.files[0].attachment),
            );
          },
        };
      },
    },
  };
  const result = await sendBackupToDiscord(
    client,
    source,
    new Date("2026-10-07T00:00:00.000Z"),
    "419031030025158658",
  );
  assert.equal(fetchedId, "419031030025158658");
  assert.deepEqual(uploaded, expected);
  assert.match(payload.content, /Backup dữ liệu bot tự động/);
  assert.match(payload.files[0].name, /\.sqlite\.gz$/);
  assert.equal(result.userId, fetchedId);
  assert.equal(fs.existsSync(`${source}.gz`), false);

  payload = null;
  uploaded = null;
  const firstManual = runAndSendDatabaseBackup(
    client,
    new Date("2026-10-07T00:01:00.000Z"),
  );
  const duplicateManual = runAndSendDatabaseBackup(
    client,
    new Date("2026-10-07T00:01:01.000Z"),
  );
  assert.strictEqual(
    duplicateManual,
    firstManual,
    "Hai yêu cầu đồng thời phải dùng chung một job backup",
  );
  const manual = await firstManual;
  assert.equal(manual.delivery.userId, "419031030025158658");
  assert.equal(uploaded.subarray(0, 15).toString(), "SQLite format 3");
  assert.equal(fs.existsSync(`${manual.destination}.gz`), false);

  const adminCommand = require("../src/commands/quantri").data.toJSON();
  assert(
    adminCommand.options.some((option) => option.name === "guibackup"),
    "/quantri guibackup phải được đăng ký",
  );
  assert(adminCommand.options.length <= 25, "Slash command vượt quá 25 mục");

  console.log(
    JSON.stringify({
      ok: true,
      nextAtSeven: true,
      recipient: fetchedId,
      gzipCleaned: true,
      manualSingleFlight: true,
      commandRegistered: true,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    database.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

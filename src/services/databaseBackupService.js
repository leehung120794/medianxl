const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");
const { db, dbPath } = require("../db");

const DAY_MS = 24 * 60 * 60 * 1000;

function integerEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

const BACKUP_INTERVAL_HOURS = integerEnv(
  "DB_BACKUP_INTERVAL_HOURS",
  24,
  1,
  168,
);
const BACKUP_RETENTION = integerEnv("DB_BACKUP_RETENTION", 14, 2, 90);
const BACKUP_DISCORD_USER_ID =
  process.env.DB_BACKUP_DISCORD_USER_ID || "419031030025158658";
const BACKUP_DISCORD_HOUR = integerEnv("DB_BACKUP_DISCORD_HOUR", 7, 0, 23);
const BACKUP_TIME_ZONE =
  process.env.DB_BACKUP_TIME_ZONE ||
  process.env.ECONOMY_TIME_ZONE ||
  "Asia/Bangkok";
const BACKUP_DM_MAX_BYTES = integerEnv(
  "DB_BACKUP_DM_MAX_BYTES",
  9_500_000,
  1_000_000,
  100_000_000,
);
const backupDir = path.resolve(
  process.env.DB_BACKUP_DIR || path.join(path.dirname(dbPath), "backups"),
);
const backupStatus = {
  running: false,
  lastStartedAt: null,
  lastSuccessAt: null,
  lastDestination: null,
  lastError: null,
  lastDeliveredAt: null,
  lastDeliveryError: null,
  nextDeliveryAt: null,
};
let manualDeliveryPending = null;
let backupLogger = console;

function backupName(now = new Date()) {
  return `game-bot-${now.toISOString().replace(/[:.]/g, "-")}.sqlite`;
}

async function cleanupBackups(retention = BACKUP_RETENTION) {
  const files = (await fs.promises.readdir(backupDir, { withFileTypes: true }))
    .filter(
      (entry) => entry.isFile() && /^game-bot-.*\.sqlite$/.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();
  await Promise.all(
    files
      .slice(retention)
      .map((name) => fs.promises.unlink(path.join(backupDir, name))),
  );
  return Math.max(0, files.length - retention);
}

async function runDatabaseBackup(now = new Date()) {
  await fs.promises.mkdir(backupDir, { recursive: true });
  const destination = path.join(backupDir, backupName(now));
  const temporary = `${destination}.partial`;
  await fs.promises.rm(temporary, { force: true });
  try {
    await db.backup(temporary);
    await fs.promises.rename(temporary, destination);
    const deleted = await cleanupBackups();
    return { destination, deleted };
  } catch (error) {
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function dateParts(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function zonedTimeToUtc(parts, timeZone) {
  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute || 0,
    parts.second || 0,
  );
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = dateParts(new Date(timestamp), timeZone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    timestamp += target - represented;
  }
  return new Date(timestamp);
}

function nextDailyBackupAt(
  now = new Date(),
  hour = BACKUP_DISCORD_HOUR,
  timeZone = BACKUP_TIME_ZONE,
) {
  const local = dateParts(now, timeZone);
  let target = zonedTimeToUtc(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
  if (target.getTime() <= now.getTime()) {
    const nextCalendarDay = new Date(
      Date.UTC(local.year, local.month - 1, local.day + 1),
    );
    target = zonedTimeToUtc(
      {
        year: nextCalendarDay.getUTCFullYear(),
        month: nextCalendarDay.getUTCMonth() + 1,
        day: nextCalendarDay.getUTCDate(),
        hour,
        minute: 0,
        second: 0,
      },
      timeZone,
    );
  }
  return target;
}

async function sendBackupToDiscord(
  client,
  destination,
  now = new Date(),
  userId = BACKUP_DISCORD_USER_ID,
) {
  if (!client?.users?.fetch) throw new Error("DISCORD_CLIENT_NOT_READY");
  const compressed = `${destination}.gz`;
  await fs.promises.rm(compressed, { force: true });
  try {
    await pipeline(
      fs.createReadStream(destination),
      zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
      fs.createWriteStream(compressed, { flags: "wx" }),
    );
    const size = (await fs.promises.stat(compressed)).size;
    if (size > BACKUP_DM_MAX_BYTES) {
      const error = new Error(
        `BACKUP_ATTACHMENT_TOO_LARGE:${size}:${BACKUP_DM_MAX_BYTES}`,
      );
      error.code = "BACKUP_ATTACHMENT_TOO_LARGE";
      throw error;
    }
    const user = await client.users.fetch(userId);
    await user.send({
      content: `🗄️ Backup dữ liệu bot tự động lúc <t:${Math.floor(now.getTime() / 1000)}:F>.`,
      files: [
        {
          attachment: compressed,
          name: `${path.basename(destination)}.gz`,
        },
      ],
      allowedMentions: { parse: [] },
    });
    return { userId, size, destination };
  } finally {
    await fs.promises.rm(compressed, { force: true }).catch(() => {});
  }
}

function runAndSendDatabaseBackup(client, now = new Date()) {
  if (manualDeliveryPending) return manualDeliveryPending;
  manualDeliveryPending = (async () => {
    backupStatus.running = true;
    backupStatus.lastStartedAt = now.toISOString();
    let result;
    try {
      result = await runDatabaseBackup(now);
      backupStatus.lastSuccessAt = new Date().toISOString();
      backupStatus.lastDestination = result.destination;
      backupStatus.lastError = null;
      backupLogger.info?.(result, "manual database backup completed");
    } catch (error) {
      backupStatus.lastError = error?.message || String(error);
      backupLogger.error?.({ err: error }, "manual database backup failed");
      throw error;
    } finally {
      backupStatus.running = false;
    }
    try {
      const delivery = await sendBackupToDiscord(
        client,
        result.destination,
        now,
      );
      backupStatus.lastDeliveredAt = new Date().toISOString();
      backupStatus.lastDeliveryError = null;
      backupLogger.info?.(
        delivery,
        "manual database backup sent by Discord DM",
      );
      return { ...result, delivery };
    } catch (error) {
      backupStatus.lastDeliveryError = error?.message || String(error);
      error.backupDestination = result.destination;
      backupLogger.error?.(
        { err: error },
        "manual database backup Discord DM failed",
      );
      throw error;
    }
  })().finally(() => {
    manualDeliveryPending = null;
  });
  return manualDeliveryPending;
}

function startDatabaseBackups(clientOrLogger = console, suppliedLogger) {
  const client = clientOrLogger?.users?.fetch ? clientOrLogger : null;
  const logger = client ? suppliedLogger || console : clientOrLogger;
  backupLogger = logger;
  let stopped = false;
  let pending = null;
  let deliveryPending = null;
  let dailyTimer = null;
  const run = () => {
    if (stopped || pending) return pending;
    backupStatus.running = true;
    backupStatus.lastStartedAt = new Date().toISOString();
    pending = runDatabaseBackup()
      .then((result) => {
        backupStatus.lastSuccessAt = new Date().toISOString();
        backupStatus.lastDestination = result.destination;
        backupStatus.lastError = null;
        logger.info?.(result, "database backup completed");
        return result;
      })
      .catch((error) => {
        backupStatus.lastError = error?.message || String(error);
        logger.error?.({ err: error }, "database backup failed");
        return null;
      })
      .finally(() => {
        pending = null;
        backupStatus.running = false;
      });
    return pending;
  };
  const deliver = async () => {
    if (stopped || deliveryPending) return deliveryPending;
    deliveryPending = (async () => {
      const result = await run();
      if (!result || stopped) return null;
      try {
        const delivery = await sendBackupToDiscord(client, result.destination);
        backupStatus.lastDeliveredAt = new Date().toISOString();
        backupStatus.lastDeliveryError = null;
        logger.info?.(delivery, "database backup sent by Discord DM");
        return delivery;
      } catch (error) {
        backupStatus.lastDeliveryError = error?.message || String(error);
        logger.error?.({ err: error }, "database backup Discord DM failed");
        return null;
      }
    })().finally(() => {
      deliveryPending = null;
    });
    return deliveryPending;
  };
  const scheduleDailyDelivery = () => {
    if (!client || stopped) return;
    const next = nextDailyBackupAt();
    backupStatus.nextDeliveryAt = next.toISOString();
    dailyTimer = setTimeout(
      async () => {
        await deliver();
        scheduleDailyDelivery();
      },
      Math.max(1_000, next.getTime() - Date.now()),
    );
    dailyTimer.unref?.();
  };
  run();
  const timer = setInterval(run, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
  timer.unref?.();
  scheduleDailyDelivery();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      if (dailyTimer) clearTimeout(dailyTimer);
      backupStatus.nextDeliveryAt = null;
      await pending;
      await deliveryPending;
      await manualDeliveryPending;
    },
  };
}

function getBackupStatus() {
  return {
    ...backupStatus,
    backupDir,
    retention: BACKUP_RETENTION,
    intervalHours: BACKUP_INTERVAL_HOURS,
    discordUserId: BACKUP_DISCORD_USER_ID,
    discordHour: BACKUP_DISCORD_HOUR,
    timeZone: BACKUP_TIME_ZONE,
    maxDmBytes: BACKUP_DM_MAX_BYTES,
  };
}

module.exports = {
  DAY_MS,
  BACKUP_INTERVAL_HOURS,
  BACKUP_RETENTION,
  BACKUP_DISCORD_USER_ID,
  BACKUP_DISCORD_HOUR,
  BACKUP_TIME_ZONE,
  BACKUP_DM_MAX_BYTES,
  backupDir,
  backupName,
  cleanupBackups,
  runDatabaseBackup,
  nextDailyBackupAt,
  sendBackupToDiscord,
  runAndSendDatabaseBackup,
  startDatabaseBackups,
  getBackupStatus,
};

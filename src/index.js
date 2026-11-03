require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  RESTEvents,
  GatewayIntentBits,
  MessageFlags,
} = require("discord.js");
const pino = require("pino");
const { db } = require("./db");

const { loadCommands } = require("./commandRegistry");
const monitoring = require("./services/monitoringService");
const { startDatabaseBackups } = require("./services/databaseBackupService");
const { closeRetiredGameSessions } = require("./services/removedGameCleanupService");
const { createRateLimiter } = require("./services/rateLimitService");

if (!process.env.DISCORD_TOKEN)
  throw new Error("Missing DISCORD_TOKEN in .env");
const logDir = path.resolve(process.env.LOG_DIR || "./logs");
fs.mkdirSync(logDir, { recursive: true });
const logger = pino(
  { level: process.env.LOG_LEVEL || "info" },
  pino.multistream([
    { stream: process.stdout },
    {
      stream: pino.destination({
        dest: path.join(logDir, process.env.LOG_FILE_NAME || "bot.log"),
        sync: false,
      }),
    },
  ]),
);
// Đóng các ván từ phiên bản cũ và hoàn cược đang giữ trước khi ngừng game vĩnh viễn.
closeRetiredGameSessions(logger);
const rateLimiter = createRateLimiter();
let backupManager = null;
let shuttingDown = false;
let activeInteractions = 0;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.rest.on(RESTEvents.RateLimited, (limit) => {
  // Never log the request URL: interaction webhook URLs contain private tokens.
  logger.warn(
    {
      global: limit.global,
      method: limit.method,
      timeToResetMs: limit.timeToReset,
      retryAfterMs: limit.retryAfter,
      sublimitTimeoutMs: limit.sublimitTimeout,
      limit: limit.limit,
    },
    "discord REST rate limited",
  );
});
const commandModules = loadCommands();
client.commands = new Collection(
  commandModules.map((command) => [command.data.toJSON().name, command]),
);

// Backup starts even if Discord is unavailable or still connecting.
backupManager = startDatabaseBackups(logger);

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Median XL item bot shutting down");
  rateLimiter.stop();
  // Reject new work and give ongoing handlers a bounded chance to persist their action.
  const drainDeadline = Date.now() + 10_000;
  while (
    activeInteractions &&
    Date.now() < drainDeadline
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  if (activeInteractions)
    logger.warn(
      { activeInteractions },
      "shutdown drain timed out; backing up committed state",
    );
  await backupManager
    ?.stop({ finalBackup: signal !== "uncaughtException" })
    .catch((error) =>
      logger.error({ err: error }, "could not finish database backup"),
    );
  await client.destroy();
  try {
    db.close();
  } catch (error) {
    logger.error({ err: error }, "could not close database");
  }
  logger.flush?.();
  process.exitCode = exitCode;
  // Release a supervisor IPC channel after backup and connection cleanup.
  if (process.connected) process.disconnect();
}
process.once("SIGINT", () => {
  shutdown("SIGINT").catch(() => {
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  shutdown("SIGTERM").catch(() => {
    process.exitCode = 1;
  });
});
process.on("unhandledRejection", (error) => {
  logger.error({ err: error }, "unhandled rejection");
  monitoring.recordRuntimeError(error, { source: "unhandledRejection" });
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  monitoring.recordRuntimeError(error, { source: "uncaughtException" });
  shutdown("uncaughtException", 1).catch(() => {
    process.exitCode = 1;
  });
});
client.once(Events.ClientReady, async () => {
  if (shuttingDown) return;
  // Database backup delivery runs independently from item commands.
  backupManager
    .discordReady(client)
    .catch((error) =>
      logger.error(
        { code: error.code || error.name },
        "could not start Discord backup delivery",
      ),
    );
  logger.info(
    { user: client.user.tag, commands: [...client.commands.keys()] },
    "Median XL item bot ready",
  );
});
client.on(Events.InteractionCreate, async (interaction) => {
  if (shuttingDown) return;
  activeInteractions++;
  try {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) await command.autocomplete(interaction);
      return;
    }
    const delivery = rateLimiter.consume(
      `interaction:${interaction.id}`,
      1,
      5 * 60_000,
    );
    if (!delivery.allowed || !interaction.isChatInputCommand()) return;
    const rate = rateLimiter.consume(
      `command:${interaction.guildId}:${interaction.user.id}`,
      6,
      5_000,
    );
    if (!rate.allowed) {
      return interaction.reply({
        content: `Bạn thao tác quá nhanh. Hãy thử lại sau ${Math.ceil(rate.retryAfter / 1000)} giây.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const command = client.commands.get(interaction.commandName);
    if (!command)
      return interaction.reply({
        content: "Phiên bản này không có lệnh đó.",
        flags: MessageFlags.Ephemeral,
      });
    await command.execute(interaction);
  } catch (error) {
    logger.error({ err: error }, "interaction failed");
    monitoring.recordRuntimeError(error, { source: "interaction" });
    const payload = {
      content: "Có lỗi khi xử lý lệnh.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied)
      await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  } finally {
    activeInteractions--;
  }
});
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.fatal({ err: error }, "discord login failed");
  process.exitCode = 1;
});

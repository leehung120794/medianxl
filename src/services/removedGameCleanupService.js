const { db } = require("../db");

const RETIRED_SESSIONS = Object.freeze([
  {
    table: "chinchiro_sessions",
    close: (...args) =>
      require("./chinchiroService").forceEndChinchiroSession(...args),
  },
  {
    table: "coquay_sessions",
    close: (...args) => require("./coquayService").forceEndCoquaySession(...args),
  },
  {
    table: "hardcore_sessions",
    close: (...args) =>
      require("./hardcoreService").forceEndHardcoreSession(...args),
  },
]);

function closeRetiredGameSessions(logger = console) {
  let closed = 0;
  let refunded = 0;
  for (const game of RETIRED_SESSIONS) {
    const sessions = db
      .prepare(`SELECT id,guild_id FROM ${game.table}`)
      .all();
    for (const session of sessions) {
      try {
        const result = game.close(session.id, session.guild_id, "mode-removed", {
          label: "mode-removed-refund",
          forfeit: false,
        });
        if (result) {
          closed += 1;
          refunded += Number(result.session?.stake ?? result.state?.stake ?? 0);
        }
      } catch (error) {
        logger.error?.(
          { err: error, game: game.table, sessionId: session.id },
          "could not close retired game session",
        );
      }
    }
  }
  if (closed)
    logger.info?.(
      { sessions: closed, stakeRefunded: refunded },
      "retired game sessions closed and stakes refunded",
    );
  return { closed, refunded };
}

module.exports = { closeRetiredGameSessions };

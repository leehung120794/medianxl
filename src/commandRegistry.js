const COMMAND_FILES = Object.freeze([
  "item",
  "update",
  "backup",
]);

function loadCommands(base = "./commands") {
  const core = COMMAND_FILES.map((name) => require(`${base}/${name}`));
  const cultivation = require(`${base}/tuTien`).commands;
  return [...core, ...cultivation];
}

module.exports = { COMMAND_FILES, loadCommands };

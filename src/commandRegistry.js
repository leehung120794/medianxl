const COMMAND_FILES = Object.freeze([
  "item",
  "update",
  "backup",
]);

function loadCommands(base = "./commands") {
  return COMMAND_FILES.map((name) => require(`${base}/${name}`));
}

module.exports = { COMMAND_FILES, loadCommands };

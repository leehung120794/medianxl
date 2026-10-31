const COMMAND_FILES = Object.freeze([
  "batdau",
  "trogiup",
  "huongdan",
  "changelog",
  "baucua",
  "taixiu",
  "xidach",
  "poker",
  "duangua",
  "domin",
  "luat",
  "hoso",
  "xu",
  "xephang",
  "anxin",
  "quantri",
  "update",
  "backup",
  "item",
  "vtv",
]);

function loadCommands(base = "./commands") {
  const standalone = require(`${base}/choi`).standaloneCommands;
  return COMMAND_FILES.map((name) =>
    name === "vtv"
      ? require(`${base}/vuatiengviet`).playerCommand
      : standalone[name] || require(`${base}/${name}`),
  );
}

module.exports = { COMMAND_FILES, loadCommands };

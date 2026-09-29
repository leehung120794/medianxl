const assert = require('node:assert');
const { calculate } = require('../src/services/speedcalcService');
const morphs = ['Werewolf', 'Werebear', 'Wereowl', 'Superbeast', 'Deathlord', 'Treewarden', 'a1m', 'a2m'];
const outputs = [];
for (const character of morphs) {
  const result = calculate({ character, mode: 'attack', weapon: 'Short Sword', speed: 100, skillSlow: 0 });
  assert(Number.isInteger(result.current.frame), `${character} attack frame invalid`);
  outputs.push({ character, frame: result.current.frame });
}
const throwing = calculate({ character: 'Amazon', mode: 'attack', weapon: 'Throwing Knife', speed: 100, skillSlow: 0 });
const dualInputIgnored = calculate({ character: 'Assassin', mode: 'attack', weapon: 'Katar', speed: 100, skillSlow: 0, dualWield: true });
assert(Number.isInteger(throwing.current.frame));
assert(Number.isInteger(dualInputIgnored.current.frame));
console.log(JSON.stringify({ ok: true, morphs: outputs, throwing: throwing.current, dualWieldInputAcceptedButNotExplicit: dualInputIgnored.current }));

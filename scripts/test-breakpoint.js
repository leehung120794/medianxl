const assert = require('node:assert');
const { calculate, autocompleteWeapons } = require('../src/services/speedcalcService');
const command = require('../src/commands/breakpoint');

const commandJson = command.data.toJSON();
assert(commandJson.name === 'breakpoint', 'breakpoint command missing');
const characterOption = commandJson.options.find(option => option.name === 'character');
assert(new Set(characterOption.choices.map(choice => choice.value)).size === characterOption.choices.length, 'duplicate character choice value');
assert(command.data.options.some(option => option.name === 'weapon' && option.autocomplete === true), 'weapon autocomplete missing');
const weaponSuggestions = autocompleteWeapons('bow');
assert(weaponSuggestions.length > 0, 'bow autocomplete returned no result');
const attack = calculate({ character: 'Amazon', mode: 'attack', weapon: 'Short Bow', speed: 100, skillSlow: 0 });
const cast = calculate({ character: 'Sorceress', mode: 'cast', weapon: 'Short Staff', speed: 100, skillSlow: 0 });
const block = calculate({ character: 'Paladin', mode: 'block', weapon: 'Short Sword', speed: 50, skillSlow: 0 });
for (const result of [attack, cast, block]) {
  assert(Number.isInteger(result.current.frame), 'frame should be integer');
  assert(result.breakpoints.length > 0, 'breakpoint list should not be empty');
}
console.log(JSON.stringify({ ok: true, attack: attack.current, cast: cast.current, block: block.current, bowSuggestions: weaponSuggestions.length }));

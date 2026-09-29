const data = require('../../data/speedcalc.json');

const chars = new Map(data.chars.map(x => [x.id, x]));
const weapons = data.weapons;
const animations = data.animations;
const skillSlows = [
  { label: 'None', value: 0 },
  { label: 'Decrepify', value: -20 },
  { label: 'Phoboss on hit', value: -20 },
  { label: 'Uldyssian aura', value: -30 },
  { label: 'Chill — Attack', value: -50 },
];

function findWeapon(query = '') {
  const normalized = String(query).trim().toLowerCase();
  return weapons.find(x => x.label.toLowerCase() === normalized)
    || weapons.find(x => x.label.toLowerCase().includes(normalized));
}
function anim(token, suffix) {
  const value = animations[`${token}${suffix}`];
  if (!value) throw new Error(`Animation data missing: ${token}${suffix}`);
  return value;
}
function weaponGroup(label = '') {
  const x = label.toLowerCase();
  if (/crossbow/.test(x)) return 'xbow';
  if (/bow/.test(x)) return 'bow';
  if (/spear|pike|javelin|pilum|glaive|trident|brandinstock|spetum|lance|tepoztopilli/.test(x)) return 'spear';
  if (/throwing knife|flying knife|balanced knife/.test(x)) return 'tkni';
  if (/throwing axe|balanced axe/.test(x)) return 'taxe';
  if (/katar|wrist blade|hatchet hands|cestus|claw|talons|scissors katar/.test(x)) return 'h2h';
  if (/dagger|dirk|kriss|blade|kukri|wand|orb|globe|sphere|stone|warp blade|sword|scepter|axe|mace|hammer|club|flail|scythe|staff|staf|naginata|halberd|maul|goedendag|angel star|bonebreaker|hand of god|holy lance/.test(x)) return 'melee';
  return 'melee';
}
function selectedAnimation(charId, mode, weaponLabel) {
  const token = chars.get(charId)?.token;
  if (!token) throw new Error(`Unknown character: ${charId}`);
  const group = weaponGroup(weaponLabel);
  let suffix;
  let startFrame = 0;
  let wsmStart = false;
  if (mode === 'attack') {
    if (/Deathlord|Treewarden|Wereowl|Superbeast|Werebear|Werewolf|a1m|a2m/.test(charId)) suffix = 'A1HTH';
    else if (group === 'xbow') suffix = 'A1XBW';
    else if (group === 'bow') suffix = 'A1BOW';
    else if (group === 'spear') suffix = 'A12HT';
    else if (group === 'h2h') suffix = 'A1HT1';
    else if (group === 'tkni' || group === 'taxe') { suffix = group === 'taxe' ? 'A11HS' : 'A11HT'; startFrame = 2; }
    else if (/two-handed|great axe|large axe|battle axe|maul|great maul|flamberge|great sword|giant sword|bastard sword|claymore|two-hand/.test(weaponLabel.toLowerCase())) { suffix = 'A1STF'; startFrame = 2; }
    else { suffix = 'A11HS'; startFrame = 2; }
    if (['Amazon', 'Sorceress'].includes(charId) && startFrame === 2) startFrame = 2;
    return { token, anim: anim(token, suffix), startFrame, wsmStart };
  }
  if (mode === 'cast') {
    if (['Deathlord', 'Treewarden'].includes(charId)) suffix = 'A1HTH';
    else if (['Superbeast', 'Werebear', 'Werewolf', 'Wereowl'].includes(charId)) suffix = 'SCHTH';
    else if (group === 'xbow') suffix = 'SCXBW';
    else if (group === 'bow') suffix = 'SCBOW';
    else if (group === 'spear') suffix = 'SC2HT';
    else if (group === 'h2h') suffix = 'SCHT1';
    else if (group === 'tkni' || group === 'taxe') suffix = 'SC1HT';
    else if (/two-handed|great axe|large axe|battle axe|maul|great maul|flamberge|great sword|giant sword|bastard sword|claymore|two-hand/.test(weaponLabel.toLowerCase())) suffix = 'SCSTF';
    else suffix = 'SC1HS';
    return { token, anim: anim(token, suffix), startFrame: 0, wsmStart };
  }
  if (mode === 'block') {
    suffix = group === 'h2h' ? 'BLHT1' : (group === 'tkni' || group === 'taxe' || group === 'spear' ? 'BL1HT' : 'BL1HS');
    if (['Werebear', 'Werewolf', 'Wereowl'].includes(charId)) suffix = 'BLHTH';
    if (['Deathlord', 'Treewarden', 'Superbeast'].includes(charId)) suffix = 'GHHTH';
    return { token, anim: anim(token, suffix), startFrame: 0, wsmStart };
  }
  suffix = group === 'h2h' ? 'GHHT1' : group === 'xbow' ? 'GHXBW' : group === 'bow' ? 'GHBOW' : group === 'spear' ? 'GH2HT' : 'GH1HS';
  if (['Werebear', 'Werewolf', 'Wereowl', 'Deathlord', 'Treewarden', 'Superbeast', 'a1m', 'a2m'].includes(charId)) suffix = 'GHHTH';
  return { token, anim: anim(token, suffix), startFrame: 0, wsmStart };
}
function effectiveSpeed(speed, slow) { return Math.floor(120 * speed / (120 + speed)) + slow; }
function frameFor(mode, frames, animationSpeed, speed, slow, wsm = 0, startFrame = 0) {
  if (mode === 'block' || mode === 'recovery') return Math.ceil(256 * frames / Math.floor(animationSpeed * (50 + effectiveSpeed(speed, slow)) / 100)) - 1;
  if (mode === 'cast') return Math.ceil(256 * frames / Math.floor(animationSpeed * (100 + Math.min(effectiveSpeed(speed, slow), 75)) / 100)) - 1;
  const attackEffective = Math.floor(120 * speed / (120 + speed));
  return Math.ceil(256 * (frames - startFrame) / Math.floor(animationSpeed * (100 + Math.min(attackEffective - wsm + slow, 75)) / 100)) - 1;
}
function calculate({ character, mode = 'attack', weapon, speed = 0, skillSlow = 0 }) {
  const selected = findWeapon(weapon);
  if (!selected) throw new Error(`Unknown weapon base: ${weapon}`);
  const normalizedMode = mode === 'block' ? 'block' : mode === 'recovery' ? 'recovery' : mode;
  const animation = selectedAnimation(character, normalizedMode, selected.label);
  const actualMode = normalizedMode === 'recovery' ? 'recovery' : normalizedMode;
  const current = frameFor(actualMode, animation.anim.frames, animation.anim.speed, Number(speed), Number(skillSlow), selected.wsm, animation.startFrame);
  const maxSpeed = actualMode === 'cast' ? 200 : 999;
  const points = [];
  let lastFrame = current;
  for (let s = Number(speed); s <= maxSpeed; s += 1) {
    const frame = frameFor(actualMode, animation.anim.frames, animation.anim.speed, s, Number(skillSlow), selected.wsm, animation.startFrame);
    if (frame < lastFrame) { points.push({ frame, speed: s, gain: s - Number(speed) }); lastFrame = frame; }
  }
  const previous = [];
  for (let s = Number(speed); s >= 0; s -= 1) {
    const frame = frameFor(actualMode, animation.anim.frames, animation.anim.speed, s, Number(skillSlow), selected.wsm, animation.startFrame);
    if (frame > current) { previous.push({ frame, speed: s + 1, delta: s + 1 - Number(speed) }); break; }
  }
  return { character: chars.get(character), mode: actualMode, weapon: selected, skillSlow: Number(skillSlow), current: { frame: current, speed: Number(speed) }, previous: previous[0] || null, next: points.slice(0, 5), breakpoints: points.slice(0, 18), source: data.source };
}
function autocompleteWeapons(query = '') { const q = query.trim().toLowerCase(); return weapons.filter(x => !q || x.label.toLowerCase().includes(q)).slice(0, 25); }
module.exports = { calculate, autocompleteWeapons, chars: data.chars, skillSlows, weapons };

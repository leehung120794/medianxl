const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gamebot-hardcore-'));
process.env.DB_PATH = path.join(temporary, 'simulation.sqlite');
process.env.ECONOMY_STARTING_COINS = '1000';
const { db } = require('../src/db');
const hardcore = require('../src/services/hardcoreService');
const hardcoreRepository = require('../src/services/hardcoreRepository');
const { createFairness } = require('../src/services/fairnessService');
const productionDb = path.resolve(__dirname, '../data/median-xl.sqlite');
if (fs.existsSync(productionDb)) {
  db.prepare('ATTACH DATABASE ? AS item_source').run(productionDb);
  db.exec('INSERT OR IGNORE INTO main.items SELECT * FROM item_source.items');
  db.exec('DETACH DATABASE item_source');
}
const runs = Math.max(10, Math.min(1000, Number(process.argv[2]) || 100));
const targetFloor = Math.max(11, Math.min(999, Number(process.argv[3]) || 50));
const maxTurns = Math.max(2_000, Math.min(100_000, Number(process.argv[4]) || targetFloor * 40));
const classFilter = String(process.argv[5] || '').trim().toLowerCase();
const finalReplays = Math.max(0, Math.min(1000, Number(process.argv[6]) || 0));

function actionFor(state) {
  if (state.phase === 'upgrade') {
    const checkpoint = Math.max(1, Math.floor(state.cleared / 5));
    if (state.maxHp < state.damageMax * 5) return 'upgrade_hp';
    if (checkpoint % 5 === 0) return 'upgrade_defense';
    if (checkpoint % 7 === 0) return 'upgrade_luck';
    return 'upgrade_attack';
  }
  if (state.phase === 'summit') return 'retreat';
  const encounter = state.encounter;
  if (encounter.type === 'combat') {
    if (state.potions && state.hp < state.maxHp * 0.52 && encounter.hp > state.damageMax * 2) return 'potion';
    if (state.energy >= 2 && encounter.hp > state.damageMax * 0.8) return 'skill';
    return 'attack';
  }
  if (encounter.type === 'chest') {
    if (!encounter.inspected) return 'inspect';
    if (encounter.revealed) return 'leave';
    return 'open';
  }
  if (encounter.type === 'shrine') return 'ignore';
  if (encounter.type === 'rngesus') return 'bribe';
  if (encounter.type === 'surprise') {
    if (encounter.kind === 'blacksmith') return 'forge';
    if (encounter.kind === 'purifier') return 'purify';
    if (encounter.kind === 'wandering_healer') return 'event_accept';
    return 'event_skip';
  }
  return 'continue';
}

const report = {};
for (const classKey of Object.keys(hardcore.CLASSES).filter(key => !classFilter || key === classFilter)) {
  const floors = [];
  let bestState = null;
  const finalSnapshots = [];
  for (let i = 0; i < runs; i += 1) {
    const userId = `${classKey}-${i}`;
    const started = hardcore.startHardcore({ guildId: 'simulation', userId, channelId: 'c', stake: 10, classKey });
    let state = started.state;
    let capturedFinal = false;
    for (let turn = 0; turn < maxTurns && state.cleared < targetFloor; turn += 1) {
      if (!capturedFinal && state.floor === 999 && state.cleared === 998 && state.encounter?.rank === 'final_boss') {
        finalSnapshots.push(JSON.parse(JSON.stringify(state)));
        capturedFinal = true;
      }
      const played = hardcore.playHardcore({ sessionId: started.session.id, userId, expectedTurn: state.turn, action: actionFor(state) });
      state = played.state;
      if (played.settled) break;
    }
    floors.push(state.cleared);
    if (!bestState || state.cleared > bestState.cleared) bestState = JSON.parse(JSON.stringify(state));
    if (hardcore.getHardcoreByUser('simulation', userId)) hardcore.playHardcore({ sessionId: started.session.id, userId, expectedTurn: state.turn, action: 'retreat' });
  }
  let finalCalibration = null;
  if (finalReplays && finalSnapshots.length) {
    let wins = 0;
    let trials = 0;
    for (let snapshotIndex = 0; snapshotIndex < finalSnapshots.length; snapshotIndex += 1) {
      for (let replay = 0; replay < finalReplays; replay += 1) {
        const userId = `final-${classKey}-${snapshotIndex}-${replay}`;
        const started = hardcore.startHardcore({ guildId: 'final-calibration', userId, channelId: 'c', stake: 10, classKey,
          forcedEncounter: { type: 'empty' } });
        let state = JSON.parse(JSON.stringify(finalSnapshots[snapshotIndex]));
        state.turn = 0;
        state.fair = createFairness();
        state.fairCounter = 0;
        state.encounter = hardcore.makeEnemy(999, 'final_boss', null, state);
        hardcoreRepository.saveState(started.session, state);
        for (let turn = 0; turn < 500; turn += 1) {
          const played = hardcore.playHardcore({ sessionId: started.session.id, userId, expectedTurn: state.turn, action: actionFor(state) });
          state = played.state;
          if (state.cleared >= 999 || played.settled) break;
        }
        if (state.cleared >= 999) wins += 1;
        trials += 1;
        if (hardcore.getHardcoreByUser('final-calibration', userId)) {
          hardcore.playHardcore({ sessionId: started.session.id, userId, expectedTurn: state.turn, action: 'retreat' });
        }
      }
    }
    const conditionalRate = trials ? wins / trials : 0;
    finalCalibration = { snapshots: finalSnapshots.length, trials, wins, conditionalRate: +conditionalRate.toFixed(6),
      estimatedOverallRate: +((finalSnapshots.length / runs) * conditionalRate).toFixed(6) };
  }
  const sorted = [...floors].sort((a, b) => a - b);
  report[classKey] = { runs, passedFloor10: floors.filter(floor => floor >= 10).length,
    passedFloor15: floors.filter(floor => floor >= 15).length, passedFloor25: floors.filter(floor => floor >= 25).length,
    passedFloor50: floors.filter(floor => floor >= 50).length, passedFloor100: floors.filter(floor => floor >= 100).length,
    passedFloor250: floors.filter(floor => floor >= 250).length, passedFloor500: floors.filter(floor => floor >= 500).length,
    reachedFinalBoss: floors.filter(floor => floor >= 998).length, passedFloor999: floors.filter(floor => floor >= 999).length,
    maxFloor: sorted.at(-1), medianFloor: sorted[Math.floor(runs / 2)],
    bestBuild: bestState ? { hp: bestState.hp, maxHp: bestState.maxHp, damage: [bestState.damageMin, bestState.damageMax], defense: bestState.defense,
      resistance: bestState.resistance, modifiers: bestState.modifiers?.length || 0, items: bestState.items?.length || 0, lastLog: bestState.lastLog } : null,
    finalCalibration,
    meanFloor: +(floors.reduce((sum, floor) => sum + floor, 0) / runs).toFixed(2) };
}
console.log(JSON.stringify(report, null, 2));
db.close();
fs.rmSync(temporary, { recursive: true, force: true });

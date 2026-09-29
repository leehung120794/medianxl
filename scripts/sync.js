require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { syncAll } = require('../src/services/syncService');
(async () => {
  const result = await syncAll(console);
  fs.writeFileSync(path.resolve('./data/sync-report.json'), JSON.stringify({ syncedAt: new Date().toISOString(), ...result }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.report.every(x => !x.ok)) process.exitCode = 1;
})();

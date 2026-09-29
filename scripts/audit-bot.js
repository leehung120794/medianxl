const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { db, dbPath } = require('../src/db');
const { getCatalogItem } = require('../src/services/itemCatalogService');

const root = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
function check(condition, message) { if (!condition) errors.push(message); }

const commandDir = path.join(root, 'src', 'commands');
const commandFiles = fs.readdirSync(commandDir).filter(name => name.endsWith('.js') && name !== 'medianQuizFactory.js');
const commandSchemas = commandFiles.map(file => {
  const command = require(path.join(commandDir, file));
  check(command?.data && typeof command.execute === 'function', `${file}: thiếu data hoặc execute`);
  let schema = null;
  try { schema = command.data.toJSON(); } catch (error) { errors.push(`${file}: schema lỗi (${error.message})`); }
  if (schema) check(schema.name === path.basename(file, '.js'), `${file}: tên command là ${schema.name}`);
  return schema;
}).filter(Boolean);
const schemaNames = commandSchemas.map(schema => schema.name);
check(new Set(schemaNames).size === schemaNames.length, 'Có slash command trùng tên');

const indexSource = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
const runtimeNames = [...indexSource.matchAll(/\['([^']+)',\s*[A-Za-z0-9_]+\]/g)].map(match => match[1]);
check(new Set(runtimeNames).size === runtimeNames.length, 'Runtime nạp command trùng tên');
for (const name of schemaNames) check(runtimeNames.includes(name), `Command /${name} chưa được nạp trong src/index.js`);
for (const name of runtimeNames) check(schemaNames.includes(name), `Runtime tham chiếu command /${name} không có file tương ứng`);

const registerSource = fs.readFileSync(path.join(root, 'scripts', 'register-commands.js'), 'utf8');
const registerImports = [...registerSource.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*require\('\.\.\/src\/commands\/([^']+)'\)/g)];
const registeredNames = registerImports.filter(match => registerSource.includes(`${match[1]}.data.toJSON()`)).map(match => require(path.join(commandDir, `${match[2]}.js`)).data.toJSON().name);
for (const name of schemaNames) check(registeredNames.includes(name), `Command /${name} chưa có trong scripts/register-commands.js`);
for (const name of registeredNames) check(schemaNames.includes(name), `Register chứa command /${name} không được runtime nạp`);

const integrity = db.pragma('integrity_check');
check(integrity.length === 1 && integrity[0].integrity_check === 'ok', `SQLite integrity_check thất bại: ${JSON.stringify(integrity)}`);
const foreignKeyErrors = db.pragma('foreign_key_check');
check(foreignKeyErrors.length === 0, `SQLite có ${foreignKeyErrors.length} lỗi khóa ngoại`);
check(db.pragma('foreign_keys', { simple: true }) === 1, 'SQLite foreign_keys chưa bật');

const negativeBalances = db.prepare('SELECT COUNT(*) count FROM economy_accounts WHERE balance<0').get().count;
const invalidInventory = db.prepare('SELECT COUNT(*) count FROM user_inventory WHERE quantity<0').get().count;
check(negativeBalances === 0, `Có ${negativeBalances} tài khoản âm xu`);
check(invalidInventory === 0, `Có ${invalidInventory} dòng kho đồ âm`);

const inventoryIds = db.prepare('SELECT DISTINCT item_id FROM user_inventory WHERE quantity>0').all().map(row => row.item_id);
const shopIds = db.prepare('SELECT DISTINCT cosmetic_id item_id FROM shop_items WHERE listed=1').all().map(row => row.item_id);
const unknownInventory = inventoryIds.filter(id => !getCatalogItem(id));
const unknownShop = shopIds.filter(id => !getCatalogItem(id));
check(unknownInventory.length === 0, `Kho đồ có item không còn trong catalog: ${unknownInventory.join(', ')}`);
check(unknownShop.length === 0, `Shop có item không còn trong catalog: ${unknownShop.join(', ')}`);

for (const table of ['game_sessions', 'blackjack_sessions', 'mines_sessions', 'hardcore_sessions']) {
  for (const row of db.prepare(`SELECT rowid,state_json FROM ${table}`).all()) {
    try { JSON.parse(row.state_json); } catch { errors.push(`${table} row ${row.rowid}: state_json hỏng`); }
  }
}

const tableCounts = Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map(({ name }) => [name, db.prepare(`SELECT COUNT(*) count FROM ${name}`).get().count]));
const testRows = Object.keys(tableCounts).filter(name => db.prepare(`PRAGMA table_info(${name})`).all().some(column => column.name === 'guild_id'))
  .reduce((sum, name) => sum + db.prepare(`SELECT COUNT(*) count FROM ${name} WHERE guild_id LIKE 'test-%'`).get().count, 0);
check(testRows === 0, `Database còn ${testRows} bản ghi do bộ kiểm thử tạo ra`);
if (!process.env.ADMIN_USER_ID) warnings.push('ADMIN_USER_ID chưa cấu hình');
if (!/^(1|true|yes)$/i.test(process.env.ENABLE_PREFIX_COMMANDS || process.env.ENABLE_MESSAGE_COMMANDS || '')) warnings.push('Prefix command đang tắt');

const report = {
  ok: errors.length === 0,
  commands: { files: commandFiles.length, runtime: runtimeNames.length, registered: registeredNames.length },
  database: { path: dbPath, bytes: fs.statSync(dbPath).size, integrity: integrity[0]?.integrity_check, foreignKeyErrors: foreignKeyErrors.length, tableCounts },
  catalog: { inventoryIds: inventoryIds.length, shopIds: shopIds.length },
  warnings,
  errors,
};
console.log(JSON.stringify(report, null, 2));
assert.equal(errors.length, 0, `Bot audit failed:\n- ${errors.join('\n- ')}`);

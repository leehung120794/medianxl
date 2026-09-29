const fs = require('node:fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('/tmp/umos.html', 'utf8'));
$('table tr').each((i, tr) => {
  const cells = $(tr).find('th,td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
  console.log(i, JSON.stringify(cells.slice(0, 4)));
});

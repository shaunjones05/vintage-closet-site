const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';
const NEW_STAMP_COUNT = 26;
const EXCLUDED_NEW_ID = 'eb-317669998950';

const targetIds = [
  'depop-vintagecloset8pdx-vintage-1990s-polo-ralph-lauren-1eec',
  'depop-vintagecloset_ndx-2000s-medium-rare-green-weezer-9ada',
  'depop-vintageclose1_pdx-rare-vintage-1996-ok-computer-c9b0',
  'depop-vintzgecloset_pdx-vintage-2000s-y2k-era-lebron-4ab7'
];

const src = fs.readFileSync(FILE, 'utf8');
const marker = 'const products =';
const idx = src.indexOf(marker);
const start = src.indexOf('[', idx);
let i = start;
let depth = 0;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) break;
  }
  if (ch === '"' || ch === '\'' || ch === '`') {
    const q = ch;
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') i += 2;
      else i++;
    }
  }
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext('products=' + src.slice(start, i + 1), sandbox);
const products = sandbox.products || [];

const available = products.filter((p) => p && p.status !== 'sold' && p.id !== EXCLUDED_NEW_ID);
const stampIds = new Set(available.slice(-NEW_STAMP_COUNT).map((p) => p.id));

for (const id of targetIds) {
  const p = products.find((x) => x && x.id === id);
  if (!p) {
    console.log('MISSING ' + id);
    continue;
  }
  console.log(`OK ${id} price=${p.price} inNewStamp=${stampIds.has(id)} idx=${products.findIndex(x => x && x.id===id)}`);
}

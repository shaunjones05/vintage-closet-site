const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';

const imageUpdates = {
  'depop-vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182': [
    'https://i.ebayimg.com/images/g/8ScAAeSwt4Fqboj3/s-l1600.webp',
    'https://i.ebayimg.com/images/g/xksAAeSwU6Vqboj4/s-l1600.webp',
    'https://i.ebayimg.com/images/g/kvQAAeSwWXRqboj5/s-l1600.webp',
    'https://i.ebayimg.com/images/g/eEwAAeSwE55qboj6/s-l1600.webp',
    'https://i.ebayimg.com/images/g/EQcAAeSwWkBqboj6/s-l1600.webp',
    'https://i.ebayimg.com/images/g/dtcAAeSwYJFqboj7/s-l1600.webp',
    'https://i.ebayimg.com/images/g/gRwAAeSwOk1qboj8/s-l1600.webp'
  ],
  'depop-vcntagecloset_pdx-jnco-the-low-down-wide-dc4f': [
    'https://i.ebayimg.com/images/g/1xQAAeSwNwVqa8j2/s-l1600.webp',
    'https://i.ebayimg.com/images/g/nzwAAeSwEFNqa8j3/s-l1600.webp',
    'https://i.ebayimg.com/images/g/5R8AAeSwQBhqa8j4/s-l1600.webp',
    'https://i.ebayimg.com/images/g/OA0AAeSwvTxqa8j5/s-l1600.webp',
    'https://i.ebayimg.com/images/g/VO0AAeSwKzZqa8j5/s-l1600.webp',
    'https://i.ebayimg.com/images/g/V8oAAeSwU6Vqa8j6/s-l1600.webp',
    'https://i.ebayimg.com/images/g/A6EAAeSwUIlqa8j7/s-l1600.webp'
  ]
};

const soldNames = new Set([
  'Blink-182 Hurley Mens T-Shirt XL Blue Vintage 90s Box Logo Grail',
  'Vintage 2004 Ramones Faded Band Tee, CBGB 1978 Graphic, Size M',
  "Patagonia Men's Iron Forge Hemp Canvas Double Knee Work Pants",
  'Brand New with Tags Polo Ralph Lauren Cable-Knit Quarter-Zip Sweater',
  'Rare Vintage 1993 Slowdive Souvlaki Tee',
  'Vintage 1991 Skid Row Slave To The Grind Tee',
  'Vintage 1989 Batman DC Comics Tee'
]);

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

let photosUpdated = 0;
let soldUpdated = 0;

for (const p of products) {
  if (!p) continue;

  if (imageUpdates[p.id]) {
    p.images = imageUpdates[p.id].slice();
    photosUpdated++;
  }

  if (soldNames.has(String(p.name || '').trim()) && p.status !== 'sold') {
    p.status = 'sold';
    soldUpdated++;
  }
}

const outArray = JSON.stringify(products, null, 2);
const newSrc = src.slice(0, start) + outArray + src.slice(i + 1);
fs.writeFileSync(FILE, newSrc, 'utf8');

console.log('photosUpdated=' + photosUpdated);
console.log('soldUpdated=' + soldUpdated);

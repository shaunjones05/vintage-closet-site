const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('js/app.js', 'utf8');
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

const ids = [
  'depop-vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182',
  'depop-vcntagecloset_pdx-jnco-the-low-down-wide-dc4f'
];
for (const id of ids) {
  const p = products.find(x => x.id === id);
  const hosts = (p && p.images ? p.images.map(u => /ebayimg\.com/.test(String(u))) : []);
  console.log('ID=' + id);
  console.log('IMAGE_COUNT=' + (p && p.images ? p.images.length : 0));
  console.log('ALL_EBAY=' + (hosts.length > 0 && hosts.every(Boolean)));
}

const soldNames = [
  'Blink-182 Hurley Mens T-Shirt XL Blue Vintage 90s Box Logo Grail',
  'Vintage 2004 Ramones Faded Band Tee, CBGB 1978 Graphic, Size M',
  "Patagonia Men's Iron Forge Hemp Canvas Double Knee Work Pants",
  'Brand New with Tags Polo Ralph Lauren Cable-Knit Quarter-Zip Sweater',
  'Rare Vintage 1993 Slowdive Souvlaki Tee',
  'Vintage 1991 Skid Row Slave To The Grind Tee',
  'Vintage 1989 Batman DC Comics Tee'
];
for (const name of soldNames) {
  const p = products.find(x => String((x && x.name) || '').trim() === name);
  console.log('SOLD_CHECK=' + name + ' => ' + (p ? p.status : 'NOT_FOUND'));
}

const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';
const sizeMap = {
  'depop-vinpagecloset_pdx-vintage-dinosaur-jr-white-t-shirt-f935': 'XL',
  'depop-vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182': '34',
  'depop-vintageclosmt_pdx-vintage-1992-nirvana-smiley-logo-41ef': 'M',
  'depop-vintagecroset_pdx-vintage-jesse-james-work-wear-3f73': 'L',
  'depop-vintaaecloset_pdx-vintage-2005-danzig-il-demonio-880e': 'M',
  'depop-vintagecloset_pdx-vintage-90s-sunrise-sportswear-the-03b0': 'XL',
  'depop-vcntagecloset_pdx-jnco-the-low-down-wide-dc4f': '34',
  'depop-vintageclose7_pdx-vintage-status-quo-double-sided-c61d': 'Other',
  'depop-vintagycloset_pdx-vintage-1998-liquid-blue-kevin-b194': 'XL',
  'depop-vintageclrset_pdx-2005-vintage-misfits-skull-fiend-2f9d': 'S',
  'depop-vintageclosetlpdx-rare-vintage-90s-the-doors-0271': 'L',
  'depop-vintagecloset_pds-vintage-1988-mighty-mouse-here-a8e2': 'L',
  'depop-vintagecl8set_pdx-2005-misfits-records-meet-the-a7b2': 'S',
  'depop-vintageclose3_pdx-vintage-2005-kurt-cobain-graphic-3c91': 'M',
  'depop-vintag3closet_pdx-vintage-1996-star-trek-30-1227': 'Other',
  'depop-vintagecposet_pdx-vintage-1996-the-crow-city-5ee5': 'XL',
  'depop-vintxgecloset_pdx-vintage-1976-marvel-comics-captain-77aa': 'S',
  'eb-318665600900': '34'
};

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

let updated = 0;
for (const p of products) {
  if (sizeMap[p.id]) {
    p.size = sizeMap[p.id];
    updated++;
  }
}

const outArray = JSON.stringify(products, null, 2);
const newSrc = src.slice(0, start) + outArray + src.slice(i + 1);
fs.writeFileSync(FILE, newSrc, 'utf8');
console.log('updated', updated);

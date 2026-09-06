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

const box = {};
vm.createContext(box);
vm.runInContext('products=' + src.slice(start, i + 1), box);
const products = box.products || [];
const truncated = products.filter((p) => /\.\.\.$/.test(String((p && p.name) || '').trim()));
const sample = products.find((p) => p && p.id === 'depop-vintxgecloset_pdx-vintage-1976-marvel-comics-captain-77aa');

console.log('TRUNCATED_COUNT=' + truncated.length);
console.log('SAMPLE_NAME=' + (sample ? sample.name : 'NOT_FOUND'));

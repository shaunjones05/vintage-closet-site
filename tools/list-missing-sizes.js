const fs = require('fs');
const vm = require('vm');

const txt = fs.readFileSync('js/app.js', 'utf8');
const marker = 'const products =';
const idx = txt.indexOf(marker);
const start = txt.indexOf('[', idx);
let i = start;
let depth = 0;
for (; i < txt.length; i++) {
  const ch = txt[i];
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) break;
  }
  if (ch === '"' || ch === '\'' || ch === '`') {
    const q = ch;
    i++;
    while (i < txt.length && txt[i] !== q) {
      if (txt[i] === '\\') i += 2;
      else i++;
    }
  }
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext('products=' + txt.slice(start, i + 1), sandbox);
const recent = (sandbox.products || []).filter(p => /^depop-/.test(p.id) || /^eb-3186/.test(p.id));
const missing = recent.filter(p => String(p.size || '').toLowerCase() === 'one size');
console.log('RECENT=' + recent.length);
console.log('MISSING=' + missing.length);
for (const p of missing) {
  console.log([p.id, p.name, p.depopUrl || p.ebayUrl || ''].join(' || '));
}

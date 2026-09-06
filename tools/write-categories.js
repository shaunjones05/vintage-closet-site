const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.resolve(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-categories-' + Date.now();

const src = fs.readFileSync(file, 'utf8');
const m = src.match(/const products\s*=\s*(\[[\s\S]*?\]);/m);
if (!m) {
  console.error('products array not found in', file);
  process.exit(1);
}
const arrStr = m[1];
const sandbox = {};
vm.createContext(sandbox);
try {
  vm.runInContext('products=' + arrStr, sandbox, { timeout: 2000 });
} catch (e) {
  console.error('Error evaluating products array:', e);
  process.exit(1);
}
const products = sandbox.products || [];

const KEYWORDS = {
  Jackets: ['jacket','coat','parka','bomber','detroit','chore','windbreaker','puffer','anorak','varsity','workwear jacket','trench','overcoat','coat'],
  Tees: ['tee','t-shirt','tshirt','graphic tee','band tee','shirt'],
  Pants: ['pants','jeans','denim','trousers','cargos','cargo','carpenter','double knee','shorts'],
  'Crewnecks & Hoodies': ['hoodie','hooded','sweatshirt','crewneck','pullover','sweat']
};

function assignCategoryToProduct(p){
  if (!p || typeof p !== 'object') return 'Tees';
  const hay = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
  // Brand cue: Carhartt outerwear => Jackets
  if (/carhartt/i.test(hay) && /(jacket|coat|bomber|work|canvas|detroit|chore|puffer|windbreaker|parka|trench)/i.test(hay)) return 'Jackets';
  // hood/sweat default
  if (/hood|sweat/i.test(hay)) return 'Crewnecks & Hoodies';
  const matches = {};
  Object.keys(KEYWORDS).forEach(cat => {
    KEYWORDS[cat].forEach(k => { if (hay.indexOf(k) !== -1) matches[cat] = (matches[cat] || 0) + 1; });
  });
  const best = Object.keys(matches).sort((a,b)=>matches[b]-matches[a]);
  if (best.length > 0 && matches[best[0]] > 0) return best[0];
  if (/(jacket|coat|parka|bomber|puffer|anorak|trench)/i.test(hay)) return 'Jackets';
  if (/(tee|t-shirt|tshirt|graphic|band)/i.test(hay)) return 'Tees';
  if (/(pants|jeans|denim|trouser|cargo|shorts)/i.test(hay)) return 'Pants';
  return 'Tees';
}

// assign categories
products.forEach(p => { p.category = assignCategoryToProduct(p); });

// backup
fs.writeFileSync(backup, src, 'utf8');
console.log('Backup written to', backup);

// replace products array in source
const newArrText = JSON.stringify(products, null, 2);
const newSrc = src.replace(/const products\s*=\s*\[[\s\S]*?\];/m, 'const products = ' + newArrText + ';');
fs.writeFileSync(file, newSrc, 'utf8');
console.log('Wrote categories into', file);

// print summary
const counts = {};
['Jackets','Tees','Pants','Crewnecks & Hoodies'].forEach(c=>counts[c]=0);
const ambiguous = [];
products.forEach(p=>{
  const cat = p.category || 'Uncategorized';
  counts[cat] = (counts[cat]||0)+1;
  const hay = ((p.name||'') + ' ' + (p.description||'')).toLowerCase();
  let hits = 0;
  Object.keys(KEYWORDS).forEach(k=> KEYWORDS[k].forEach(kw=>{ if (hay.indexOf(kw) !== -1) hits++; }));
  if (hits > 1) ambiguous.push({name: p.name, chosen: cat});
});
console.log('Category counts:');
console.table(counts);
if (ambiguous.length){
  console.log('Possibly ambiguous items:');
  ambiguous.forEach(a=> console.log('-', a.name, '=>', a.chosen));
}


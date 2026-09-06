const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-polish-' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

const TARGET = new Set([
  '317680999752','317663055939','317663062201','317669876787',
  '317669929539','317670021285','317681810882','317670615336'
]);

function cleanText(s){
  if(!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g,'');
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi,'');
  out = out.replace(/<[^>]+>/g,' ');
  out = out.replace(/\s+/g,' ').trim();
  return out;
}

function stripLabels(s){
  if(!s) return '';
  // remove common labels and their trailing text up to a period or line end
  s = s.replace(/Condition:\s*[^\.\n]+(?:\.|$)/gi, '');
  s = s.replace(/Size\/?Dimensions:\s*[^\.\n]+(?:\.|$)/gi, '');
  s = s.replace(/Model\/Style:\s*[^\.\n]+(?:\.|$)/gi, '');
  s = s.replace(/Features:\s*[^\.\n]+(?:\.|$)/gi, '');
  s = s.replace(/Measurements:\s*[^\.\n]+(?:\.|$)/gi, '');
  return s.replace(/\s+/g,' ').trim();
}

function shorten(s){
  if(!s) return '';
  // prefer first sentence
  const m = s.match(/^(.*?[\.\!\?])\s*/);
  if(m && m[1] && m[1].length <= 140) return m[1].trim();
  const words = s.split(/\s+/).filter(Boolean);
  if(words.length <= 12) return words.join(' ');
  return words.slice(0,12).join(' ') + '...';
}

const arrRe = /const\s+products\s*=\s*\[([\s\S]*?)\];/m;
const m = src.match(arrRe);
if(!m) { console.error('products array not found'); process.exit(1); }
let arrayText = '[' + m[1] + ']';
// substitute JACKETS_STRIPE_LINK value for eval
const stripeRe = /const\s+JACKETS_STRIPE_LINK\s*=\s*(['"])([\s\S]*?)\1/;
const sm = src.match(stripeRe);
if(sm) arrayText = arrayText.replace(/\bJACKETS_STRIPE_LINK\b/g, '"' + sm[2].replace(/"/g,'\\"') + '"');

let products;
try{
  const script = new vm.Script('(' + arrayText + ')');
  const ctx = vm.createContext({});
  products = script.runInContext(ctx);
  if(!Array.isArray(products)) throw new Error('not array');
}catch(e){ console.error('parse error', e); process.exit(1); }

let changed = 0;
for(const p of products){
  if(!p || !p.ebayItemNumber) continue;
  if(!TARGET.has(p.ebayItemNumber)) continue;
  const orig = (p.description||'').toString();
  let out = cleanText(orig);
  out = stripLabels(out);
  out = shorten(out || p.name || '');
  if(out && out !== orig){ p.description = out; changed++; }
}

const newArrayJS = JSON.stringify(products, null, 2);
const newFile = src.replace(arrRe, `const products = ${newArrayJS};`);
fs.writeFileSync(file, newFile, 'utf8');
console.log(`Polished ${changed} imported descriptions. Backup: ${backup}`);

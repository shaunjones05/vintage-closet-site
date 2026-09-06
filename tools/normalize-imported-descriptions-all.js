const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-normalize-' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

// Target item numbers from both import batches
const TARGET = new Set([
  '317680999752','317663055939','317663062201','317669876787',
  '317669929539','317670021285','317681810882','317670615336',
  '317664148959','317662994855','317663038780','317624659137',
  '317665941836','317669913541','317670612819','317669597832',
  '317669600593','317694601089'
]);

function cleanText(s){
  if(!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g,'');
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi,'');
  out = out.replace(/<[^>]+>/g,' ');
  out = out.replace(/Condition:\s*[^\.\n]+(?:\.|$)/gi,'');
  out = out.replace(/Size\/?Dimensions:\s*[^\.\n]+(?:\.|$)/gi,'');
  out = out.replace(/Model\/Style:\s*[^\.\n]+(?:\.|$)/gi,'');
  out = out.replace(/Features:\s*[^\.\n]+(?:\.|$)/gi,'');
  out = out.replace(/Measurements:\s*[^\.\n]+(?:\.|$)/gi,'');
  out = out.replace(/\s+/g,' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
  return out;
}

function firstSentenceOrShort(s){
  if(!s) return '';
  const m = s.match(/^(.*?[\.\!\?])\s*/);
  if(m && m[1] && m[1].length <= 160) return m[1].trim();
  const words = s.split(/\s+/).filter(Boolean);
  if(words.length <= 12) return words.join(' ');
  return words.slice(0,12).join(' ') + '...';
}

const arrRe = /const\s+products\s*=\s*\[([\s\S]*?)\];/m;
const m = src.match(arrRe);
if(!m){ console.error('products array not found'); process.exit(1); }
let arrayText = '[' + m[1] + ']';
// substitute JACKETS_STRIPE_LINK value so VM can eval
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
  const cleaned = cleanText(orig || p.name || '');
  const final = firstSentenceOrShort(cleaned || p.name || '');
  if(final && final !== orig){ p.description = final; changed++; }
}

const newArrayJS = JSON.stringify(products, null, 2);
const newFile = src.replace(arrRe, `const products = ${newArrayJS};`);
fs.writeFileSync(file, newFile, 'utf8');
console.log(`Normalized descriptions for ${changed} products. Backup: ${backup}`);

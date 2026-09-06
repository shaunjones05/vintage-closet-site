const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-stripcode-' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

const arrRe = /const\s+products\s*=\s*\[([\s\S]*?)\];/m;
const m = src.match(arrRe);
if(!m){ console.error('products array not found'); process.exit(1); }
let arrayText = '[' + m[1] + ']';
// substitute JACKETS_STRIPE_LINK
const stripeRe = /const\s+JACKETS_STRIPE_LINK\s*=\s*(['\"])([\s\S]*?)\1/;
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
  if(!p || !p.description || typeof p.description !== 'string') continue;
  const idx = p.description.indexOf('Code:');
  if(idx >= 0){
    let newDesc = p.description.slice(0, idx).trim();
    // trim trailing punctuation
    newDesc = newDesc.replace(/[.,;:\-\s]+$/,'');
    if(newDesc !== p.description){ p.description = newDesc; changed++; }
  }
}

const newArrayJS = JSON.stringify(products, null, 2);
const newFile = src.replace(arrRe, `const products = ${newArrayJS};`);
fs.writeFileSync(file, newFile, 'utf8');
console.log(`Stripped code instructions from ${changed} descriptions. Backup: ${backup}`);

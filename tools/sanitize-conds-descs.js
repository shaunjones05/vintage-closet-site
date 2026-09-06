const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-sanitize-' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

// helper to clean text
function cleanText(s){
  if(!s || typeof s !== 'string') return '';
  let out = s.replace(/#\S+/g, ''); // remove hashtags
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off|BUNDLE DISCOUNT|GET\s*\d+%?\s*OFF)/gi, '');
  out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/,'');
  out = out.replace(/\s+/g,' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
  return out;
}

// extract products array
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

let descChanged = 0, condChanged = 0, condRemoved = 0;
for(const p of products){
  if(!p) continue;
  if(p.description && typeof p.description === 'string'){
    const cleaned = cleanText(p.description);
    if(cleaned !== p.description){ p.description = cleaned; descChanged++; }
  }
  if(p.condition && typeof p.condition === 'string'){
    const orig = p.condition;
    const cleaned = cleanText(orig);
    // consider 'unclear' if it contains HTML-like artifacts or data-testid or x-item-condition or weird class markers
    const unclear = /<|data-testid|x-item-condition|mar-t-20|\/>|=\"|\/>/i.test(orig);
    if(unclear || cleaned.length === 0){
      delete p.condition; condRemoved++;
    } else if(cleaned !== orig){
      p.condition = cleaned; condChanged++;
    }
  }
}

const newArrayJS = JSON.stringify(products, null, 2);
const newFile = src.replace(arrRe, `const products = ${newArrayJS};`);
fs.writeFileSync(file, newFile, 'utf8');
console.log(`Sanitized descriptions: ${descChanged}, condition changed: ${condChanged}, condition removed: ${condRemoved}. Backup: ${backup}`);
